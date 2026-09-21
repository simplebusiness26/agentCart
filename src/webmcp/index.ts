import type {Env} from "../types";
import type {BusinessBrain} from "../salesagent";
import {assessAgentInteractionSecurity,type SecurityTool} from "../security/agent";

export type ActionMode="read"|"handoff"|"write";
export interface PlannedAction {name:string;mode:ActionMode;description:string;source:string;applicable:boolean;reason:string;inputSchema:Record<string,unknown>;verification:string[];}
const id=(prefix:string,now=Date.now())=>`${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);

export function mapBusinessActions(brain:BusinessBrain):PlannedAction[]{
  const catalogue=brain.items.length>0,contact=!!(brain.contact.email||brain.contact.phone),site=/^https:\/\//.test(brain.website);
  const actions:PlannedAction[]=[
    {name:"search_products",mode:"read",description:"Search the connected product catalogue.",source:"connected_catalog",applicable:catalogue,reason:catalogue?"A connected catalogue exists.":"No connected product catalogue exists.",inputSchema:{type:"object",properties:{query:{type:"string"}},required:["query"],additionalProperties:false},verification:["Compare returned item IDs and titles with the connected catalogue."]},
    {name:"get_product",mode:"read",description:"Read one connected product.",source:"connected_catalog",applicable:catalogue,reason:catalogue?"Product identities are available.":"No connected product catalogue exists.",inputSchema:{type:"object",properties:{product_id:{type:"string"}},required:["product_id"],additionalProperties:false},verification:["Match the item ID to the connected catalogue."]},
    {name:"check_availability",mode:"read",description:"Read current product or variant availability.",source:"connected_catalog",applicable:catalogue,reason:catalogue?"Availability is synchronised from the commerce platform.":"No availability source exists.",inputSchema:{type:"object",properties:{product_id:{type:"string"},variant_id:{type:"string"}},required:["product_id"],additionalProperties:false},verification:["Compare availability with the connected platform record."]},
    {name:"checkout_handoff",mode:"handoff",description:"Return a secure merchant checkout or product handoff URL; never process payment.",source:"connected_platform",applicable:catalogue&&site,reason:catalogue&&site?"A connected catalogue and HTTPS site exist.":"A verified HTTPS commerce handoff is unavailable.",inputSchema:{type:"object",properties:{product_id:{type:"string"}},required:["product_id"],additionalProperties:false},verification:["Confirm the returned HTTPS URL belongs to the merchant or authorised provider."]},
    {name:"get_business",mode:"read",description:"Read verified public business facts.",source:"business_brain",applicable:brain.facts.some(f=>f.publicSafe&&f.confidence==="verified"),reason:"Business Brain public facts are available.",inputSchema:{type:"object",properties:{},additionalProperties:false},verification:["Compare values with verified Business Brain facts."]},
    {name:"contact_handoff",mode:"handoff",description:"Return an approved contact route without sending a message.",source:"business_profile",applicable:contact,reason:contact?"An approved contact route exists.":"No approved contact route exists.",inputSchema:{type:"object",properties:{topic:{type:"string"}},additionalProperties:false},verification:["Confirm the route equals the approved business contact."]}
  ];
  return actions;
}

export interface RouterSignals {nativeCapability?:boolean;paypalStoreSync?:boolean;paypalEligible?:boolean;customerCountry?:string;currency?:string;physicalGoods?:boolean;existingApi?:boolean;wordpress?:boolean;genericBridgeApproved?:boolean;}
export function routeImplementation(signals:RouterSignals){
  if(signals.nativeCapability)return {route:"native_platform",reason:"Reuse the platform capability already solving the action."};
  if(signals.paypalStoreSync&&signals.paypalEligible&&signals.physicalGoods&&signals.customerCountry==="US"&&signals.currency==="USD")return {route:"paypal_store_sync",reason:"Reuse PayPal Store Sync/WebMCP and keep payment approval inside PayPal."};
  if(signals.existingApi)return {route:"existing_merchant_api",reason:"Use the merchant's authorised system of record."};
  if(signals.wordpress)return {route:"wordpress_woocommerce",reason:"Use the first-party plugin and its reversible adapter."};
  if(signals.genericBridgeApproved)return {route:"generic_webmcp_bridge",reason:"Use the versioned generic bridge after merchant approval."};
  return {route:"safe_handoff",reason:"No safe transactional integration is available; expose a verified handoff only."};
}

export function detectPaypalReuse(signals:RouterSignals){
  const limitations=[] as string[];
  if(!signals.paypalStoreSync)limitations.push("PayPal Store Sync was not observed.");
  if(!signals.paypalEligible)limitations.push("Merchant eligibility/access was not evidenced.");
  if(!signals.physicalGoods)limitations.push("The current path targets physical goods.");
  if(signals.customerCountry!=="US")limitations.push("The current path targets US customers.");
  if(signals.currency!=="USD")limitations.push("The current path targets USD.");
  return {reusable:limitations.length===0,limitations,rule:"Never create a duplicate checkout stack when an authorised provider path already fits."};
}

export function actionSecurityTools(actions:PlannedAction[]):SecurityTool[]{return actions.filter(a=>a.applicable).map(action=>({
  name:action.name,description:action.description,inputSchema:action.inputSchema,outputSchema:{type:"object"},annotations:{
    readOnlyHint:action.mode==="read",requiredScopes:action.mode==="read"?["catalog:read"]:["handoff:read"],
    confirmationRequired:action.mode!=="read",idempotentHint:true,rollbackSupported:action.mode!=="write",verificationRequired:true,rateLimitHint:true
  }
}));}

export function buildWebMcpPlan(brain:BusinessBrain,signals:RouterSignals,verifiedIdentity?:string){
  const actions=mapBusinessActions(brain),route=routeImplementation(signals),security=assessAgentInteractionSecurity({tools:actionSecurityTools(actions),verifiedIdentity});
  return {brainVersion:brain.version,route,actions,security,status:security.status==="fail"?"blocked":"code_ready",
    previewOnly:true,rule:"Nothing is installed or made customer-visible until the merchant approves this exact plan."};
}

export async function saveWebMcpPlan(env:Env,shop:string,plan:ReturnType<typeof buildWebMcpPlan>,nowMs=Date.now()){
  const planId=id("webplan",nowMs);await env.DB.prepare(`INSERT INTO webmcp_plans(id,shop_domain,brain_version,implementation_route,actions_json,security_status,status,created_ms,updated_ms)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(planId,shop,plan.brainVersion,plan.route.route,JSON.stringify(plan.actions),plan.security.status,plan.status,nowMs,nowMs).run();
  return {id:planId,...plan};
}

