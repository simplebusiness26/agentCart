import type {Env} from "../types";
import type {BusinessBrain} from "../salesagent";

const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const id=(prefix:string,now=Date.now())=>`${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const date=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):null;

export interface MerchantAiMetrics {
  shareOfVoice?:number;competitorAverageShare?:number;frequency?:number;productsShowing?:number;
  stages?:Record<string,number>;topTerms?:Array<{term:string;frequency:number}>;
  popularAttributes?:Array<{attribute:string;frequency:number}>;searchIntents?:Array<{intent:string;frequency:number}>;
}

export async function importMerchantAiPerformance(env:Env,shop:string,input:{merchantAccountId?:unknown;category?:unknown;country?:unknown;language?:unknown;windowStart?:unknown;windowEnd?:unknown;organicOnly?:unknown;metrics?:MerchantAiMetrics},nowMs=Date.now()){
  const windowStart=date(input.windowStart),windowEnd=date(input.windowEnd),account=clean(input.merchantAccountId,80),category=clean(input.category,160),country=clean(input.country,8),language=clean(input.language,16);
  if(!account||!category||!country||!language||!windowStart||!windowEnd)throw new Error("Merchant account, category, country, language and YYYY-MM-DD window are required.");
  if(input.organicOnly!==true)throw new Error("This importer accepts organic Merchant Center AI performance evidence only; paid evidence must remain separate.");
  const metrics=input.metrics&&typeof input.metrics==="object"?input.metrics:{};
  const recordId=id("mcai",nowMs);
  await env.DB.prepare(`INSERT INTO merchant_ai_performance_imports(id,shop_domain,merchant_account_id,category,country,language,window_start,window_end,evidence_tier,organic_only,metrics_json,imported_ms)
    VALUES(?,?,?,?,?,?,?,?,?,1,?,?)`).bind(recordId,shop,account,category,country,language,windowStart,windowEnd,"authorised_merchant_export",JSON.stringify(metrics),nowMs).run();
  const actions=[...(metrics.topTerms||[]).slice(0,20).map(x=>({route:"content",reason:`High-frequency conversational term: ${clean(x.term,160)}`})),
    ...(metrics.popularAttributes||[]).slice(0,20).map(x=>({route:"catalog",reason:`Popular product attribute: ${clean(x.attribute,160)}`}))];
  return {id:recordId,evidenceTier:"authorised_merchant_export",scope:{account,category,country,language,windowStart,windowEnd,organicOnly:true},metrics,actions,
    note:"Google's reported metrics retain their account, category, geography, language and time-window scope; they are not relabelled as AgentReady metrics."};
}

export function conversationalProductReadiness(brain:BusinessBrain){
  const items=brain.items.map(item=>{
    const verified=brain.facts.filter(f=>f.sourceRecordId===item.id&&f.confidence==="verified");
    const fields={title:!!item.title,description:!!item.description,productLink:/^https:\/\//.test(item.url),itemGroupTitle:!!item.title,
      variantOptions:!!item.variants?.length&&item.variants.every(v=>!!v.title&&!!v.id),documentLinks:false,questionsAndAnswers:false,relatedProducts:false};
    const missing=Object.entries(fields).filter(([,present])=>!present).map(([key])=>key);
    return {itemId:item.id,title:item.title,fields,missing,sourceFacts:verified.map(f=>f.key),
      preview:{title:item.title,link:item.url,variants:(item.variants||[]).map(v=>({id:v.id,title:v.title,available:v.available}))}};
  });
  return {brainVersion:brain.version,items,ready:items.filter(x=>x.missing.length===0).length,total:items.length,uploaded:false,
    rule:"Recommendations and previews use verified connected-catalogue facts only. No Merchant Center write occurs from this endpoint."};
}

export async function saveShopifyAgenticChannelObservation(env:Env,shop:string,input:{channel?:unknown;discoveryEnabled?:unknown;directCheckoutEnabled?:unknown;unsupported?:unknown[];source?:unknown},nowMs=Date.now()){
  const channel=clean(input.channel,80).toLowerCase();if(!["chatgpt","google","microsoft_copilot","meta"].includes(channel))throw new Error("Choose a supported Shopify agentic channel.");
  const source=clean(input.source,80);if(source!=="shopify_admin_authorized")throw new Error("Channel state must come from an authorised Shopify Admin observation.");
  const direct=input.directCheckoutEnabled===true,recordId=id("channel",nowMs),unsupported=(Array.isArray(input.unsupported)?input.unsupported:[]).map(x=>clean(x,160)).filter(Boolean).slice(0,100);
  await env.DB.prepare(`INSERT INTO shopify_agentic_channel_observations(id,shop_domain,channel,discovery_enabled,direct_checkout_enabled,attribution_source,unsupported_json,evidence_tier,observed_ms)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(recordId,shop,channel,input.discoveryEnabled===true?1:0,direct?1:0,direct?"shopify_channel_server":"browser_or_shopify",JSON.stringify(unsupported),"authorised_shopify_admin",nowMs).run();
  return {id:recordId,channel,discoveryEnabled:input.discoveryEnabled===true,directCheckoutEnabled:direct,unsupported,
    attributionSource:direct?"shopify_channel_server":"browser_or_shopify",evidenceTier:"authorised_shopify_admin",
    warning:direct?"Do not infer direct-checkout outcomes from browser pixels; use Shopify channel/server evidence.":null};
}

export async function merchantAiChannelReport(env:Env,shop:string,brain:BusinessBrain){
  const [performance,channels]=await Promise.all([
    env.DB.prepare("SELECT * FROM merchant_ai_performance_imports WHERE shop_domain=? ORDER BY imported_ms DESC LIMIT 25").bind(shop).all<any>(),
    env.DB.prepare("SELECT * FROM shopify_agentic_channel_observations WHERE shop_domain=? ORDER BY observed_ms DESC LIMIT 25").bind(shop).all<any>()
  ]);
  return {merchantAiPerformance:performance.results.map(row=>({...row,metrics:JSON.parse(String(row.metrics_json||"{}"))})),
    conversationalProducts:conversationalProductReadiness(brain),
    shopifyChannels:channels.results.map(row=>({...row,unsupported:JSON.parse(String(row.unsupported_json||"[]"))})),
    statusRule:"Imported or observed evidence is not Live until a production connection and end-to-end outcome are verified."};
}
