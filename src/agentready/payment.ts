import type {ReadinessState} from "../providers/registry";
import type {PageEvidence} from "./types";
import {parseUcpManifest} from "../providers/discovery";

// Payment / transaction readiness (Phase 10.6), assessed in stages rather than reduced to
// "a checkout link exists".
//
// ABSOLUTE RULE: AgentCart never accepts, stores or forwards a card number, wallet credential or
// any payment secret. It assesses whether a checkout path is reachable and agent-compatible.
// User approval and authentication stay entirely inside the merchant's payment provider.

export interface PaymentStage {
  step:number;
  key:string;
  label:string;
  state:ReadinessState;
  evidence:string;
  detail:string;
}

export interface PaymentReadiness {
  stages:PaymentStage[];
  /** A normal supported checkout path appears usable by an agent. */
  purchaseCapable:boolean;
  /** A more native agentic payment/checkout integration is available. */
  optimized:boolean;
  /** Named integrations detected. Never asserted without evidence. */
  integrations:string[];
  furthestStage:number;
  caveat:string;
}

export const PAYMENT_CAVEAT=
  "AgentCart never handles card details, wallet credentials or payment secrets. It checks whether a checkout path is reachable and machine-readable; payment and identity verification stay with the merchant's payment provider.";

const any=(pages:PageEvidence[],re:RegExp)=>pages.some(p=>re.test(p.signals.title)||false);

