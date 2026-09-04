import type { Env, PixelEventPayload } from "./types";
import { scanWebsite } from "./scanner";
import { consumeOAuthState, deleteShop, getDashboard, getShop, insertEvent, putOAuthState, saveScan, saveShop, updatePixelId } from "./db";
import { createWebPixel, encryptToken, exchangeCode, installUrl, randomState, sessionCookie, shopFromCookie, validShop, verifyOAuthHmac, verifyWebhookHmac } from "./shopify";
import { dashboardPage, homePage, privacyPage, scanPage, setupPage, termsPage } from "./ui";

const html=(body:string,status=200,headers:HeadersInit={})=>new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","permissions-policy":"camera=(), microphone=(), geolocation=()",...headers}});
const json=(data:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}});

function aiSource(referrer?:string){
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
  sources:[
    {source:"ChatGPT",visits:136,orders:23,revenue:4210},
    {source:"Gemini",visits:74,orders:10,revenue:1894},
    {source:"Perplexity",visits:49,orders:7,revenue:1321},
    {source:"Microsoft Copilot",visits:31,orders:5,revenue:986},
    {source:"Claude",visits:22,orders:2,revenue:531}
  ],
  funnel:[{event_type:"page_viewed",count:566},{event_type:"product_viewed",count:421},{event_type:"checkout_started",count:88},{event_type:"checkout_completed",count:47}],
  topProducts:[]
};

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
    try{
      const result=await scanWebsite(target);
      await saveScan(env,result.domain,result.score,result.findings).catch(()=>{});
      return html(scanPage(result));
    }catch(e){return html(`<main style="font-family:system-ui;padding:40px;max-width:720px;margin:auto"><h1>Scan couldn't complete</h1><p>${String(e instanceof Error?e.message:e)}</p><p><a href="/">Try another store</a></p></main>`,400);}
  }

  if(request.method==="POST"&&path==="/api/scan"){
    try{
      const body=await request.json<{url?:string}>();
      const result=await scanWebsite(body.url||"");
      await saveScan(env,result.domain,result.score,result.findings).catch(()=>{});
      return json(result);
    }catch(e){return json({error:e instanceof Error?e.message:"Scan failed"},400);}
  }

  if(request.method==="GET"&&path==="/connect"){
    const shop=(url.searchParams.get("shop")||"").trim().toLowerCase();
    if(!validShop(shop))return json({error:"Enter a valid *.myshopify.com store domain."},400);
    if(!env.SHOPIFY_API_KEY||!env.SHOPIFY_API_SECRET)return json({error:"Shopify credentials have not been configured yet. See /setup."},503);
    const state=randomState();await putOAuthState(env,state,shop);
    return Response.redirect(installUrl(env,shop,state),302);
  }

  if(request.method==="GET"&&path==="/api/shopify/callback"){
    const shop=(url.searchParams.get("shop")||"").toLowerCase();
    const state=url.searchParams.get("state")||"";
    const code=url.searchParams.get("code")||"";
    if(!validShop(shop)||!state||!code)return json({error:"Invalid Shopify callback."},400);
    if(!(await verifyOAuthHmac(url,env.SHOPIFY_API_SECRET)))return json({error:"Shopify signature check failed."},401);
    if(!(await consumeOAuthState(env,state,shop)))return json({error:"Install session expired. Start again."},401);
    try{
      const token=await exchangeCode(env,shop,code);
      const encrypted=await encryptToken(token,env.TOKEN_ENCRYPTION_KEY);
      await saveShop(env,shop,encrypted);
      const pixelId=await createWebPixel(env,shop,token);
      if(pixelId)await updatePixelId(env,shop,pixelId);
      const cookie=await sessionCookie(env.SHOPIFY_API_SECRET,shop);
      return Response.redirect(`${env.APP_URL}/dashboard`,302,{headers:{"set-cookie":cookie}} as any);
    }catch(e){return json({error:e instanceof Error?e.message:"Shopify setup failed"},500);}
  }

  if(request.method==="GET"&&path==="/dashboard"){
    const demo=url.searchParams.get("demo")==="1";
    const shop=demo?null:await shopFromCookie(env.SHOPIFY_API_SECRET,request.headers.get("cookie"));
    return html(dashboardPage(demo,shop));
  }

  if(request.method==="GET"&&path==="/api/dashboard"){
    if(url.searchParams.get("demo")==="1")return json(demoData);
    const shop=await shopFromCookie(env.SHOPIFY_API_SECRET,request.headers.get("cookie"));
    if(!shop)return json({error:"No connected Shopify session."},401);
    return json(await getDashboard(env,shop));
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
    const shop=(request.headers.get("x-shopify-shop-domain")||"").toLowerCase();
    if(topic==="app/uninstalled"||topic==="shop/redact")await deleteShop(env,shop);
    return json({ok:true});
  }

  if(request.method==="GET"&&path==="/health")return json({ok:true,service:"AgentCart",time:new Date().toISOString()});
  return json({error:"Not found"},404);
}

export default {async fetch(request:Request,env:Env){try{return await route(request,env);}catch(e){console.error(e);return json({error:"Unexpected AgentCart error"},500);}}};