export const WEBMCP_ADAPTER_VERSION="2026-09-21.1";
export function webMcpManifest(actions:PlannedAction[]){return {adapter:"agentready-webmcp",version:WEBMCP_ADAPTER_VERSION,
  tools:actions.filter(a=>a.applicable).map(a=>({name:a.name,description:a.description,inputSchema:a.inputSchema,annotations:{readOnlyHint:a.mode==="read"}}))};}

export interface RuntimeObservation {browser:string;adapterVersion:string;registeredTools:Array<{name:string;inputSchema?:unknown;readOnlyHint?:boolean}>;results?:Array<{name:string;invoked:boolean;sourceMatched?:boolean;latencyMs?:number;error?:string}>;developmentMode?:boolean;}
export async function verifyWebMcpRuntime(expected:PlannedAction[],observation:RuntimeObservation){
  const registered=new Map(observation.registeredTools.map(t=>[t.name,t])),results=new Map((observation.results||[]).map(r=>[r.name,r]));
  const checks=expected.filter(a=>a.applicable).map(action=>{const tool=registered.get(action.name),result=results.get(action.name),safeToInvoke=action.mode==="read"||observation.developmentMode===true;
    const schemaValid=!!tool&&!!tool.inputSchema,invocation=!!result?.invoked;
    const status=!tool||!schemaValid?"fail":!safeToInvoke?"not_run":invocation&&result?.sourceMatched===true&&!result?.error?"pass":"fail";
    return {name:action.name,mode:action.mode,registered:!!tool,schemaValid,safeToInvoke,invoked:invocation,sourceMatched:result?.sourceMatched===true,latencyMs:Number(result?.latencyMs||0),error:result?.error||null,status};});
  const bytes=new TextEncoder().encode(JSON.stringify(observation.registeredTools.map(t=>({name:t.name,inputSchema:t.inputSchema})).sort((a,b)=>a.name.localeCompare(b.name))));
  const digest=await crypto.subtle.digest("SHA-256",bytes),schemaFingerprint=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
  return {status:checks.some(c=>c.status==="fail")?"fail":"pass",checks,schemaFingerprint,
    latencyMs:checks.reduce((n,c)=>n+c.latencyMs,0),rule:"Ordinary monitoring invokes read-only tools only. Handoffs or writes require an explicit development/sandbox flow; real payments, orders and bookings are never completed."};
}

