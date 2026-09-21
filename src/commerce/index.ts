import type {Env} from "../types";
import {assertScannableUrl} from "../scanner";
import type {BusinessBrain,BrainItem} from "../salesagent";
import {providerAccess} from "../providers/robots";

const CURRENT_UCP_VERSION="2026-08-25";
const MAX_PROFILE_BYTES=512_000;
const CORE_OPENAI_FIELDS=["item_id","title","description","url","brand","seller_name","image_url","availability","price"] as const;

const id=(prefix:string,now=Date.now())=>`${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const object=(value:unknown):Record<string,any>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};
const list=(value:unknown)=>Array.isArray(value)?value.map(String):[];

export interface UcpObservation {
  status:"observed_current"|"observed_other_version"|"not_found"|"invalid"|"unreachable";
  discoveryUrl:string;
  version:string|null;
  supportedVersions:string[];
  services:Record<string,unknown>;
  capabilities:Record<string,unknown>;
  current:boolean;
  catalogue:boolean;
  cart:boolean;
  checkout:boolean;
  orders:boolean;
  endpoints:Array<{service:string;transport:string|null;endpoint:string|null;version:string|null}>;
  limitations:string[];
  adsReadiness?:{robots:"pass"|"fail"|"unknown";landing:"pass"|"fail"|"unknown";status:number|null;note:string};
}

/** Parse observable UCP data without assuming that every Shopify store has every capability. */
export function parseUcpProfile(raw:unknown,discoveryUrl="https://example.invalid/.well-known/ucp"):UcpObservation{
  const root=object(raw),ucp=object(root.ucp&&typeof root.ucp==="object"?root.ucp:root);
  const version=ucp.version==null?null:String(ucp.version);
  const supported=[...new Set([version,...list(ucp.supported_versions??ucp.supportedVersions)].filter((v):v is string=>!!v))];
  const services=object(ucp.services),capabilities=object(ucp.capabilities);
  const capKeys=Object.keys(capabilities).map(v=>v.toLowerCase());
  const has=(name:string)=>capKeys.some(k=>k===name||k.endsWith(`.${name}`)||k.includes(name));
  const endpoints=Object.entries(services).map(([service,value])=>{const v=object(value);return {service,
    transport:v.transport==null?null:String(v.transport),endpoint:v.endpoint==null?null:String(v.endpoint),
    version:v.version==null?null:String(v.version)};});
  const limitations:string[]=[];
  if(!version)limitations.push("The profile does not declare a UCP version.");
  if(!Object.keys(services).length)limitations.push("The profile does not declare a service transport.");
  if(!Object.keys(capabilities).length)limitations.push("The profile does not declare capabilities.");
  for(const endpoint of endpoints)if(endpoint.endpoint){try{const u=new URL(endpoint.endpoint);if(u.protocol!=="https:")limitations.push(`${endpoint.service} does not use HTTPS.`);}catch{limitations.push(`${endpoint.service} has an invalid endpoint.`);}}
  const valid=!!version&&Object.keys(services).length>0;
  return {status:valid?(supported.includes(CURRENT_UCP_VERSION)?"observed_current":"observed_other_version"):"invalid",
    discoveryUrl,version,supportedVersions:supported,services,capabilities,current:supported.includes(CURRENT_UCP_VERSION),
    catalogue:has("catalog")||has("catalogue"),cart:has("cart"),checkout:has("checkout"),orders:has("order"),endpoints,limitations};
}

async function limitedJson(res:Response){
  if(Number(res.headers.get("content-length")||0)>MAX_PROFILE_BYTES)throw new Error("profile_too_large");
  const text=(await res.text()).slice(0,MAX_PROFILE_BYTES+1);if(text.length>MAX_PROFILE_BYTES)throw new Error("profile_too_large");
  return JSON.parse(text);
}

export async function probeNativeUcp(env:Env,shop:string,siteUrl:string,fetcher:typeof fetch=fetch,nowMs=Date.now()){
  const root=assertScannableUrl(siteUrl),discovery=new URL("/.well-known/ucp",root.origin).toString();
  let result:UcpObservation;
  try{
    const res=await fetcher(discovery,{headers:{accept:"application/json","user-agent":"AgentReadyUcpProbe/1.0"},redirect:"error"});
    if(res.status===404)result={...parseUcpProfile({},discovery),status:"not_found"};
    else if(!res.ok)result={...parseUcpProfile({},discovery),status:"unreachable",limitations:[`Discovery returned HTTP ${res.status}.`]};
    else result=parseUcpProfile(await limitedJson(res),discovery);
  }catch(e){result={...parseUcpProfile({},discovery),status:"unreachable",limitations:[e instanceof Error?e.message:"UCP discovery failed."]};}
  const adsReadiness=await probeOpenAiAds(root,fetcher);result.adsReadiness=adsReadiness;
  await env.DB.prepare(`INSERT INTO ucp_observations(id,shop_domain,discovery_url,status,ucp_version,supported_versions_json,
    services_json,capabilities_json,evidence_json,checked_ms) VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(id("ucp",nowMs),shop,discovery,result.status,result.version,JSON.stringify(result.supportedVersions),JSON.stringify(result.services),
      JSON.stringify(result.capabilities),JSON.stringify({current:result.current,catalogue:result.catalogue,cart:result.cart,
        checkout:result.checkout,orders:result.orders,endpoints:result.endpoints,limitations:result.limitations,adsReadiness}),nowMs).run();
  return result;
}

