import type {Env} from "../types";
import type {BusinessBrain,GroundedReply,SalesAgentAction,SalesAgentConfig,SalesAgentStatus} from "./types";

const SAFE_ACTIONS=["view_item","contact","request_quote","booking_handoff","cart_handoff","checkout_handoff","human_escalation"];
function parseArray(value:unknown):string[]{try{const v=JSON.parse(String(value||"[]"));return Array.isArray(v)?v.map(String):[];}catch{return [];}}
function parseObject(value:unknown):Record<string,string>{try{const v=JSON.parse(String(value||"{}"));return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}catch{return {};}}
const clean=(value:string,max=500)=>value.trim().slice(0,max);
const id=(prefix:string,now=Date.now())=>`${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`;

function rowToConfig(row:Record<string,unknown>):SalesAgentConfig{
  return {id:String(row.id),shop:String(row.shop_domain),publicId:String(row.public_id),status:String(row.status) as SalesAgentStatus,
    displayName:String(row.display_name),purpose:String(row.purpose),tone:parseArray(row.tone_json),
    supportedIntents:parseArray(row.supported_intents_json),allowedScopes:parseArray(row.allowed_scopes_json),
    allowedActions:parseArray(row.allowed_actions_json),escalation:parseObject(row.escalation_json),
    unsupportedTopics:parseArray(row.unsupported_topics_json),locale:String(row.locale||"en-GB"),
    version:Number(row.config_version||1),createdMs:Number(row.created_ms),updatedMs:Number(row.updated_ms)};
}

export async function getSalesAgent(env:Env,shop:string){
  const row=await env.DB.prepare("SELECT * FROM ai_sales_agents WHERE shop_domain=? ORDER BY updated_ms DESC LIMIT 1")
    .bind(shop).first<Record<string,unknown>>();
  return row?rowToConfig(row):null;
}

export async function ensureSalesAgent(env:Env,shop:string,businessName:string,nowMs=Date.now()){
  const existing=await getSalesAgent(env,shop);if(existing)return existing;
  const agentId=id("agent",nowMs),publicId=id("sales",nowMs);
  const config={tone:["clear","helpful","honest"],intents:["discovery","price","availability","policy","contact","handoff"],
    scopes:["identity","catalog","policies","public_actions"],actions:["view_item","contact","request_quote","cart_handoff","checkout_handoff","human_escalation"],
    escalation:{message:"I do not have verified information for that. Please contact the business."}};
  await env.DB.prepare(`INSERT INTO ai_sales_agents(id,shop_domain,public_id,status,display_name,purpose,tone_json,
    supported_intents_json,allowed_scopes_json,allowed_actions_json,escalation_json,unsupported_topics_json,locale,
    config_version,created_ms,updated_ms) VALUES(?,?,?,'draft',?,?,?,?,?,?,?,?,?,1,?,?)`)
    .bind(agentId,shop,publicId,`${clean(businessName,120)} AI`,"Help customers using verified business facts.",
      JSON.stringify(config.tone),JSON.stringify(config.intents),JSON.stringify(config.scopes),JSON.stringify(config.actions),
      JSON.stringify(config.escalation),JSON.stringify(["legal advice","medical advice","financial advice"]),"en-GB",nowMs,nowMs).run();
  const created=await getSalesAgent(env,shop);if(!created)throw new Error("Could not create the Sales Agent.");
  await snapshotAgent(env,created,"Initial structured configuration",nowMs);
  return created;
}

export async function snapshotAgent(env:Env,agent:SalesAgentConfig,note:string,nowMs=Date.now()){
  await env.DB.prepare(`INSERT OR IGNORE INTO ai_sales_agent_versions(id,agent_id,version,config_json,change_note,created_ms)
    VALUES(?,?,?,?,?,?)`).bind(id("agentv",nowMs),agent.id,agent.version,JSON.stringify(agent),clean(note,300),nowMs).run();
}

export async function updateSalesAgent(env:Env,shop:string,input:Partial<Pick<SalesAgentConfig,"displayName"|"purpose"|"tone"|"supportedIntents"|"allowedScopes"|"allowedActions"|"escalation"|"unsupportedTopics"|"locale">>,nowMs=Date.now()){
  const current=await getSalesAgent(env,shop);if(!current)throw new Error("Create the Sales Agent first.");
  const next={...current,...input,displayName:clean(input.displayName??current.displayName,120),purpose:clean(input.purpose??current.purpose,400),
    tone:(input.tone??current.tone).map(v=>clean(v,80)).slice(0,12),supportedIntents:(input.supportedIntents??current.supportedIntents).map(v=>clean(v,80)).slice(0,30),
    allowedScopes:(input.allowedScopes??current.allowedScopes).map(v=>clean(v,80)).slice(0,30),
    allowedActions:(input.allowedActions??current.allowedActions).filter(v=>SAFE_ACTIONS.includes(v)),
    unsupportedTopics:(input.unsupportedTopics??current.unsupportedTopics).map(v=>clean(v,120)).slice(0,30),
    escalation:input.escalation??current.escalation,locale:clean(input.locale??current.locale,20),version:current.version+1,updatedMs:nowMs};
  await env.DB.prepare(`UPDATE ai_sales_agents SET display_name=?,purpose=?,tone_json=?,supported_intents_json=?,
    allowed_scopes_json=?,allowed_actions_json=?,escalation_json=?,unsupported_topics_json=?,locale=?,config_version=?,updated_ms=?
    WHERE id=? AND shop_domain=?`).bind(next.displayName,next.purpose,JSON.stringify(next.tone),JSON.stringify(next.supportedIntents),
      JSON.stringify(next.allowedScopes),JSON.stringify(next.allowedActions),JSON.stringify(next.escalation),
      JSON.stringify(next.unsupportedTopics),next.locale,next.version,nowMs,current.id,shop).run();
  await snapshotAgent(env,next,"Merchant configuration update",nowMs);return next;
}