export async function saveRuntimeVerification(env:Env,shop:string,installationId:string|null,observation:RuntimeObservation,verification:Awaited<ReturnType<typeof verifyWebMcpRuntime>>,nowMs=Date.now()){
  const previous=await env.DB.prepare(`SELECT schema_fingerprint FROM webmcp_runtime_runs WHERE shop_domain=?
    AND ((installation_id=? ) OR (installation_id IS NULL AND ? IS NULL)) ORDER BY checked_ms DESC LIMIT 1`).bind(shop,installationId,installationId).first<any>();
  const schemaDrift=!!previous?.schema_fingerprint&&previous.schema_fingerprint!==verification.schemaFingerprint;
  const effectiveStatus=verification.status==="fail"||schemaDrift?"fail":"pass",runId=id("webrun",nowMs);
  await env.DB.prepare(`INSERT INTO webmcp_runtime_runs(id,shop_domain,installation_id,adapter_version,browser,status,registered_tools_json,checks_json,schema_fingerprint,latency_ms,evidence_tier,checked_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(runId,shop,installationId,clean(observation.adapterVersion,80),clean(observation.browser,120),effectiveStatus,
      JSON.stringify(observation.registeredTools),JSON.stringify(verification.checks),verification.schemaFingerprint,verification.latencyMs,"authorised_browser_runtime",nowMs).run();
  if(effectiveStatus==="fail"){
    const category=schemaDrift?"schema_drift":"runtime_failure",dedupe=`${shop}:${installationId||"unlinked"}:${category}`,incidentId=`webincident_${dedupe}`.replace(/[^a-z0-9_-]/gi,"_");
    await env.DB.prepare(`INSERT INTO webmcp_runtime_incidents(id,shop_domain,installation_id,dedupe_key,category,state,first_seen_ms,last_seen_ms,occurrences,latest_run_id)
      VALUES(?,?,?, ?,?,'open',?,?,1,?) ON CONFLICT(dedupe_key) DO UPDATE SET state='open',last_seen_ms=excluded.last_seen_ms,
      recovered_ms=NULL,occurrences=webmcp_runtime_incidents.occurrences+1,latest_run_id=excluded.latest_run_id`).bind(incidentId,shop,installationId,dedupe,category,nowMs,nowMs,runId).run();
  }else await env.DB.prepare("UPDATE webmcp_runtime_incidents SET state='recovered',recovered_ms=? WHERE shop_domain=? AND state='open'").bind(nowMs,shop).run();
  return {id:runId,...verification,status:effectiveStatus,schemaDrift,checkedMs:nowMs};
}

export async function setInstallationState(env:Env,shop:string,input:{planId:string;adapter:string;siteOrigin:string;enabled:boolean},nowMs=Date.now()){
  const origin=new URL(input.siteOrigin);if(origin.protocol!=="https:")throw new Error("WebMCP installations require an HTTPS site origin.");
  const plan=await env.DB.prepare("SELECT id,status FROM webmcp_plans WHERE id=? AND shop_domain=?").bind(input.planId,shop).first<any>();if(!plan)throw new Error("That plan does not belong to the connected merchant.");
  if(input.enabled&&plan.status!=="code_ready")throw new Error("The plan is blocked by its security gate.");
  const installationId=`webinstall_${input.planId}`;await env.DB.prepare(`INSERT INTO webmcp_installations(id,shop_domain,plan_id,adapter,adapter_version,site_origin,status,enabled,installed_ms,disabled_ms,evidence_json,updated_ms)
    VALUES(?,?,?,?,?,?,?, ?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,enabled=excluded.enabled,
    installed_ms=CASE WHEN excluded.enabled=1 THEN excluded.installed_ms ELSE webmcp_installations.installed_ms END,
    disabled_ms=excluded.disabled_ms,updated_ms=excluded.updated_ms`).bind(installationId,shop,input.planId,clean(input.adapter,80),WEBMCP_ADAPTER_VERSION,origin.origin,
      input.enabled?"approved_pending_install":"disabled",input.enabled?1:0,null,input.enabled?null:nowMs,JSON.stringify({paymentCredentialsStored:false,installationObserved:false}),nowMs).run();
  return {id:installationId,enabled:input.enabled,status:input.enabled?"approved_pending_install":"disabled",rollback:!input.enabled};
}

export async function webMcpReport(env:Env,shop:string){const [plans,installs,runs,incidents]=await Promise.all([
  env.DB.prepare("SELECT * FROM webmcp_plans WHERE shop_domain=? ORDER BY updated_ms DESC LIMIT 20").bind(shop).all<any>(),
  env.DB.prepare("SELECT * FROM webmcp_installations WHERE shop_domain=? ORDER BY updated_ms DESC LIMIT 20").bind(shop).all<any>(),
  env.DB.prepare("SELECT * FROM webmcp_runtime_runs WHERE shop_domain=? ORDER BY checked_ms DESC LIMIT 20").bind(shop).all<any>(),
  env.DB.prepare("SELECT * FROM webmcp_runtime_incidents WHERE shop_domain=? ORDER BY last_seen_ms DESC LIMIT 20").bind(shop).all<any>()]);
  return {plans:plans.results.map(r=>({...r,actions:JSON.parse(String(r.actions_json||"[]"))})),installations:installs.results,runs:runs.results,incidents:incidents.results,
    statusRule:"Code-ready is not Live. Live requires an authorised development merchant, compatible runtime evidence, source-of-truth results and safe recovery testing."};}
