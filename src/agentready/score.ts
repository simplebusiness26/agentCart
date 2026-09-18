import {CATEGORY_LABELS,CATEGORY_WEIGHTS} from "./types";
import type {AgentReadyReport,CapabilitySummary,Category,Check,CheckStatus,FixType,PageEvidence,PageSignals,PlatformResult} from "./types";

// Bump when the model changes so historical scores stay interpretable.
export const SCORING_VERSION="2.0.0";

interface Ctx {
  pages:PageEvidence[];
  home:PageEvidence;
  product?:PageEvidence;
  robots?:string;
  llms?:string;
  sitemap:boolean;
  sellsProducts:boolean;
  offersBooking:boolean;
}

interface Spec {
  key:string; category:Category; weight:number;
  plainTitle:string; whyItMatters:string; fix:string; fixType:FixType;
  // Returns null when the check does not apply to this kind of business.
  run(c:Ctx):{status:CheckStatus;ratio:number;evidence:string;technical:string}|null;
}

const any=(pages:PageEvidence[],f:(s:PageSignals)=>boolean)=>pages.some(p=>f(p.signals));
const pass=(ok:boolean,evidence:string,technical:string)=>({status:(ok?"pass":"fail") as CheckStatus,ratio:ok?1:0,evidence,technical});
const grade=(ratio:number,evidence:string,technical:string)=>({
  status:(ratio>=.99?"pass":ratio>=.5?"partial":"fail") as CheckStatus,ratio,evidence,technical});

