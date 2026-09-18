import type {Env} from "../types";
import {ensurePublicMcpTarget} from "../agentpulse/store";

function safeMcpUrl(raw:string){
  const u=new URL(raw);if(u.protocol!=="https:")throw new Error("The public MCP URL must use HTTPS.");
  if(u.username||u.password)throw new Error("Do not put credentials in the MCP URL.");
  let credentialParam=false;u.searchParams.forEach((_value,key)=>{if(/key|token|secret|auth/i.test(key))credentialParam=true;});
  if(credentialParam)throw new Error("Do not put credentials in the MCP URL. Supply runtime credentials only when an authorised audit supports them.");
  u.hash="";return u.toString();
}
function cleanIndexes(input:unknown){return Array.isArray(input)?[...new Set(input.map(String).map(s=>s.trim()).filter(Boolean).slice(0,20))]:[];}

export async function algoliaAudit(env:Env,shop:string){
  const business=await env.DB.prepare("SELECT domain FROM businesses WHERE connected_shop_domain=? LIMIT 1")
    .bind(shop).first<{domain:string}>();
  let signals:{detected:boolean;recommend:boolean;analytics:boolean;adminKeyRisk:boolean;pages:number}={detected:false,recommend:false,analytics:false,adminKeyRisk:false,pages:0};
  if(business){
    const run=await env.DB.prepare("SELECT id FROM scan_runs WHERE domain=? AND status='complete' ORDER BY started_ms DESC LIMIT 1")
      .bind(business.domain).first<{id:string}>();
    if(run){const pages=(await env.DB.prepare("SELECT evidence_json FROM scan_pages WHERE scan_run_id=?").bind(run.id).all<any>()).results;
      signals.pages=pages.length;
      for(const page of pages){let e:any={};try{e=JSON.parse(String(page.evidence_json||"{}"));}catch{/* unknown */}
        signals.detected||=!!e.algoliaDetected;signals.recommend||=!!e.algoliaRecommendSignals;
        signals.analytics||=!!e.algoliaAnalyticsSignals;signals.adminKeyRisk||=!!e.algoliaAdminKeyRisk;}}
  }
  const connection=await env.DB.prepare("SELECT * FROM algolia_connections WHERE shop_domain=?").bind(shop).first<any>();
  const pulse=connection?.public_mcp_url?await env.DB.prepare(`SELECT status,evidence_json,completed_ms FROM agentpulse_runs
    WHERE target_id IN (SELECT id FROM agentpulse_targets WHERE shop_domain=? AND journey='algolia_public_mcp')
    ORDER BY started_ms DESC LIMIT 1`).bind(shop).first<any>():null;
  let capabilities:string[]=[];try{capabilities=JSON.parse(String(pulse?.evidence_json||"{}")).capabilities||[];}catch{/* unknown */}
  return {detected:signals.detected||!!Number(connection?.detected),signals,connection:connection?{
      applicationId:connection.application_id||null,indexNames:JSON.parse(String(connection.index_names_json||"[]")),
      publicMcpUrl:connection.public_mcp_url||null,updatedMs:Number(connection.updated_ms)}:null,
    publicMcp:pulse?{status:pulse.status,completedMs:Number(pulse.completed_ms),capabilities}:null,
    checks:{search:capabilities.includes("search")?"observed":"unknown",facets:capabilities.includes("facets")?"observed":"unknown",
      recommendations:capabilities.includes("recommendations")||signals.recommend?"observed":"unknown",
      analytics:signals.analytics?"observed":"unknown",credentialScope:signals.adminKeyRisk?"risk":"unknown",
      priceAvailability:"requires_authorised_query"},
    note:signals.detected||connection
      ? "Algolia is treated as an existing retrieval layer. AgentCart checks observable capabilities and never requests or stores an Admin key."
      : "Algolia was not detected. That is not a failure and does not reduce readiness."};
}

