import type { Env, PixelEventPayload, WebhookBody } from "./types";
import { assessSite } from "./agentready";
import { getFindings, getScanComparison, getScanHistory, recordFailedScan, saveScanRun } from "./agentready/store";
import { ShopifyScopeError, getBusinessProfile, getLastSync, syncConnectedStore } from "./platform";
import { buildProfile, ensureProfile, getActions, getCatalogView, getItemView, getPolicies, getProfileMeta, resolveSlug, searchCatalogView, setProfileActive } from "./ailayer/service";
import { handleMcp } from "./ailayer/mcp";
import { buildAgentsMd } from "./ailayer/agentsmd";
import { ApprovalRequiredError, WriteGuardError, applyAllAutomatic, applyFix, approveFix, contextFor, fixByKey, fixesForPlatform, listFixes, missingScopes, proposeFixes, undoFix } from "./fixes";
import { connectionHealth, recentOps, recordOps } from "./ops";
import { linkShopToBusiness, monitoringHistory, runMonitorPass } from "./monitor";
import { classifyOrderSource, getJourney, recordOrderSource, revenueByTier, agenticOrders, startJourney, verifyJourneyId } from "./attribution";
import { REGISTRY_VERIFIED_ON, providerById, regionAvailability } from "./providers/registry";
import { providerAccess } from "./providers/robots";
import { assessChannel, getChannelCapabilities, saveChannelCapabilities } from "./agentic/channel";
import { saveJourney, verifyJourney } from "./agentic/journey";
import { launchStatus, missingPrerequisites } from "./launch/gate";
import { buildUcpManifest, protocolSupport } from "./protocol";
import { runLaunchGate } from "./launch/runner";
import { buildChecklist } from "./launch/checklist";
import { agentCartAgentsMd, handlePublicMcp } from "./public/tools";
import { buildOutcome } from "./outcome";
import { consumeOAuthState, countCustomerEvents, deleteShop, getDashboardWindows, getShop, insertEvent, logComplianceRequest, putOAuthState, rateLimit, redactCustomer, saveOrder, saveShop, setIngestToken, updatePixelId } from "./db";
import { createWebPixel, encryptToken, exchangeCode, installUrl, normalizeOrderId, pixelSettings, randomState, parseSession, safeCompare, sessionCookie, validShop, verifyOAuthHmac, verifyWebhookHmac, webPixelUpdate } from "./shopify";
import { agentReadyPage, aiProfilePage, dashboardPage, errorPage, homePage, privacyPage, setupPage, termsPage } from "./ui";

const html=(body:string,status=200,headers:HeadersInit={})=>new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()","content-security-policy":"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",...headers}});
const json=(data:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});

export function aiSource(referrer?:string){
  if(!referrer)return {agent:"Direct / unknown",host:""};
  try{
    const host=new URL(referrer).hostname.toLowerCase();
    const rules:[RegExp,string][]=[
      [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,"ChatGPT"],
      [/(^|\.)claude\.ai$/,"Claude"],
      [/(^|\.)perplexity\.ai$/,"Perplexity"],
      [/(^|\.)gemini\.google\.com$/,"Gemini"],
      [/(^|\.)copilot\.microsoft\.com$/,"Microsoft Copilot"],
      [/(^|\.)meta\.ai$/,"Meta AI"]
    ];
    const match=rules.find(([re])=>re.test(host));
    return {agent:match?.[1]||"Other referral",host};
  }catch{return {agent:"Direct / unknown",host:""};}
}

const demoData={
  summary:{events:1264,visits:312,orders:47,revenue:8942},
  previous:{events:1013,visits:271,orders:39,revenue:7318},
  currency:"GBP",
  currencyCount:1,
  sources:[
    {source:"ChatGPT",visits:136,orders:23,revenue:4210},
    {source:"Gemini",visits:74,orders:10,revenue:1894},
    {source:"Perplexity",visits:49,orders:7,revenue:1321},
    {source:"Microsoft Copilot",visits:31,orders:5,revenue:986},
    {source:"Claude",visits:22,orders:2,revenue:531}
  ],
  funnel:[{event_type:"page_viewed",count:566},{event_type:"product_viewed",count:421},{event_type:"checkout_started",count:88},{event_type:"checkout_completed",count:47}],
  topProducts:[
    {product:"Merino Base Layer - Charcoal",product_id:"1",events:184,revenue:2410},
    {product:"Trail Runner GTX",product_id:"2",events:141,revenue:1985},
    {product:"Packable Down Jacket",product_id:"3",events:118,revenue:1642},
    {product:"Insulated Flask 750ml",product_id:"4",events:96,revenue:1188},
    {product:"Wool Hiking Socks (3 pack)",product_id:"5",events:73,revenue:717}
  ]
};