const SPECS:Spec[]=[
  // ---- A. Understand the business (20) ----
  {key:"business-identity",category:"business",weight:6,
   plainTitle:"AI can identify your business",whyItMatters:"If an assistant cannot state who you are, it will not confidently recommend you.",
   fix:"Add Organization or LocalBusiness structured data naming the business, and make the name clear in the page title.",fixType:"hosted_layer",
   run:c=>{const schema=any(c.pages,s=>s.organizationSchema);const titled=c.home.signals.title.length>3;
     return grade(schema?1:titled?.5:0,schema?"Structured business identity found.":titled?"Only the page title identifies the business.":"No clear business identity.",
       schema?"Organization/LocalBusiness JSON-LD present.":"No Organization JSON-LD detected.");}},

  {key:"business-description",category:"business",weight:5,
   plainTitle:"AI can tell what you do",whyItMatters:"Assistants match customer intent against a clear description of what you offer.",
   fix:"Write a specific meta description and opening paragraph stating what you sell and to whom.",fixType:"approval_required",
   run:c=>{const d=c.home.signals.metaDescription.trim();const enough=d.length>=50;
     return grade(enough?1:d.length>=20?.5:0,enough?"A meaningful description is present.":d?"The description is very short.":"No description found.",
       `meta description length ${d.length}.`);}},

  {key:"business-contact",category:"business",weight:5,
   plainTitle:"AI can find how to contact you",whyItMatters:"A contact route is what turns a recommendation into an enquiry.",
   fix:"Publish an email address or phone number in text on a contact page, not only inside an image or a form.",fixType:"manual",
   run:c=>{const email=any(c.pages,s=>s.emails.length>0);const phone=any(c.pages,s=>s.phones.length>0);
     const form=any(c.pages,s=>s.contactForm);const n=[email,phone,form].filter(Boolean).length;
     return grade(n>=2?1:n===1?.5:0,n?`Found ${[email&&"an email address",phone&&"a phone number",form&&"a contact form"].filter(Boolean).join(", ")}.`:"No contact method was machine-readable.",
       `email=${email} phone=${phone} form=${form}`);}},

  {key:"business-location",category:"business",weight:2,
   plainTitle:"AI can tell where you operate",whyItMatters:"Location decides whether you are relevant to a local or regional request.",
   fix:"Publish a postal address or an explicit service area, ideally inside LocalBusiness structured data.",fixType:"manual",
   run:c=>pass(any(c.pages,s=>s.addressSignals),any(c.pages,s=>s.addressSignals)?"Address details detected.":"No address or service area detected.","postcode/address pattern match")},

  {key:"business-hours",category:"business",weight:2,
   plainTitle:"AI can tell when you are available",whyItMatters:"Availability matters for bookings, collection and support questions.",
   fix:"Publish opening hours as text, or openingHours in structured data.",fixType:"manual",
   run:c=>{if(!c.offersBooking&&!any(c.pages,s=>s.addressSignals))return null; // online-only shops are not penalised
     return pass(any(c.pages,s=>s.hoursSignals),any(c.pages,s=>s.hoursSignals)?"Opening hours detected.":"No opening hours detected.","hours pattern match");}},

  // ---- B. Understand the catalog (25) ----
  {key:"catalog-schema",category:"catalog",weight:9,
   plainTitle:"AI can reliably read your products",whyItMatters:"Structured product data is the difference between an assistant guessing and knowing.",
   fix:"Add valid JSON-LD Product and Offer data including name, price, currency, availability and an identifier.",fixType:"automatic",
   run:c=>{if(!c.sellsProducts)return null;
     const ok=any(c.pages,s=>s.productSchema);
     return pass(ok,ok?"Product structured data found.":"No Product or Offer structured data found.","Product/Offer JSON-LD detection");}},

  {key:"catalog-price",category:"catalog",weight:6,
   plainTitle:"AI can read your prices",whyItMatters:"An assistant that cannot read a price cannot compare or recommend you on value.",
   fix:"Show price and currency as text and inside Offer structured data on every product page.",fixType:"automatic",
   run:c=>{if(!c.sellsProducts)return null;
     const price=any(c.pages,s=>s.priceSignals);const cur=any(c.pages,s=>s.currencySignals.length>0);
     return grade(price&&cur?1:price?.5:0,price&&cur?"Prices and currency are readable.":price?"Prices found but the currency is ambiguous.":"No machine-readable price found.",
       `price=${price} currency=${cur}`);}},

  {key:"catalog-availability",category:"catalog",weight:4,
   plainTitle:"AI can tell what is in stock",whyItMatters:"Recommending something unavailable wastes the customer's time and your credibility.",
   fix:"Expose availability using schema.org values such as InStock or OutOfStock, and state it in the page copy.",fixType:"automatic",
   run:c=>{if(!c.sellsProducts)return null;
     return pass(any(c.pages,s=>s.availabilitySignals),any(c.pages,s=>s.availabilitySignals)?"Availability signals present.":"Availability was not machine-readable.","stock keyword/schema match");}},

  {key:"catalog-identifiers",category:"catalog",weight:3,
   plainTitle:"AI can match your products to the wider market",whyItMatters:"Identifiers let assistants recognise the same product across sources.",
   fix:"Publish SKU, GTIN or MPN in your product structured data.",fixType:"automatic",
   run:c=>{if(!c.sellsProducts)return null;
     return pass(any(c.pages,s=>s.skuSignals),any(c.pages,s=>s.skuSignals)?"Product identifiers detected.":"No SKU/GTIN/MPN identifiers detected.","identifier keyword match");}},

  {key:"catalog-images",category:"catalog",weight:3,
   plainTitle:"AI can describe your product images",whyItMatters:"Alt text is how a non-visual system understands what a product looks like.",
   fix:"Write factual alt text describing the product and its important visual attributes.",fixType:"approval_required",
   run:c=>{if(!c.sellsProducts)return null; // alt text on product imagery is a catalogue concern
     const imgs=c.pages.reduce((n,p)=>n+p.signals.images,0);
     if(!imgs)return null;
     const alts=c.pages.reduce((n,p)=>n+p.signals.imagesWithAlt,0);
     const ratio=alts/imgs;
     return grade(ratio>=.8?1:ratio>=.5?.5:0,`${Math.round(ratio*100)}% of images have alt text.`,`${alts}/${imgs} images with non-empty alt`);}},

  // ---- C. Policies and trust (15) ----
  {key:"policy-shipping",category:"policies",weight:5,
   plainTitle:"AI can find your delivery information",whyItMatters:"Delivery cost and timing are among the most common pre-purchase questions.",
   fix:"Publish a shipping or delivery page and link it from the footer.",fixType:"manual",
   run:c=>{if(!c.sellsProducts)return null;
     const ok=c.pages.some(p=>p.pageType==="shipping");
     return pass(ok,ok?"A delivery/shipping page was found.":"No delivery or shipping page was found.","page type discovery");}},

  {key:"policy-returns",category:"policies",weight:5,
   plainTitle:"AI can find your returns policy",whyItMatters:"Return terms materially change whether a customer is willing to buy.",
   fix:"Publish a returns or refunds page and link it from the footer.",fixType:"manual",
   run:c=>{if(!c.sellsProducts)return null;
     const ok=c.pages.some(p=>p.pageType==="returns");
     return pass(ok,ok?"A returns/refunds page was found.":"No returns or refunds page was found.","page type discovery");}},

  {key:"policy-legal",category:"policies",weight:3,
   plainTitle:"AI can find your terms and privacy information",whyItMatters:"Assistants and their operators favour businesses that publish clear terms.",
   fix:"Publish privacy and terms pages at stable URLs.",fixType:"manual",
   run:c=>{const ok=c.pages.some(p=>p.pageType==="policy");
     return pass(ok,ok?"Legal/policy pages were found.":"No privacy or terms pages were found.","page type discovery");}},

  {key:"policy-faq",category:"policies",weight:2,
   plainTitle:"AI can answer common questions about you",whyItMatters:"A structured FAQ is directly quotable by an assistant.",
   fix:"Publish an FAQ page, ideally with FAQPage structured data.",fixType:"hosted_layer",
   run:c=>{const page=c.pages.some(p=>p.pageType==="faq");const schema=any(c.pages,s=>s.faqSchema);
     return grade(schema?1:page?.5:0,schema?"Structured FAQ data found.":page?"An FAQ page exists but is not structured.":"No FAQ was found.",
       `faqPage=${page} faqSchema=${schema}`);}},

  // ---- D. Access (15) ----
  {key:"access-crawl",category:"access",weight:5,
   plainTitle:"AI crawlers are allowed to read your site",whyItMatters:"A blanket block in robots.txt removes you from AI answers entirely.",
   fix:"Review robots.txt and explicitly allow the assistants and search systems you want to reach.",fixType:"approval_required",
   run:c=>{const blocked=c.robots?/User-agent:\s*\*[\s\S]*?Disallow:\s*\/\s*$/im.test(c.robots):false;
     return grade(blocked?0:1,blocked?"robots.txt contains a broad block.":"No blanket crawler block detected.",`robots.txt ${c.robots?"fetched":"absent"}`);}},

  {key:"access-sitemap",category:"access",weight:3,
   plainTitle:"AI can discover all your pages",whyItMatters:"A sitemap is how a crawler finds pages that are not linked from the homepage.",
   fix:"Publish and maintain sitemap.xml.",fixType:"automatic",
   run:c=>pass(c.sitemap,c.sitemap?"A sitemap was found.":"No sitemap.xml responded.","GET /sitemap.xml")},

  {key:"access-canonical",category:"access",weight:3,
   plainTitle:"AI knows which page is the real one",whyItMatters:"Without canonical URLs, duplicate and variant pages compete with each other.",
   fix:"Add canonical URLs to product and content pages.",fixType:"automatic",
   run:c=>{const n=c.pages.filter(p=>p.signals.canonical).length;
     return grade(c.pages.length?n/c.pages.length:0,`${n} of ${c.pages.length} pages declare a canonical URL.`,"link rel=canonical");}},

  {key:"access-metadata",category:"access",weight:2,
   plainTitle:"Your pages preview correctly when shared",whyItMatters:"Open Graph data is reused widely, including by assistants summarising a link.",
   fix:"Add og:title, og:description and og:image to important pages.",fixType:"automatic",
   run:c=>{const n=c.pages.filter(p=>p.signals.openGraph).length;
     return grade(c.pages.length?n/c.pages.length:0,`${n} of ${c.pages.length} pages have rich metadata.`,"og: meta tags");}},

  {key:"access-content",category:"access",weight:2,
   plainTitle:"Your content is visible without running scripts",whyItMatters:"Most crawlers do not execute JavaScript; content that needs it is invisible to them.",
   fix:"Server-render key product and policy content rather than loading it in the browser.",fixType:"manual",
   run:c=>{const thin=c.pages.filter(p=>p.signals.textLength<400).length;
     const ratio=c.pages.length?1-thin/c.pages.length:0;
     return grade(ratio,thin?`${thin} of ${c.pages.length} pages returned very little readable text.`:"All pages returned readable text.",
       "text length per fetched page");}},

  // ---- E. Actions (25) ----
  {key:"action-purchase",category:"actions",weight:10,
   plainTitle:"A customer can buy from an AI recommendation",whyItMatters:"This is the action that turns AI visibility into revenue.",
   fix:"Ensure product pages expose a real add-to-cart or buy control in the served HTML.",fixType:"automatic",
   run:c=>{if(!c.sellsProducts)return null;
     const cart=any(c.pages,s=>s.addToCart);const checkout=any(c.pages,s=>s.checkoutLink);
     return grade(cart&&checkout?1:cart||checkout?.5:0,cart&&checkout?"A complete purchase path was found.":cart||checkout?"Only part of the purchase path was found.":"No purchase path was detectable.",
       `addToCart=${cart} checkout=${checkout}`);}},

  {key:"action-enquire",category:"actions",weight:6,
   plainTitle:"A customer can contact you or request a quote",whyItMatters:"For services and considered purchases, the enquiry is the conversion.",
   fix:"Publish a contact or quote route reachable by a normal link, not only through a script-driven widget.",fixType:"manual",
   run:c=>{const contact=c.pages.some(p=>p.pageType==="contact");const quote=any(c.pages,s=>s.quoteSignals);
     const form=any(c.pages,s=>s.contactForm);
     return grade(contact&&(form||quote)?1:contact||form||quote?.5:0,
       contact?"A contact route was found.":form||quote?"An enquiry route exists but no clear contact page.":"No enquiry route was found.",
       `contactPage=${contact} form=${form} quote=${quote}`);}},

  {key:"action-book",category:"actions",weight:5,
   plainTitle:"A customer can book or reserve",whyItMatters:"For appointment businesses, booking is the whole conversion.",
   fix:"Publish a booking page at a stable URL that does not require running a script to reach.",fixType:"manual",
   run:c=>{if(!c.offersBooking)return null;
     const page=c.pages.some(p=>p.pageType==="booking");
     return grade(page?1:any(c.pages,s=>s.bookingSignals)?.5:0,page?"A booking page was found.":"Booking is mentioned but no booking page was reachable.","booking page discovery");}},

  {key:"action-navigate",category:"actions",weight:4,
   plainTitle:"AI can navigate your catalogue",whyItMatters:"Category pages and search let an assistant narrow down to the right item.",
   fix:"Expose category pages as normal links and provide a search route.",fixType:"manual",
   run:c=>{if(!c.sellsProducts)return null;
     const collection=c.pages.some(p=>p.pageType==="collection");const search=any(c.pages,s=>s.searchForm);
     return grade(collection&&search?1:collection||search?.5:0,collection&&search?"Category pages and search are available.":collection||search?"Only partial catalogue navigation was found.":"No catalogue navigation was found.",
       `collection=${collection} search=${search}`);}}
];

