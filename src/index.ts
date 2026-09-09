import type { Env, PixelEventPayload, WebhookBody } from "./types";
import { scanWebsite } from "./scanner";
import { consumeOAuthState, countCustomerEvents, deleteShop, getDashboardWindows, getShop, insertEvent, logComplianceRequest, putOAuthState, rateLimit, redactCustomer, saveScan, saveShop, updatePixelId } from "./db";
import { createWebPixel, encryptToken, exchangeCode, installUrl, randomState, parseSession, sessionCookie, validShop, verifyOAuthHmac, verifyWebhookHmac } from "./shopify";
import { dashboardPage, errorPage, homePage, privacyPage, scanPage, setupPage, termsPage } from "./ui";

const html=(body:string,status=200,headers:HeadersInit={})=>new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()",...headers}});
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
async function scanGate(request:Request,env:Env){
  try{return await rateLimit(env,"scan",request.headers.get("cf-connecting-ip")||"unknown",10,60000);}
  catch{return {ok:true,count:0,limit:10,retryAfter:0};}
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
      const result=await scanWebsite(target);
      await saveScan(env,result.domain,result.score,result.findings).catch(()=>{});
      return html(scanPage(result));
    }catch(e){return html(errorPage("That scan could not complete",e instanceof Error?e.message:"Scan failed.","/#scanner","Try another website"),400);}
  }

  if(request.method==="POST"&&path==="/api/scan"){
    const gate=await scanGate(request,env);
    if(!gate.ok)return json({error:"Rate limit exceeded. Try again shortly."},429,{"retry-after":String(gate.retryAfter)});
    try{
      const body=await request.json<{url?:string}>();
      const result=await scanWebsite(body.url||"");
      await saveScan(env,result.domain,result.score,result.findings).catch(()=>{});
      return json(result);
    }catch(e){return json({error:e instanceof Error?e.message:"Scan failed"},400);}
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
      const token=await exchangeCode(env,shop,code);
      const encrypted=await encryptToken(token,env.TOKEN_ENCRYPTION_KEY);
      const issuedAt=Date.now();
      await saveShop(env,shop,encrypted,null,issuedAt);
      // Pixel activation is deliberately non-fatal. The install has already committed by
      // this point, so throwing here would show a 500 to a merchant who is in fact
      // connected. Surface it as a banner and let them retry instead.
      let pixelOk=true;
      try{
        const pixelId=await createWebPixel(env,shop,token);
        if(pixelId)await updatePixelId(env,shop,pixelId);
      }catch(e){pixelOk=false;console.error("web pixel activation failed",e);}
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

  if(request.method==="GET"&&path==="/api/dashboard"){
    if(url.searchParams.get("demo")==="1")return json(demoData);
    const shop=await sessionShop(request,env);
    if(!shop)return json({error:"No connected Shopify session."},401);
    return json(await getDashboardWindows(env,shop,Date.now()));
  }

  if(path==="/api/events"&&request.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"POST,OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"86400"}});
  if(path==="/api/events"&&request.method==="POST"){
    try{
      const size=Number(request.headers.get("content-length")||0);if(size>100000)return json({error:"Payload too large"},413,{"access-control-allow-origin":"*"});
      const event=await request.json<PixelEventPayload>();
      if(!event.shop||!validShop(event.shop)||!event.eventId||!event.eventType)return json({error:"Invalid event"},400,{"access-control-allow-origin":"*"});
      if(!(await getShop(env,event.shop)))return json({error:"Unknown store"},404,{"access-control-allow-origin":"*"});
      const source=aiSource(event.referrer);
      await insertEvent(env,event,source.agent,source.host);
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

  if(request.method==="GET"&&path==="/health")return json({ok:true,service:"AgentCart",time:new Date().toISOString()});
  return json({error:"Not found"},404);
}

export default {async fetch(request:Request,env:Env){try{return await route(request,env);}catch(e){console.error(e);return json({error:"Unexpected AgentCart error"},500);}}};