// The scanner makes outbound fetches on behalf of anonymous callers, so it is gated
// per client IP. Falls open if the limiter itself fails -- a broken counter should not
// take the public scanner offline.
// Best-effort domain for recording a failed run; a target we cannot even parse is
// recorded under its raw trimmed value rather than being dropped silently.
function safeDomain(input:string){
  try{return new URL(/^https?:\/\//i.test(input)?input:`https://${input}`).hostname.toLowerCase();}
  catch{return input.trim().slice(0,120).toLowerCase();}
}

async function scanGate(request:Request,env:Env,limit=10){
  try{return await rateLimit(env,"scan",request.headers.get("cf-connecting-ip")||"unknown",limit,60000);}
  catch{return {ok:true,count:0,limit,retryAfter:0};}
}

// A cookie alone is not enough to prove a live session: the signature and its embedded
// expiry are checked, then the shop must still be installed, then the cookie must not
// predate the current install. Any of the three revokes access on its own.
async function sessionShop(request:Request,env:Env){
  const session=await parseSession(env.SHOPIFY_API_SECRET,request.headers.get("cookie"));
  if(!session)return null;
  const row=await getShop(env,session.shop);
  if(!row)return null;
  if(Number(row.session_epoch||0)>session.issuedAt)return null;
  return session.shop;
}

async function route(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  const path=url.pathname;

  if(request.method==="GET"&&path==="/")return html(homePage());
  if(request.method==="GET"&&path==="/privacy")return html(privacyPage());
  if(request.method==="GET"&&path==="/terms")return html(termsPage());
  if(request.method==="GET"&&path==="/setup")return html(setupPage());

  if(request.method==="GET"&&path==="/scan"){
    const target=url.searchParams.get("url")||"";
    if(!target)return Response.redirect(`${url.origin}/#scanner`,302);
    const gate=await scanGate(request,env);
    if(!gate.ok)return html(errorPage("Too many scans","You have run a lot of scans in the last minute. Please wait a moment and try again.","/#scanner","Back to the scanner"),429,{"retry-after":String(gate.retryAfter)});
    try{
      const report=await assessSite(target);
      await saveScanRun(env,report).catch(()=>{});
      const comparison=await getScanComparison(env,report.domain).catch(()=>null);
      return html(agentReadyPage(report,comparison));
    }catch(e){
      const message=e instanceof Error?e.message:"Scan failed.";
      await recordFailedScan(env,safeDomain(target),message).catch(()=>{});
      return html(errorPage("That scan could not complete",message,"/#scanner","Try another website"),400);
    }
  }

  if(request.method==="POST"&&path==="/api/scan"){
    const gate=await scanGate(request,env);
    if(!gate.ok)return json({error:"Rate limit exceeded. Try again shortly."},429,{"retry-after":String(gate.retryAfter)});
    let target="";
    try{
      const body=await request.json<{url?:string}>();
      target=body.url||"";
      const report=await assessSite(target);
      const runId=await saveScanRun(env,report).catch(()=>null);
      const comparison=await getScanComparison(env,report.domain).catch(()=>null);
      return json({...report,runId,comparison});
    }catch(e){
      const message=e instanceof Error?e.message:"Scan failed";
      if(target)await recordFailedScan(env,safeDomain(target),message).catch(()=>{});
      return json({error:message},400);
    }
  }

  if(request.method==="GET"&&path.startsWith("/api/report/")){
    const domain=decodeURIComponent(path.slice("/api/report/".length)).toLowerCase();
    if(!domain)return json({error:"No domain supplied."},400);
    const gate=await scanGate(request,env,60);
    if(!gate.ok)return json({error:"Rate limit exceeded."},429,{"retry-after":String(gate.retryAfter)});
    const comparison=await getScanComparison(env,domain);
    if(!comparison)return json({error:"That website has not been scanned yet."},404);
    return json({comparison,findings:await getFindings(env,String(comparison.latest.id))});
  }

  if(request.method==="GET"&&path.startsWith("/api/history/")){
    const domain=decodeURIComponent(path.slice("/api/history/".length)).toLowerCase();
    if(!domain)return json({error:"No domain supplied."},400);
    const gate=await scanGate(request,env,60);
    if(!gate.ok)return json({error:"Rate limit exceeded."},429,{"retry-after":String(gate.retryAfter)});
    return json({domain,history:await getScanHistory(env,domain)});
  }

  if(request.method==="GET"&&path==="/connect"){
    const shop=(url.searchParams.get("shop")||"").trim().toLowerCase();
    if(!validShop(shop))return html(errorPage("That is not a Shopify store address","Enter your store's address in the form your-store.myshopify.com.","/","Back to AgentCart"),400);
    if(!env.SHOPIFY_API_KEY||!env.SHOPIFY_API_SECRET)return html(errorPage("Shopify connection is not configured yet","This AgentCart deployment has no Shopify credentials set. The store owner needs to finish setup before stores can connect.","/setup","See setup steps"),503);
    const state=randomState();await putOAuthState(env,state,shop);
    return Response.redirect(installUrl(env,shop,state),302);
  }

  if(request.method==="GET"&&path==="/api/shopify/callback"){
    const shop=(url.searchParams.get("shop")||"").toLowerCase();
    const state=url.searchParams.get("state")||"";
    const code=url.searchParams.get("code")||"";
    if(!validShop(shop)||!state||!code)return html(errorPage("That Shopify link was incomplete","Some details were missing from the response Shopify sent back. Start the connection again from AgentCart.","/","Back to AgentCart"),400);
    if(!(await verifyOAuthHmac(url,env.SHOPIFY_API_SECRET)))return html(errorPage("That Shopify link could not be verified","AgentCart could not confirm the response came from Shopify, so it was rejected. Start the connection again.","/","Back to AgentCart"),401);
    if(!(await consumeOAuthState(env,state,shop)))return html(errorPage("That connection link has expired","Install links are valid for ten minutes and can only be used once. Start the connection again.","/","Back to AgentCart"),401);
    try{
      const {token,scope}=await exchangeCode(env,shop,code);
      const encrypted=await encryptToken(token,env.TOKEN_ENCRYPTION_KEY);
      const issuedAt=Date.now();
      await saveShop(env,shop,encrypted,null,issuedAt,scope);
      // Pixel activation is deliberately non-fatal. The install has already committed by
      // this point, so throwing here would show a 500 to a merchant who is in fact
      // connected. Surface it as a banner and let them retry instead.
      const ingestToken=randomState();
      await setIngestToken(env,shop,ingestToken);
      let pixelOk=true;
      try{
        const settings=pixelSettings(env,shop,ingestToken);
        const existing=await getShop(env,shop);
        const pixelId=existing?.pixel_id
          ? await webPixelUpdate(env,shop,token,existing.pixel_id,settings)
          : await createWebPixel(env,shop,token,settings);
        if(pixelId)await updatePixelId(env,shop,pixelId);
      }catch(e){pixelOk=false;console.error("web pixel activation failed",e);
        await recordOps(env,"pixel.activate","error",e instanceof Error?e.message:"pixel activation failed",{shop});}
      // Pull authoritative catalogue data now so the dashboard and AI layer have
      // something immediately. Non-fatal for the same reason pixel activation is: the
      // install has already committed.
      try{
        await syncConnectedStore(env,shop);
        await ensureProfile(env,shop);
        // Point monitoring at the merchant's real storefront rather than the
        // myshopify domain, when the sync told us what it is.
        const profile=await getBusinessProfile(env,shop);
        const site=String(profile?.primary_url||"");
        if(site){try{await linkShopToBusiness(env,shop,new URL(site).hostname.toLowerCase());}catch{/* ignore */}}
      }catch(e){console.error("initial store sync failed",e);}
      const cookie=await sessionCookie(env.SHOPIFY_API_SECRET,shop,issuedAt);
      const location=`${env.APP_URL}/dashboard${pixelOk?"":"?pixel=failed"}`;
      return new Response(null,{status:302,headers:{location,"set-cookie":cookie}});
    }catch(e){
      console.error("shopify install failed",e);
      return html(errorPage("AgentCart could not finish connecting your store","Shopify did not complete the connection. Please try again; if it keeps happening, check that the app credentials are correct.","/","Back to AgentCart"),500);
    }
  }

  if(request.method==="GET"&&path==="/dashboard"){
    const demo=url.searchParams.get("demo")==="1";
    const shop=demo?null:await sessionShop(request,env);
    return html(dashboardPage(demo,shop,url.searchParams.get("pixel")==="failed"));
  }

  if(request.method==="POST"&&path==="/api/sync"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const gate=await rateLimit(env,"sync",shop,4,300000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Sync was run very recently. Try again in a few minutes."},429,{"retry-after":String(gate.retryAfter)});
    try{
      const out=await syncConnectedStore(env,shop);
      return json({ok:true,items:out.items,business:out.business.name});
    }catch(e){
      if(e instanceof ShopifyScopeError)
        return json({error:e.message,needsReauthorization:true,reconnectUrl:`/connect?shop=${encodeURIComponent(shop)}`},403);
      return json({error:e instanceof Error?e.message:"Sync failed"},502);
    }
  }

  if(request.method==="GET"&&path==="/api/sync/status"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const last=await getLastSync(env,shop);
    const profile=await getBusinessProfile(env,shop);
    return json({lastSync:last||null,business:profile?{name:profile.name,syncedMs:profile.synced_ms}:null,
      needsReauthorization:last?.status==="needs_reauthorization"});
  }

  if(path==="/api/ai-layer"&&(request.method==="GET"||request.method==="POST")){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    if(request.method==="POST"){
      const body=await request.json<{active?:boolean}>().catch(()=>({active:undefined}));
      if(typeof body.active==="boolean")await setProfileActive(env,shop,body.active);
      else await ensureProfile(env,shop);
    }
    const slug=await ensureProfile(env,shop);
    const meta=await getProfileMeta(env,shop);
    return json({slug,active:!!Number(meta?.active??1),version:Number(meta?.version??1),
      publicUrl:`${env.APP_URL}/ai/${slug}`,apiUrl:`${env.APP_URL}/api/ai/${slug}/profile`,
      mcpUrl:`${env.APP_URL}/api/ai/${slug}/mcp`,
      lastGenerated:meta?.last_generated_ms?new Date(Number(meta.last_generated_ms)).toISOString():null});
  }

  if(path==="/api/fixes"&&request.method==="GET"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const rows=await listFixes(env,shop);
    // The stored preview is what the merchant is being asked to approve, so it travels with
    // the row. Approving a change you cannot see is not approval.
    const fixes:Record<string,unknown>[]=rows.map(f=>{
      let parsed:any={};
      try{parsed=JSON.parse(String(f.proposed_change_json||"{}"));}
      catch{/* a row written by an older build simply shows no preview */}
      return {...f,before:parsed?.preview?.before??null,after:parsed?.preview?.after??null,
        reversible:!!fixByKey(String(parsed?.key||""))?.undo};
    });
    const granted=((await getShop(env,shop))?.granted_scopes||"").split(",").map(s=>s.trim()).filter(Boolean);
    // Grouped the way the UI presents them: what we can do, what needs you, what we cannot.
    return json({
      automatic:fixes.filter(f=>f.fix_type!=="approval_required"&&f.status==="proposed"),
      needsApproval:fixes.filter(f=>f.fix_type==="approval_required"&&f.status==="proposed"),
      inProgress:fixes.filter(f=>f.status==="approved"||f.status==="applying"||f.status==="applied"),
      done:fixes.filter(f=>f.status==="verified"),
      failed:fixes.filter(f=>f.status==="failed"),
      undone:fixes.filter(f=>f.status==="undone"),
      unavailable:fixesForPlatform("shopify").map(def=>({key:def.key,title:def.title,
        missingScopes:missingScopes(def,granted)})).filter(f=>f.missingScopes.length)
        .map(f=>({...f,needsReauthorization:true,
          summary:`${f.title}: your Shopify connection does not grant ${f.missingScopes.join(", ")}.`}))
    });
  }

  if(path==="/api/fixes/propose"&&request.method==="POST"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const gate=await rateLimit(env,"fixes",shop,10,300000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Try again in a few minutes."},429,{"retry-after":String(gate.retryAfter)});
    try{return json({proposed:await proposeFixes(env,shop,"shopify")});}
    catch(e){
      if(e instanceof ShopifyScopeError)return json({error:e.message,needsReauthorization:true},403);
      return json({error:e instanceof Error?e.message:"Could not work out what can be fixed."},502);
    }
  }

  if(path.startsWith("/api/fixes/")&&request.method==="POST"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const [id,action]=path.slice("/api/fixes/".length).split("/");
    if(!id)return json({error:"No fix identified."},400);
    try{
      if(action==="approve"){
        const row=await approveFix(env,shop,id);
        return row?json({fix:row}):json({error:"No such fix."},404);
      }
      if(action==="apply")return json({fix:await applyFix(env,shop,id)});
      if(action==="undo")return json({fix:await undoFix(env,shop,id)});
      if(action==="apply-automatic")return json({applied:await applyAllAutomatic(env,shop)});
      return json({error:"Unknown action."},404);
    }catch(e){
      if(e instanceof ApprovalRequiredError)return json({error:e.message,needsApproval:true},403);
      if(e instanceof WriteGuardError)return json({error:e.message,writeBlocked:true},409);
      if(e instanceof ShopifyScopeError)return json({error:e.message,needsReauthorization:true},403);
      return json({error:e instanceof Error?e.message:"That fix could not be applied."},502);
    }
  }

  if(request.method==="GET"&&path==="/api/health/connection"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    return json({...await connectionHealth(env,shop),recent:await recentOps(env,shop,25)});
  }

  if(request.method==="GET"&&path==="/api/monitoring"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    return json({history:await monitoringHistory(env,shop)});
  }

  // Starts an AgentCart-controlled commerce journey so a later order can be joined back to the
  // agent that produced it, even when the storefront pixel never runs.
  if(path==="/api/journey"&&request.method==="POST"){
    const gate=await rateLimit(env,"journey",request.headers.get("cf-connecting-ip")||"unknown",120,60000)
      .catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Rate limit exceeded"},429,{"retry-after":String(gate.retryAfter)});
    const body=await request.json<{shop?:string;provider?:string;intent?:string;targetUrl?:string;itemId?:string}>()
      .catch(()=>({} as any));
    const shop=String(body.shop||"").toLowerCase();
    if(!validShop(shop))return json({error:"A valid store domain is required."},400);
    if(!(await getShop(env,shop)))return json({error:"Unknown store"},404);
    const provider=String(body.provider||"unknown").toLowerCase();
    const journeyId=await startJourney(env,shop,provider,{intent:body.intent,targetUrl:body.targetUrl,itemId:body.itemId});
    return json({journeyId,
      // The merchant's platform must carry this through checkout for the join to work.
      attributeName:"agentcart_journey",
      note:"Attach this as an order note attribute named agentcart_journey to link the resulting order."},201);
  }

  if(request.method==="GET"&&path==="/api/attribution"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const now=Date.now()+1,from=now-30*24*60*60*1000;
    return json({tiers:await revenueByTier(env,shop,from,now),
      agents:await agenticOrders(env,shop,from,now),
      note:"Evidence tiers are reported separately and never summed. Verified revenue comes from cryptographically verified platform order records; reported revenue comes from the storefront pixel."});
  }

  // Provider compatibility: one place a merchant sees, per AI provider, whether it can discover
  // them, reach them, and act. Assembled from the registry, robots evidence and channel state.
  if(request.method==="GET"&&path==="/api/protocols"){
    return json({protocols:protocolSupport(),
      note:"AgentCart implements discovery and read access for these protocols. It does not process payments or own orders under any of them."});
  }

  if(request.method==="GET"&&path==="/api/providers"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const profile=await getBusinessProfile(env,shop);
    let robots:string|undefined;
    const site=String(profile?.primary_url||"");
    if(site){
      try{
        const res=await fetch(new URL("/robots.txt",site).toString(),
          {headers:{"User-Agent":"AgentCartReadinessScanner/2.0"}});
        if(res.ok)robots=(await res.text()).slice(0,50_000);
      }catch{/* unreachable robots.txt is reported as unknown, not as a failure */}
    }
    const country=(()=>{try{return JSON.parse(String(profile?.address_json||"{}")).country;}catch{return undefined;}})();
    const access=providerAccess(robots);
    return json({
      providers:access.map(a=>{
        const definition=providerById(a.provider)!;
        return {...a,
          region:regionAvailability(definition,typeof country==="string"?country.slice(0,2):undefined),
          verifiedOn:definition.verifiedOn,
          protocols:definition.protocols};
      }),
      channel:await getChannelCapabilities(env,shop),
      registryVerifiedOn:REGISTRY_VERIFIED_ON,
      note:"Blocking an AI training crawler is a legitimate choice and never reduces your score. Where a provider documents that its agent may fetch a page regardless of robots.txt, AgentCart reports your setting as a stated preference rather than claiming the agent is blocked."
    });
  }

  if(request.method==="POST"&&path==="/api/providers/channel"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const gate=await rateLimit(env,"channel",shop,6,300000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Checked very recently. Try again shortly."},429,{"retry-after":String(gate.retryAfter)});
    try{
      const ctx=await contextFor(env,shop);
      const profile=await getBusinessProfile(env,shop);
      const country=(()=>{try{return JSON.parse(String(profile?.address_json||"{}")).country;}catch{return undefined;}})();
      const caps=await assessChannel(env,shop,ctx.token,typeof country==="string"?country.slice(0,2):undefined);
      await saveChannelCapabilities(env,shop,caps);
      return json({capabilities:caps});
    }catch(e){
      if(e instanceof ShopifyScopeError)return json({error:e.message,needsReauthorization:true},403);
      return json({error:e instanceof Error?e.message:"Could not check channel readiness."},502);
    }
  }

  if(request.method==="POST"&&path==="/api/journey/verify"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const gate=await rateLimit(env,"verify",shop,10,300000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Verified very recently. Try again shortly."},429,{"retry-after":String(gate.retryAfter)});
    const body=await request.json<{url?:string;intent?:string}>().catch(()=>({} as any));
    const intent=(["buy_product","find_policy","contact_business","book_appointment"] as const)
      .find(i=>i===body.intent)||"buy_product";
    const profile=await getBusinessProfile(env,shop);
    const target=String(body.url||profile?.primary_url||"");
    if(!target)return json({error:"No website is known for this store."},400);
    try{
      const result=await verifyJourney(target,intent);
      await saveJourney(env,shop,result).catch(()=>{});
      return json(result);
    }catch(e){return json({error:e instanceof Error?e.message:"Verification failed."},400);}
  }

  // Launch gate. Deliberately authenticated and deliberately not runnable from a test suite:
  // Phase 11.2's rule is that green unit tests never make the MVP launch ready.
  if(request.method==="GET"&&path==="/api/launch"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const status=await launchStatus(env,url.searchParams.get("environment")||"production");
    return json({...status,missingPrerequisites:missingPrerequisites(env),
      hardRule:"A green test suite and green CI never make AgentCart launch ready. Every check below must pass against real infrastructure."});
  }

  if(request.method==="GET"&&path==="/api/launch/checklist"){
    const shop=await sessionShop(request,env);
    return json(await buildChecklist(env,shop||undefined));
  }

  if(request.method==="POST"&&path==="/api/launch/run"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const gate=await rateLimit(env,"launch",shop,4,600000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"The launch gate was run very recently."},429,{"retry-after":String(gate.retryAfter)});
    const body=await request.json<{environment?:string;appVersion?:string}>().catch(()=>({} as any));
    const out=await runLaunchGate(env,{shop,environment:body.environment,appVersion:body.appVersion});
    return json(out);
  }

  // AgentCart as a capability agents can call. Public, read-only, rate limited, and structurally
  // unable to mutate a merchant's store: none of these tools touch an authenticated path.
  if(path==="/api/mcp"&&request.method==="POST"){
    const gate=await rateLimit(env,"publicmcp",request.headers.get("cf-connecting-ip")||"unknown",30,60000)
      .catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({jsonrpc:"2.0",id:null,error:{code:-32000,message:"Rate limit exceeded."}},429,
      {"retry-after":String(gate.retryAfter)});
    let body:any={};
    try{body=await request.json();}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON."}},400);}
    const result=await handlePublicMcp(env,body);
    return result?json(result,200,{"access-control-allow-origin":"*"}):new Response(null,{status:204});
  }
  if(path==="/api/mcp"&&request.method==="OPTIONS")
    return new Response(null,{status:204,headers:{"access-control-allow-origin":"*",
      "access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type"}});

  if(request.method==="GET"&&(path==="/agents.md"||path==="/.well-known/agents.md")){
    return new Response(agentCartAgentsMd(env.APP_URL),{status:200,
      headers:{"content-type":"text/markdown; charset=utf-8","cache-control":"public, max-age=3600",
        "access-control-allow-origin":"*"}});
  }

  if(request.method==="GET"&&path==="/api/outcome"){
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    const business=await env.DB.prepare("SELECT domain FROM businesses WHERE connected_shop_domain=? LIMIT 1")
      .bind(shop).first<{domain:string}>();
    return json(await buildOutcome(env,shop,business?.domain||null));
  }

  if(request.method==="GET"&&path==="/api/dashboard"){
    if(url.searchParams.get("demo")==="1")return json(demoData);
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    return json(await getDashboardWindows(env,shop,Date.now()));
  }

  if(path==="/api/events"&&request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type, x-agentcart-token","access-control-max-age":"86400"}});
  if(path==="/api/events"&&request.method==="POST"){
    try{
      const size=Number(request.headers.get("content-length")||0);if(size>100000)return json({error:"Payload too large"},413,{"access-control-allow-origin":"*"});
      const event=await request.json<PixelEventPayload>();
      if(!event.shop||!validShop(event.shop)||!event.eventId||!event.eventType)return json({error:"Invalid event"},400,{"access-control-allow-origin":"*"});
      const row=await getShop(env,event.shop);
      if(!row)return json({error:"Unknown store"},404,{"access-control-allow-origin":"*"});
      // The token lives in browser-delivered pixel settings, so it is not a secret. It
      // stops a domain list being sprayed; it does not make events unforgeable. Shops
      // installed before tokens existed have none, and are not locked out.
      const supplied=request.headers.get("x-agentcart-token")||"";
      if(row.ingest_token&&!safeCompare(supplied,row.ingest_token))
        return json({error:"Invalid ingest token"},401,{"access-control-allow-origin":"*"});
      const gate=await rateLimit(env,"events",event.shop,600,60000).catch(()=>({ok:true,retryAfter:0}));
      if(!gate.ok)return json({error:"Rate limit exceeded"},429,{"access-control-allow-origin":"*","retry-after":String(gate.retryAfter)});
      const source=aiSource(event.referrer);
      // Recorded, not enforced: the strict-sandbox pixel's Origin cannot be confirmed
      // without a live store, and enforcing a guessed value would silently zero every
      // merchant's dashboard. Read these values before turning this into a check.
      const origin=request.headers.get("origin")||null;
      await insertEvent(env,{...event,raw:{...(event.raw&&typeof event.raw==="object"?event.raw as object:{}),origin}},source.agent,source.host);
      return json({ok:true},202,{"access-control-allow-origin":"*"});
    }catch{return json({error:"Invalid event payload"},400,{"access-control-allow-origin":"*"});}
  }

  if(path==="/api/shopify/webhooks"&&request.method==="POST"){
    const raw=await request.text();
    const ok=await verifyWebhookHmac(env.SHOPIFY_API_SECRET,raw,request.headers.get("x-shopify-hmac-sha256"));
    if(!ok)return json({error:"Invalid webhook signature"},401);
    const topic=(request.headers.get("x-shopify-topic")||"").toLowerCase();
    let body:WebhookBody={};
    try{body=JSON.parse(raw||"{}") as WebhookBody;}catch{body={};}
    // Compliance payloads carry shop_domain; fall back to it when the header is absent,
    // and never act on a value that is not a real myshopify domain.
    const shop=(request.headers.get("x-shopify-shop-domain")||body.shop_domain||"").toLowerCase();
    if(!validShop(shop))return json({error:"Invalid shop domain"},400);
    const orderIds=(body.orders_requested||body.orders_to_redact||[]).map(v=>String(v));
    const customerId=body.customer?.id!=null?String(body.customer.id):null;
    if(topic==="app/uninstalled"){await deleteShop(env,shop);}
    else if(topic==="shop/redact"){
      await deleteShop(env,shop);
      await logComplianceRequest(env,shop,topic,null,[],0);
    }
    else if(topic==="customers/redact"){
      const removed=await redactCustomer(env,shop,orderIds);
      await logComplianceRequest(env,shop,topic,customerId,orderIds,removed);
    }
    else if(topic==="orders/paid"||topic==="orders/create"){
      // Dormant until read_orders is granted. Only the fields needed for revenue are
      // read: no customer block, no email, no phone, no addresses, and the raw payload
      // is deliberately not stored for this topic.
      const orderId=String(body.id??body.admin_graphql_api_id??"");
      if(orderId){
        const total=Number(body.current_total_price??body.total_price??NaN);
        const processed=Date.parse(String(body.processed_at??body.created_at??""));
        await saveOrder(env,shop,orderId,normalizeOrderId(body.admin_graphql_api_id??body.id),
          Number.isFinite(total)?total:null,body.currency?String(body.currency):null,
          Number.isNaN(processed)?Date.now():processed);
        // Classify from platform channel metadata, so an agentic checkout that never ran the
        // storefront pixel still yields verified AI-channel revenue. A journey id is accepted
        // only if its signature verifies for this shop.
        const claimed=body.note_attributes?.find?.((a:any)=>String(a?.name||"")==="agentcart_journey")?.value;
        let journeyId:string|null=null;
        if(claimed){
          const journey=await getJourney(env,String(claimed));
          if(journey&&String(journey.shop_domain)===shop
             &&await verifyJourneyId(env.SHOPIFY_API_SECRET,shop,String(journey.provider||""),String(claimed)))
            journeyId=String(claimed);
        }
        const source=classifyOrderSource({
          channel:body.source_name?String(body.source_name):null,
          sourceName:body.source_identifier?String(body.source_identifier):null,
          referringSite:body.referring_site?String(body.referring_site):null,
          landingSite:body.landing_site?String(body.landing_site):null,
          journeyId
        });
        await recordOrderSource(env,shop,orderId,source,journeyId);
      }
    }
    else if(topic==="customers/data_request"){
      // Shopify requires the request be handled and the data delivered to the merchant
      // within 30 days; it does not require an automated response payload. Record it
      // with the matched row count so the owner can fulfil it -- see docs/USER_ACTIONS.md.
      const matched=await countCustomerEvents(env,shop,orderIds);
      await logComplianceRequest(env,shop,topic,customerId,orderIds,matched);
    }
    // Unknown topics acknowledge with 200: a non-2xx makes Shopify retry indefinitely.
    return json({ok:true});
  }

  // ---- Public AI compatibility layer ----------------------------------------
  // Everything under /ai and /api/ai is public and unauthenticated by design: it exists
  // so an AI system can read a merchant's canonical data without scraping. It serves
  // only what src/ailayer/service.ts emits.
  if(path.startsWith("/api/ai/")||path==="/api/ai"||path.startsWith("/ai/")){
    const isHuman=path.startsWith("/ai/");
    const rest=isHuman?path.slice("/ai/".length):path.slice("/api/ai/".length);
    const [rawSlug,...segments]=rest.split("/").filter(Boolean);
    if(!rawSlug)return json({error:"No business identifier supplied."},404);
    const slug=decodeURIComponent(rawSlug).toLowerCase();
    const profile=await resolveSlug(env,slug);
    if(!profile)return isHuman
      ? html(errorPage("No such AI profile","That AgentCart AI profile does not exist, or the business has turned it off.","/","Back to AgentCart"),404)
      : json({error:"No active AgentCart AI profile for that identifier."},404);
    const shop=profile.shop_domain;

    if(isHuman&&!segments.length){
      const built=await buildProfile(env,shop,slug);
      return built
        ? html(aiProfilePage(built,slug))
        : html(errorPage("This profile is not ready yet","This business has connected but its catalogue has not been synced.","/","Back to AgentCart"),404);
    }

    // MCP speaks JSON-RPC over POST on the profile root.
    if(!isHuman&&request.method==="POST"&&(!segments.length||segments[0]==="mcp")){
      const gate=await rateLimit(env,"ai",slug,240,60000).catch(()=>({ok:true,retryAfter:0}));
      if(!gate.ok)return json({error:"Rate limit exceeded"},429,{"retry-after":String(gate.retryAfter)});
      let body:any={};
      try{body=await request.json();}catch{return json({jsonrpc:"2.0",id:null,error:{code:-32700,message:"Invalid JSON."}},400);}
      const result=await handleMcp(env,shop,slug,body);
      return result?json(result):new Response(null,{status:204});
    }

    if(request.method!=="GET")return json({error:"Method not allowed"},405);
    const gate=await rateLimit(env,"ai",slug,240,60000).catch(()=>({ok:true,retryAfter:0}));
    if(!gate.ok)return json({error:"Rate limit exceeded"},429,{"retry-after":String(gate.retryAfter)});

    // UCP discovery manifest, advertising only what is genuinely implemented.
    if(segments[0]==="ucp"||segments[0]===".well-known"){
      const manifest=await buildUcpManifest(env,shop,slug,env.APP_URL);
      if(!manifest)return json({error:"This business has no synced profile yet."},404);
      return json(manifest,200,{"access-control-allow-origin":"*","cache-control":"public, max-age=300"});
    }

    // Hosted agents.md, generated from the same service layer as the JSON endpoints.
    if(segments[0]==="agents.md"||segments[0]==="agents"){
      const md=await buildAgentsMd(env,shop,slug,env.APP_URL);
      if(!md)return json({error:"This business has no synced profile yet."},404);
      const meta=await getProfileMeta(env,shop);
      const etag=`W/"${slug}-${meta?.version??1}-${meta?.last_generated_ms??0}-agents"`;
      if(request.headers.get("if-none-match")===etag)return new Response(null,{status:304,headers:{etag}});
      return new Response(md,{status:200,headers:{"content-type":"text/markdown; charset=utf-8",
        etag,"cache-control":"public, max-age=300","access-control-allow-origin":"*"}});
    }

    const section=segments[0]||"profile";
    let payload:unknown=null;
    if(section==="profile")payload=await buildProfile(env,shop,slug);
    else if(section==="catalog")payload={items:await getCatalogView(env,shop,
      Number(url.searchParams.get("limit"))||50,Number(url.searchParams.get("offset"))||0)};
    else if(section==="items"&&segments[1])payload=await getItemView(env,shop,decodeURIComponent(segments[1]));
    else if(section==="policies")payload={policies:await getPolicies(env,shop)};
    else if(section==="actions")payload={actions:await getActions(env,shop)};
    else if(section==="search")payload={results:await searchCatalogView(env,shop,url.searchParams.get("q")||"",
      Number(url.searchParams.get("limit"))||20)};
    else return json({error:"Unknown AI profile section."},404);

    if(!payload)return json({error:"Not found in this merchant's catalogue."},404);
    // A weak ETag over the profile version and sync time is enough for a conditional GET
    // and costs nothing; the content only changes when one of those does.
    const meta=await getProfileMeta(env,shop);
    const etag=`W/"${slug}-${meta?.version??1}-${meta?.last_generated_ms??0}-${section}"`;
    if(request.headers.get("if-none-match")===etag)return new Response(null,{status:304,headers:{etag}});
    return json(payload,200,{etag,"cache-control":"public, max-age=300",
      "access-control-allow-origin":"*"});
  }

  if(request.method==="GET"&&path==="/health")return json({ok:true,service:"AgentCart",time:new Date().toISOString()});
  return json({error:"Not found"},404);
}

export default {
  async fetch(request:Request,env:Env){
    try{return await route(request,env);}
    catch(e){console.error(e);return json({error:"Unexpected AgentCart error"},500);}
  },
  // Cron entrypoint. Rescans a small batch of connected businesses per firing so cost
  // stays bounded on free-tier infrastructure however many stores connect.
  async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){
    ctx.waitUntil((async()=>{
      try{
        const outcomes=await runMonitorPass(env);
        for(const o of outcomes)console.log(`monitor ${o.domain}: ${o.status} — ${o.detail}`);
      }catch(e){console.error("monitor pass failed",e);}
    })());
  }
};