export function detectShape(pages:PageEvidence[]){
  // Whether to score catalogue and purchase checks at all. A service business that sells
  // nothing must not be marked down for having no products -- "not applicable" and
  // "failed" are different answers, and the build plan requires the distinction.
  const sellsProducts=pages.some(p=>p.pageType==="product"||p.pageType==="collection")
    ||pages.some(p=>p.signals.productSchema||p.signals.addToCart);
  const offersBooking=pages.some(p=>p.pageType==="booking")||pages.some(p=>p.signals.bookingSignals);
  return {sellsProducts,offersBooking};
}

export function scoreReport(input:{
  url:string;pages:PageEvidence[];platform:PlatformResult;robots?:string;llms?:string;sitemap:boolean;now?:string;
}):AgentReadyReport{
  const {pages,platform}=input;
  if(!pages.length)throw new Error("No pages could be read from that website.");
  const home=pages.find(p=>p.pageType==="home")||pages[0];
  const shape=detectShape(pages);
  const ctx:Ctx={pages,home,product:pages.find(p=>p.pageType==="product"),
    robots:input.robots,llms:input.llms,sitemap:input.sitemap,...shape};

  const checks:Check[]=[];
  for(const spec of SPECS){
    const result=spec.run(ctx);
    if(!result){
      checks.push({key:spec.key,category:spec.category,status:"na",points:0,maxPoints:0,
        plainTitle:spec.plainTitle,whyItMatters:spec.whyItMatters,
        evidence:"Not applicable to this kind of business.",technicalDetail:"check skipped",
        recommendedFix:"",fixType:"unavailable",estimatedGain:0});
      continue;
    }
    const points=Math.round(spec.weight*result.ratio);
    checks.push({key:spec.key,category:spec.category,status:result.status,points,maxPoints:spec.weight,
      plainTitle:spec.plainTitle,whyItMatters:spec.whyItMatters,evidence:result.evidence,
      technicalDetail:result.technical,recommendedFix:result.ratio>=.99?"":spec.fix,
      fixType:result.ratio>=.99?"unavailable":spec.fixType,estimatedGain:spec.weight-points});
  }

  // Category scores are normalised over applicable checks only, then re-weighted to the
  // published category totals so the headline is always out of 100.
  const categories=(Object.keys(CATEGORY_WEIGHTS) as Category[]).map(category=>{
    const inCat=checks.filter(c=>c.category===category&&c.status!=="na");
    const max=inCat.reduce((n,c)=>n+c.maxPoints,0);
    const got=inCat.reduce((n,c)=>n+c.points,0);
    const weight=CATEGORY_WEIGHTS[category];
    return {category,label:CATEGORY_LABELS[category],
      score:max?Math.round(got/max*100):0,
      points:max?Number((got/max*weight).toFixed(2)):0,
      maxPoints:max?weight:0};
  });

  const totalMax=categories.reduce((n,c)=>n+c.maxPoints,0);
  const totalGot=categories.reduce((n,c)=>n+c.points,0);
  const score=totalMax?Math.max(0,Math.min(100,Math.round(totalGot/totalMax*100))):0;
  const grade:AgentReadyReport["grade"]=score>=85?"Excellent":score>=70?"Good":score>=50?"Needs work":"Poor";

  return {
    url:input.url,domain:new URL(input.url).hostname,score,grade,scoringVersion:SCORING_VERSION,platform,
    categories,capabilities:summarize(checks,ctx),checks,pages,
    pointsRecoverable:Math.round(checks.reduce((n,c)=>n+(c.status==="na"?0:c.estimatedGain),0)),
    scannedAt:input.now||new Date().toISOString()
  };
}