export async function saveAlgoliaConnection(env:Env,shop:string,input:{applicationId?:string;indexNames?:unknown;publicMcpUrl?:string},nowMs=Date.now()){
  const applicationId=String(input.applicationId||"").trim();
  if(applicationId&&!/^[A-Z0-9]{4,20}$/i.test(applicationId))throw new Error("That Algolia application ID is not valid.");
  const indexes=cleanIndexes(input.indexNames),mcp=input.publicMcpUrl?safeMcpUrl(input.publicMcpUrl):null;
  await env.DB.prepare(`INSERT INTO algolia_connections(shop_domain,application_id,index_names_json,public_mcp_url,detected,detection_evidence_json,updated_ms)
    VALUES(?,?,?,?,1,?,?) ON CONFLICT(shop_domain) DO UPDATE SET application_id=excluded.application_id,
    index_names_json=excluded.index_names_json,public_mcp_url=excluded.public_mcp_url,updated_ms=excluded.updated_ms`)
    .bind(shop,applicationId||null,JSON.stringify(indexes),mcp,JSON.stringify({source:"merchant_supplied_public_metadata"}),nowMs).run();
  if(mcp)await ensurePublicMcpTarget(env,{shop,label:"Algolia Public MCP",endpoint:mcp,journey:"algolia_public_mcp"},nowMs);
  return algoliaAudit(env,shop);
}

/** Runs a single authorised search with a key supplied for this request only. The key is placed in
 * the outbound header and is never logged, returned or stored. AgentCart asks for a restricted
 * Search key; it has no operation that needs an Admin key. */
export async function runAuthorizedAlgoliaAudit(env:Env,shop:string,input:{applicationId:string;indexName:string;
  searchKey:string;query:string;filters?:string},fetcher:typeof fetch=fetch,nowMs=Date.now()){
  const app=input.applicationId.trim(),index=input.indexName.trim(),query=input.query.trim();
  if(!/^[A-Z0-9]{4,20}$/i.test(app))throw new Error("A valid Algolia application ID is required.");
  if(!index||index.length>160)throw new Error("A valid Algolia index name is required.");
  if(!input.searchKey||input.searchKey.length>500)throw new Error("A restricted Algolia Search key is required for this one-time audit.");
  if(!query)throw new Error("Use a representative buyer-intent query.");
  const id=`alg_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,8)}`,started=Date.now();
  let status="failed",hitCount:null|number=null,price=false,availability=false,facets=false,errorCode:string|null=null;
  try{
    const res=await fetcher(`https://${app.toLowerCase()}-dsn.algolia.net/1/indexes/${encodeURIComponent(index)}/query`,{
      method:"POST",headers:{"content-type":"application/json","x-algolia-application-id":app,"x-algolia-api-key":input.searchKey},
      body:JSON.stringify({query:query.slice(0,300),hitsPerPage:5,facets:["*"],maxValuesPerFacet:5,
        analytics:false,...(input.filters?{filters:input.filters.slice(0,500)}:{})}),redirect:"error"});
    const text=await res.text();if(text.length>512_000)throw new Error("response_too_large");
    if(!res.ok){errorCode=`http_${res.status}`;throw new Error(errorCode);}
    const body=JSON.parse(text),hits=Array.isArray(body.hits)?body.hits:[];hitCount=Number(body.nbHits??hits.length);
    const names=hits.flatMap((h:any)=>h&&typeof h==="object"?Object.keys(h):[]).map((k:string)=>k.toLowerCase());
    price=names.some((k:string)=>/price|amount|cost/.test(k));availability=names.some((k:string)=>/availability|inventory|stock/.test(k));
    facets=!!body.facets&&typeof body.facets==="object";status="pass";
  }catch(e){if(!errorCode)errorCode=e instanceof Error?e.message.slice(0,120):"audit_failed";}
  const latency=Math.max(0,Date.now()-started);
  await env.DB.prepare(`INSERT INTO algolia_audit_runs(id,shop_domain,index_name,query_label,status,latency_ms,hit_count,
    price_observed,availability_observed,facets_observed,error_code,checked_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,shop,index,query.slice(0,120),status,latency,hitCount,price?1:0,availability?1:0,facets?1:0,errorCode,nowMs).run();
  return {id,status,index,query:query.slice(0,120),latencyMs:latency,hitCount,priceObserved:price,
    availabilityObserved:availability,facetsObserved:facets,errorCode,
    note:"The Search key was used ephemerally and was not stored. This proves only the supplied index/query at this time."};
}