export async function setSalesAgentStatus(env:Env,shop:string,status:SalesAgentStatus,nowMs=Date.now()){
  const agent=await getSalesAgent(env,shop);if(!agent)throw new Error("Create the Sales Agent first.");
  await env.DB.prepare("UPDATE ai_sales_agents SET status=?,updated_ms=? WHERE id=? AND shop_domain=?")
    .bind(status,nowMs,agent.id,shop).run();
  return {...agent,status,updatedMs:nowMs};
}

const tokens=(value:string)=>new Set(value.toLowerCase().replace(/[^a-z0-9£$€]+/g," ").split(/\s+/).filter(v=>v.length>2));
function matchScore(query:string,value:string){const q=tokens(query),v=tokens(value);let n=0;for(const t of q)if(v.has(t))n++;return n;}
function money(item:BusinessBrain["items"][number]){if(item.priceMin==null)return "a price that is not currently verified";const symbol=item.currency==="GBP"?"£":item.currency==="USD"?"$":item.currency==="EUR"?"€":`${item.currency||""} `;return `${symbol}${item.priceMin}${item.priceMax!=null&&item.priceMax!==item.priceMin?`–${symbol}${item.priceMax}`:""}`;}

export function groundedReply(brain:BusinessBrain,agent:SalesAgentConfig,message:string):GroundedReply{
  const q=clean(message,1000),lower=q.toLowerCase(),warnings:string[]=[];
  if(agent.status==="paused")return {text:"This business agent is currently paused. Please contact the business directly.",intent:"paused",factsUsed:[],itemIds:[],unknown:true,escalation:true,warnings:["agent_paused"]};
  if(agent.unsupportedTopics.some(t=>lower.includes(t.toLowerCase())))return {text:agent.escalation.message||"I cannot help with that topic.",intent:"unsupported",factsUsed:[],itemIds:[],unknown:true,escalation:true,warnings:["unsupported_topic"]};
  const isReturns=/return|refund|exchange/.test(lower),isShipping=/deliver|shipping|postage|arrive/.test(lower),isContact=/contact|phone|email|speak|human/.test(lower);
  if(isReturns||isShipping){
    const key=Object.keys(brain.policies).find(k=>(isReturns?/return|refund|exchange/:/shipping|delivery|postage/).test(k.toLowerCase()));
    if(key){const value=brain.policies[key];return {text:`According to ${brain.name}'s verified ${key.replace(/[_-]/g," ")} policy: ${typeof value==="string"?value:JSON.stringify(value)}`.slice(0,1200),intent:"policy",factsUsed:[`policy.${key}`],itemIds:[],unknown:false,escalation:false,warnings};}
  }
  if(isContact){
    const method=brain.contact.email||brain.contact.phone;
    if(method)return {text:`You can contact ${brain.name} using ${method}.`,intent:"contact",factsUsed:[brain.contact.email?"business.contact.email":"business.contact.phone"],itemIds:[],unknown:false,escalation:false,warnings,
      action:{type:"contact",mode:"handoff",url:brain.website,authorizationRequired:false,approvalRequired:false,testSupported:true,verification:["Open the published business contact route."]}};
  }
  const ranked=brain.items.map(item=>({item,score:matchScore(q,`${item.title} ${item.description} ${item.category} ${item.vendor}`)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  if(best&&best.score>0){
    const availability=best.item.available?"listed as available":"currently listed as unavailable";
    return {text:`${best.item.title} is ${money(best.item)} and is ${availability}. ${best.item.description}`.trim().slice(0,1200),intent:/price|cost|£|\$|€/.test(lower)?"price":"product_discovery",
      factsUsed:[`catalog.${best.item.id}.identity`,`catalog.${best.item.id}.price`,`catalog.${best.item.id}.availability`],itemIds:[best.item.id],unknown:false,escalation:false,warnings,
      action:{type:"view_item",mode:"handoff",url:best.item.url,authorizationRequired:false,approvalRequired:false,testSupported:true,verification:["Fetch the canonical item URL."]}};
  }
  warnings.push("no_verified_answer");
  return {text:agent.escalation.message||"I do not have verified information for that. Please contact the business.",intent:"unknown",factsUsed:[],itemIds:[],unknown:true,escalation:true,warnings};
}