function summarize(checks:Check[],ctx:Ctx):CapabilitySummary{
  const ok=(k:string)=>checks.find(c=>c.key===k)?.status==="pass";
  const applicable=(k:string)=>checks.find(c=>c.key===k)?.status!=="na";
  const understand:Array<[string,string]>=[
    ["business-identity","who your business is"],["business-description","what your business does"],
    ["business-contact","how to contact you"],["catalog-schema","your products in detail"],
    ["catalog-price","your prices"],["catalog-availability","what is in stock"],
    ["policy-shipping","your delivery terms"],["policy-returns","your returns terms"]
  ];
  const act:Array<[string,string]>=[
    ["action-purchase","send a customer to buy a product"],["action-enquire","send a customer to contact you"],
    ["action-book","send a customer to book with you"],["action-navigate","browse your catalogue"]
  ];
  return {
    canUnderstand:understand.filter(([k])=>applicable(k)&&ok(k)).map(([,l])=>l),
    cannotUnderstand:understand.filter(([k])=>applicable(k)&&!ok(k)).map(([,l])=>l),
    canDo:act.filter(([k])=>applicable(k)&&ok(k)).map(([,l])=>l),
    cannotDo:act.filter(([k])=>applicable(k)&&!ok(k)).map(([,l])=>l)
  };
}