async function probeOpenAiAds(root:URL,fetcher:typeof fetch){
  let robotsText:string|undefined,status:number|null=null,landing:"pass"|"fail"|"unknown"="unknown";
  try{const robots=await fetcher(new URL("/robots.txt",root.origin),{headers:{"user-agent":"AgentReadyAdsDiagnostic/1.0"},redirect:"error"});if(robots.ok)robotsText=(await robots.text()).slice(0,50_000);}catch{/* unknown */}
  try{const res=await fetcher(root.toString(),{method:"GET",headers:{"user-agent":"OAI-AdsBot","accept":"text/html"},redirect:"error"});status=res.status;landing=res.ok?"pass":"fail";await res.body?.cancel();}catch{landing="unknown";}
  const openai=providerAccess(robotsText).find(p=>p.provider==="openai"),ads=openai?.agents.find(a=>a.agent.purpose==="advertising");
  return {robots:!ads?"unknown" as const:ads.allowed?"pass" as const:"fail" as const,landing,status,
    note:"This is an advertising landing-page diagnostic only. It never changes organic/search readiness."};
}

function price(item:BrainItem){return item.priceMin==null||!item.currency?"":`${item.priceMin.toFixed(2)} ${item.currency}`;}
export function openAiCommerceFeed(brain:BusinessBrain,nowMs=Date.now(),freshForMs=24*60*60*1000){
  const rows=brain.items.map(item=>({item_id:item.id,title:item.title,description:item.description,url:item.url,brand:item.vendor,
    seller_name:brain.name,image_url:item.imageUrl||"",availability:item.available?"in_stock":"out_of_stock",price:price(item),
    item_group_id:(item.variants?.length||0)>1?item.id:undefined,last_verified_ms:item.syncedMs,
    variant_identity_valid:!item.variants?.length||new Set(item.variants.map(v=>v.id).filter(Boolean)).size===item.variants.length}));
  const items=rows.map(row=>{const missing=CORE_OPENAI_FIELDS.filter(field=>!String(row[field]??"").trim());
    const stale=nowMs-Number(row.last_verified_ms)>freshForMs;return {...row,missing,stale,eligible:missing.length===0&&!stale&&row.variant_identity_valid};});
  return {format:"openai_product_feed_preview_v1",coreFields:CORE_OPENAI_FIELDS,brainVersion:brain.version,generatedMs:nowMs,
    items,summary:{total:items.length,eligible:items.filter(i=>i.eligible).length,missingFields:items.filter(i=>i.missing.length).length,
      stale:items.filter(i=>i.stale).length,variantGroups:items.filter(i=>i.item_group_id).length,variantIdentityIssues:items.filter(i=>!i.variant_identity_valid).length},
    policy:"Preview only. AgentReady never uploads this feed without merchant authorization and provider credentials."};
}

