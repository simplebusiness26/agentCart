import type {Env} from "../types";
import {adminGraphql} from "../platform/shopify";
import {getBusinessProfile,getCatalog} from "../platform";
import type {ReadinessState} from "../providers/registry";

// Shopify agentic-commerce channel readiness (Phase 10.5). AgentCart DETECTS and guides; it does
// not duplicate Shopify's checkout stack.
//
// Much of what this needs is not reliably exposed by documented APIs today. Where that is true the
// capability is reported `unknown` with a merchant action, never guessed -- and never reported as
// a failure, because "we cannot see it" and "it is missing" are different facts.

export type FixClass="automatic"|"approval_required"|"merchant_account_action"|"platform_unavailable";

export interface ChannelCapability {
  key:string;
  label:string;
  state:ReadinessState;
  fixClass:FixClass;
  detail:string;
  evidence:string;
  nextAction:string;
}

const PUBLICATIONS=`query Pubs{ publications(first:25){ nodes{ id name } } }`;
const POLICIES=`query Pol{ shop{ shopPolicies{ type url body } } }`;

export async function assessChannel(env:Env,shop:string,token:string,countryCode?:string):Promise<ChannelCapability[]>{
  const out:ChannelCapability[]=[];
  const add=(c:ChannelCapability)=>out.push(c);

  // Region first: a market restriction is not a merchant failing, and must not read like one.
  const regionKnown=!!countryCode;
  const inRegion=countryCode?countryCode.toUpperCase()==="US":null;
  add({key:"region",label:"Agentic checkout is offered in your market",
    state:!regionKnown?"unknown":inRegion?"pass":"not_available_in_region",
    fixClass:inRegion===false?"platform_unavailable":"merchant_account_action",
    detail:!regionKnown
      ? "AgentCart does not know which market this store sells into, so it cannot say whether agentic checkout is available."
      : inRegion
      ? "Your market is one where agentic checkout is currently offered."
      : "Agentic checkout through this channel is not offered in your market yet. This is not a failing on your part and does not reduce your score.",
    evidence:countryCode?`store country: ${countryCode}`:"country unknown",
    nextAction:inRegion===false?"Nothing to do. AgentCart will report this as available if it launches in your market."
      :"Confirm your store's primary market in Shopify settings."});

  let publications:string[]=[];
  try{
    const data=await adminGraphql(env,shop,token,PUBLICATIONS);
    publications=(data?.publications?.nodes||[]).map((n:any)=>String(n?.name||""));
  }catch(e){
    add({key:"sales-channel",label:"Meta sales channel is connected",state:"unknown",
      fixClass:"merchant_account_action",
      detail:"AgentCart could not read your sales channels, so it cannot tell whether the Meta channel is connected.",
      evidence:e instanceof Error?e.message.slice(0,160):"publications query failed",
      nextAction:"Reconnect AgentCart, or check the Facebook & Instagram channel in your Shopify admin."});
  }

  if(publications.length){
    const meta=publications.find(n=>/facebook|instagram|meta/i.test(n));
    add({key:"sales-channel",label:"Meta sales channel is connected",
      state:meta?"pass":"fail",fixClass:"merchant_account_action",
      detail:meta?`The ${meta} channel is installed on this store.`
        :"The Facebook & Instagram by Meta sales channel is not installed, so products cannot reach Meta surfaces.",
      evidence:`publications: ${publications.slice(0,8).join(", ")||"none"}`,
      nextAction:meta?"No action needed."
        :"Install the Facebook & Instagram by Meta channel from the Shopify App Store. Only you can do this."});

    add({key:"product-sync",label:"Products are syncing to the channel",
      state:meta?"unknown":"fail",fixClass:"merchant_account_action",
      detail:meta?"AgentCart cannot confirm sync status through documented APIs, so this needs a visual check in your admin."
        :"Without the Meta channel installed, no products are syncing.",
      evidence:meta?"channel present; sync state not exposed by a documented API":"channel absent",
      nextAction:meta?"Open the Facebook & Instagram channel in Shopify and confirm your catalogue is published and approved."
        :"Install the channel first."});
  }

  // Catalogue completeness: this AgentCart can genuinely evaluate, and largely fix.
  const items=await getCatalog(env,shop,200,0);
  const incomplete=items.filter(i=>!i.title||i.price_min==null||!i.image_url||!i.description);
  add({key:"catalogue-eligibility",label:"Products carry the data a catalogue needs",
    state:!items.length?"unknown":incomplete.length?"fail":"pass",
    fixClass:"automatic",
    detail:!items.length?"No catalogue has been synced into AgentCart yet."
      :incomplete.length?`${incomplete.length} of ${items.length} products are missing a title, price, image or description.`
      :`All ${items.length} products carry a title, price, image and description.`,
    evidence:`${items.length} product(s) checked, ${incomplete.length} incomplete`,
    nextAction:incomplete.length?"AgentCart can fill missing descriptions for approval from the Fixes tab. Images and prices must be set in Shopify."
      :"No action needed."});

  // Required policies: agentic channels expect published policies.
  try{
    const data=await adminGraphql(env,shop,token,POLICIES);
    const policies=(data?.shop?.shopPolicies||[]).map((p:any)=>String(p?.type||"")).filter(Boolean);
    const required=["REFUND_POLICY","PRIVACY_POLICY","TERMS_OF_SERVICE"];
    const missing=required.filter(r=>!policies.includes(r));
    add({key:"required-policies",label:"Required policies are published",
      state:missing.length?"fail":"pass",fixClass:"approval_required",
      detail:missing.length?`Missing: ${missing.map(m=>m.toLowerCase().replace(/_/g," ")).join(", ")}.`
        :"Refund, privacy and terms policies are all published.",
      evidence:`published: ${policies.join(", ")||"none"}`,
      nextAction:missing.length?"Publish the missing policies in Shopify settings. AgentCart will not write legal text for you."
        :"No action needed."});
  }catch(e){
    add({key:"required-policies",label:"Required policies are published",state:"unknown",
      fixClass:"merchant_account_action",
      detail:"AgentCart could not read your shop policies.",
      evidence:e instanceof Error?e.message.slice(0,160):"policy query failed",
      nextAction:"Check policies in your Shopify settings."});
  }

  const profile=await getBusinessProfile(env,shop);
  add({key:"agentic-terms",label:"Agentic storefront terms are accepted",state:"unknown",
    fixClass:"merchant_account_action",
    detail:"Whether agentic storefront terms have been accepted is not exposed by a documented API, so AgentCart cannot confirm it.",
    evidence:profile?"store profile synced; terms state not available via API":"no store profile synced",
    nextAction:"Check the agentic commerce or channel settings in your Shopify admin and accept any pending terms."});

  return out;
}

export async function saveChannelCapabilities(env:Env,shop:string,caps:ChannelCapability[],nowMs=Date.now()){
  if(!caps.length)return;
  await env.DB.batch(caps.map(c=>env.DB.prepare(
    `INSERT INTO channel_capabilities(shop_domain,capability,state,fix_class,detail,evidence,checked_ms)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(shop_domain,capability) DO UPDATE SET state=excluded.state,fix_class=excluded.fix_class,
       detail=excluded.detail,evidence=excluded.evidence,checked_ms=excluded.checked_ms`)
    .bind(shop,c.key,c.state,c.fixClass,c.detail,c.evidence,nowMs)));
}

export async function getChannelCapabilities(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT * FROM channel_capabilities WHERE shop_domain=? ORDER BY capability")
    .bind(shop).all();
  return rows.results as Array<Record<string,unknown>>;
}