export function assessPayment(
  pages:PageEvidence[],
  html:string,
  opts:{sellsProducts?:boolean;ucpManifest?:string;region?:ReadinessState}={}
):PaymentReadiness{
  const stages:PaymentStage[]=[];
  const add=(step:number,key:string,label:string,state:ReadinessState,evidence:string,detail:string)=>
    stages.push({step,key,label,state,evidence,detail});

  if(!opts.sellsProducts){
    return {stages:[{step:1,key:"not-applicable",label:"Product purchase",state:"unsupported",
      evidence:"no catalogue detected",
      detail:"This business does not appear to sell products online, so a purchase path is not assessed."}],
      purchaseCapable:false,optimized:false,integrations:[],furthestStage:0,caveat:PAYMENT_CAVEAT};
  }

  const hasProduct=pages.some(p=>p.pageType==="product")||pages.some(p=>p.signals.productSchema);
  add(1,"select-product","A product can be selected",hasProduct?"pass":"fail",
    hasProduct?"a product page or product structured data was found":"no product page detected",
    hasProduct?"An agent can reach a specific product.":"No product page was found, so an agent has nothing to select.");

  const variants=pages.some(p=>p.signals.variantSignals);
  add(2,"select-variant","The right option can be chosen",variants?"pass":"unknown",
    variants?"variant or option markup present":"no variant markup detected",
    variants?"Options such as size or colour can be chosen.":"No option selector was detected. If products have variants, an agent may not be able to pick one.");

  const cart=pages.some(p=>p.signals.addToCart)||/\/cart\b/i.test(html);
  add(3,"reach-cart","A cart can be created",cart?"pass":"fail",
    cart?"cart control or /cart path present":"no cart path detected",
    cart?"An agent can add an item and reach a cart.":"No cart route was detected.");

  const priced=pages.some(p=>p.signals.priceSignals);
  const currency=pages.some(p=>p.signals.currencySignals.length>0);
  add(4,"totals-currency","Totals and currency are clear",
    priced&&currency?"pass":priced?"unknown":"fail",
    `price signals: ${priced}, currency signals: ${currency}`,
    priced&&currency?"Prices and currency are readable."
    :priced?"Prices are readable but the currency is ambiguous, so an agent may misreport the cost."
    :"No machine-readable price was found.");

  const shipping=pages.some(p=>p.pageType==="shipping");
  add(5,"shipping-info","Delivery terms can be found",shipping?"pass":"fail",
    shipping?"a delivery page was found":"no delivery page found",
    shipping?"An agent can quote delivery terms.":"No delivery information was found, so an agent cannot answer the most common pre-purchase question.");

  const returns=pages.some(p=>p.pageType==="returns");
  add(6,"returns-info","Returns terms can be found",returns?"pass":"fail",
    returns?"a returns page was found":"no returns page found",
    returns?"An agent can quote returns terms.":"No returns information was found.");

  const checkout=pages.some(p=>p.signals.checkoutLink)||/\/checkouts?\b/i.test(html);
  add(7,"reach-checkout","Checkout is reachable",checkout?"pass":"fail",
    checkout?"a checkout route was detected":"no checkout route detected",
    checkout?"An agent can hand the customer to checkout.":"No checkout route was detected.");

  // Named integrations. Each requires a real marker; none is inferred.
  const integrations:string[]=[];
  const detect=(name:string,re:RegExp)=>{if(re.test(html)){integrations.push(name);return true;}return false;};
  const card=detect("Card checkout",/(?:card-fields|cardnumber|data-card|payment-method|checkout__payment)/i)
    ||checkout; // a reachable standard checkout implies ordinary card payment
  add(8,"card-checkout","Standard card checkout appears available",card?"pass":"unknown",
    card?"standard checkout path present":"could not confirm a card checkout",
    card?"An ordinary checkout an agent can hand off to appears available.":"A standard card checkout could not be confirmed from the page.");

  const shopPay=detect("Shop Pay",/shop[-_]?pay|shopify[-_]?payments/i);
  const link=detect("Stripe Link",/stripe|link-authentication|js\.stripe\.com/i);
  add(9,"accelerated-checkout","Accelerated checkout options",
    shopPay||link?"pass":"unsupported",
    integrations.length?integrations.join(", "):"none detected",
    shopPay||link?`Detected: ${integrations.join(", ")}. These can speed up an agent-assisted purchase.`
    // Explicitly not a failure: ordinary checkout remaining usable is enough.
    :"No accelerated checkout was detected. That is not a problem if ordinary checkout works, which is assessed above.");

  const ucp=opts.ucpManifest?parseUcpManifest(opts.ucpManifest):null;
  const ucpCheckout=!!ucp?.valid&&ucp.capabilities.some(c=>/checkout/i.test(c));
  add(10,"agentic-checkout","Native agentic checkout",
    opts.region==="not_available_in_region"?"not_available_in_region"
      :ucpCheckout?"pass":"unsupported",
    ucpCheckout?`UCP checkout capability: ${ucp!.capabilities.filter(c=>/checkout/i.test(c)).join(", ")}`
      :"no agentic checkout capability declared",
    opts.region==="not_available_in_region"
      ? "Native agentic checkout is not offered in this market yet. That is not a failing on your part."
      : ucpCheckout?"A native agentic checkout capability is declared, so an agent can transact directly."
      :"No native agentic checkout capability is declared. Ordinary checkout is still usable by an agent.");

  add(11,"approval-stays-with-provider","Approval stays with your payment provider","pass",
    "AgentCart holds no payment credentials",
    "AgentCart never sees or stores card details. Approval and authentication remain in your checkout and payment provider, where they belong.");

  const required=[1,3,7];
  const purchaseCapable=required.every(step=>stages.find(s=>s.step===step)?.state==="pass");
  const furthest=stages.filter(s=>s.state==="pass").reduce((n,s)=>Math.max(n,s.step),0);

  return {stages,purchaseCapable,optimized:ucpCheckout,integrations,furthestStage:furthest,caveat:PAYMENT_CAVEAT};
}

/** Labels the spec asks for, kept separate from the raw stage list. */
export function paymentLabels(r:PaymentReadiness){
  return {
    purchaseCapable:{label:"Agent purchase capable",value:r.purchaseCapable,
      meaning:"A normal supported checkout path appears usable by an agent."},
    optimized:{label:"Agent optimized",value:r.optimized,
      meaning:"A more native agentic payment or checkout integration is available."}
  };
}