export function feedJsonl(feed:ReturnType<typeof openAiCommerceFeed>){
  return feed.items.map(({missing,stale,eligible,last_verified_ms,variant_identity_valid,...row})=>JSON.stringify(row)).join("\n")+(feed.items.length?"\n":"");
}

export async function saveFeedExport(env:Env,shop:string,feed:ReturnType<typeof openAiCommerceFeed>,nowMs=Date.now()){
  const exportId=id("feed",nowMs);await env.DB.prepare(`INSERT INTO commerce_feed_exports(id,shop_domain,format,brain_version,item_count,
    eligible_count,stale_count,summary_json,created_ms) VALUES(?,?,?,?,?,?,?,?,?)`).bind(exportId,shop,feed.format,feed.brainVersion,
      feed.summary.total,feed.summary.eligible,feed.summary.stale,JSON.stringify(feed.summary),nowMs).run();return exportId;
}

export interface LighthouseAgenticAudit {id:string;title:string;score:number|null;state:"pass"|"fail"|"unknown";description?:string;}
export function parseLighthouseAgenticReport(raw:unknown){
  const report=object(raw),audits=object(report.audits),categories=object(report.categories);
  const category=object(categories["agentic-browsing"]||categories.agenticBrowsing);
  const refs=Array.isArray(category.auditRefs)?category.auditRefs:[];
  const wanted=refs.length?refs.map((r:any)=>String(r?.id||"")).filter(Boolean):Object.keys(audits).filter(k=>/webmcp|agent|llms|layout-shift|accessib/i.test(k));
  const rows:LighthouseAgenticAudit[]=wanted.map(key=>{const a=object(audits[key]),score=typeof a.score==="number"?a.score:null;
    return {id:key,title:String(a.title||key),score,state:score==null?"unknown":score>=1?"pass":"fail",description:a.description?String(a.description):undefined};});
  const passed=rows.filter(r=>r.state==="pass").length,failed=rows.filter(r=>r.state==="fail").length,unknown=rows.filter(r=>r.state==="unknown").length;
  const fraction=typeof category.score==="number"?category.score:passed+failed?passed/(passed+failed):null;
  return {source:"lighthouse_agentic_browsing",sourceVersion:report.lighthouseVersion?String(report.lighthouseVersion):null,
    fraction,passed,failed,unknown,audits:rows,note:"The Lighthouse fraction is preserved separately and is not copied into AgentReady's 0–100 business-readiness score."};
}

export async function saveLighthouseAgenticReport(env:Env,shop:string,raw:unknown,nowMs=Date.now()){
  const parsed=parseLighthouseAgenticReport(raw);if(!parsed.audits.length)throw new Error("No Lighthouse Agentic Browsing audits were found.");
  const auditId=id("lh",nowMs);await env.DB.prepare(`INSERT INTO agentic_browser_audits(id,shop_domain,source,source_version,fraction,
    passed,failed,unknown,audits_json,checked_ms) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(auditId,shop,parsed.source,parsed.sourceVersion,
      parsed.fraction,parsed.passed,parsed.failed,parsed.unknown,JSON.stringify(parsed.audits),nowMs).run();return {id:auditId,...parsed};
}

export async function commerceReadiness(env:Env,shop:string,brain:BusinessBrain){
  const feed=openAiCommerceFeed(brain);
  const ucp=await env.DB.prepare("SELECT * FROM ucp_observations WHERE shop_domain=? ORDER BY checked_ms DESC LIMIT 1").bind(shop).first();
  const lighthouse=await env.DB.prepare("SELECT * FROM agentic_browser_audits WHERE shop_domain=? ORDER BY checked_ms DESC LIMIT 1").bind(shop).first();
  return {ucp:ucp||null,openAiFeed:{...feed,items:feed.items.slice(0,25)},lighthouse:lighthouse||null,
    ads:{state:"separate_check",note:"OAI-AdsBot access is advertising readiness and never reduces the organic AgentReady score."}};
}

export {CURRENT_UCP_VERSION,CORE_OPENAI_FIELDS};
