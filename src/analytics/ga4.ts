import type {Env} from "../types";
import {decryptToken,encryptToken} from "../shopify";
import {importAuthorisedReferrals,type ReferralImportRow} from "./market";

const SCOPE="https://www.googleapis.com/auth/analytics.readonly";
const callback=(env:Env)=>`${env.APP_URL.replace(/\/$/,"")}/api/analytics/ga4/callback`;

function configured(env:Env){if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)throw new Error("GA4 OAuth is not configured on this deployment.");}

export async function ga4AuthorizationUrl(env:Env,shop:string,nowMs=Date.now()){
  configured(env);const state=crypto.randomUUID();
  await env.DB.prepare("DELETE FROM provider_oauth_states WHERE expires_ms<?").bind(nowMs).run();
  await env.DB.prepare("INSERT INTO provider_oauth_states(state,shop_domain,provider,expires_ms) VALUES(?,?,?,?)")
    .bind(state,shop,"ga4",nowMs+10*60*1000).run();
  const u=new URL("https://accounts.google.com/o/oauth2/v2/auth");u.searchParams.set("client_id",env.GOOGLE_CLIENT_ID!);
  u.searchParams.set("redirect_uri",callback(env));u.searchParams.set("response_type","code");u.searchParams.set("scope",SCOPE);
  u.searchParams.set("access_type","offline");u.searchParams.set("prompt","consent");u.searchParams.set("state",state);
  return u.toString();
}

async function consumeState(env:Env,state:string,nowMs=Date.now()){
  const row=await env.DB.prepare("SELECT shop_domain,expires_ms FROM provider_oauth_states WHERE state=? AND provider='ga4'")
    .bind(state).first<{shop_domain:string;expires_ms:number}>();
  await env.DB.prepare("DELETE FROM provider_oauth_states WHERE state=?").bind(state).run();
  return row&&Number(row.expires_ms)>nowMs?row.shop_domain:null;
}

export async function completeGa4OAuth(env:Env,state:string,code:string,fetcher:typeof fetch=fetch,nowMs=Date.now()){
  configured(env);const shop=await consumeState(env,state,nowMs);if(!shop)throw new Error("That GA4 connection link expired or was already used.");
  const res=await fetcher("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,code,grant_type:"authorization_code",redirect_uri:callback(env)}),redirect:"error"});
  const body=await res.json<any>().catch(()=>({}));if(!res.ok||!body.refresh_token)throw new Error("Google did not return an offline Analytics authorization. Reconnect and approve access.");
  const encrypted=await encryptToken(String(body.refresh_token),env.TOKEN_ENCRYPTION_KEY),scopes=String(body.scope||SCOPE).split(/\s+/).filter(Boolean);
  await env.DB.prepare(`INSERT INTO analytics_connections(shop_domain,provider,encrypted_refresh_token,scopes_json,property_id,status,connected_ms,updated_ms)
    VALUES(?,'ga4',?,? ,NULL,'connected',?,?) ON CONFLICT(shop_domain,provider) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,
    scopes_json=excluded.scopes_json,status='connected',updated_ms=excluded.updated_ms`).bind(shop,encrypted,JSON.stringify(scopes),nowMs,nowMs).run();
  return {shop,status:"connected",scopes,note:"The refresh token is encrypted at rest and is never returned to the browser."};
}

export async function configureGa4Property(env:Env,shop:string,propertyId:string){
  if(!/^\d{4,20}$/.test(propertyId))throw new Error("Enter the numeric GA4 property ID.");
  const result=await env.DB.prepare("UPDATE analytics_connections SET property_id=?,updated_ms=? WHERE shop_domain=? AND provider='ga4' AND status='connected'")
    .bind(propertyId,Date.now(),shop).run();
  if(!Number((result as any)?.meta?.changes||0))throw new Error("Connect GA4 before selecting a property.");
  return ga4ConnectionStatus(env,shop);
}

export async function ga4ConnectionStatus(env:Env,shop:string){
  const row=await env.DB.prepare("SELECT provider,scopes_json,property_id,status,connected_ms,updated_ms FROM analytics_connections WHERE shop_domain=? AND provider='ga4'")
    .bind(shop).first<any>();
  return row?{provider:"ga4",status:row.status,propertyId:row.property_id||null,scopes:JSON.parse(String(row.scopes_json||"[]")),
    connectedMs:Number(row.connected_ms),updatedMs:Number(row.updated_ms)}:{provider:"ga4",status:"not_connected",propertyId:null,scopes:[]};
}

async function accessToken(env:Env,encrypted:string,fetcher:typeof fetch){
  configured(env);const refresh=await decryptToken(encrypted,env.TOKEN_ENCRYPTION_KEY);
  const res=await fetcher("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,refresh_token:refresh,grant_type:"refresh_token"}),redirect:"error"});
  const body=await res.json<any>().catch(()=>({}));if(!res.ok||!body.access_token)throw new Error("GA4 authorization could not be refreshed. Reconnect Google Analytics.");
  return String(body.access_token);
}

const KNOWN_AI=/chatgpt|openai|perplexity|gemini|bard|claude|anthropic|copilot|bing/i;
export async function importGa4Report(env:Env,shop:string,input:{startDate:string;endDate:string},fetcher:typeof fetch=fetch){
  const connection=await env.DB.prepare("SELECT encrypted_refresh_token,property_id FROM analytics_connections WHERE shop_domain=? AND provider='ga4' AND status='connected'")
    .bind(shop).first<{encrypted_refresh_token:string;property_id:string}>();
  if(!connection?.encrypted_refresh_token||!connection.property_id)throw new Error("Connect GA4 and select a property before importing referrals.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))throw new Error("GA4 import dates must use YYYY-MM-DD.");
  const token=await accessToken(env,connection.encrypted_refresh_token,fetcher);
  const res=await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${connection.property_id}:runReport`,{method:"POST",
    headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},redirect:"error",body:JSON.stringify({
      dateRanges:[{startDate:input.startDate,endDate:input.endDate}],dimensions:[{name:"sessionSource"},{name:"landingPagePlusQueryString"},{name:"country"},{name:"deviceCategory"}],
      metrics:[{name:"sessions"},{name:"engagedSessions"},{name:"keyEvents"},{name:"totalRevenue"}],limit:"10000"})});
  const body=await res.json<any>().catch(()=>({}));if(!res.ok)throw new Error(`GA4 report failed with HTTP ${res.status}.`);
  const currency=body.metadata?.currencyCode?String(body.metadata.currencyCode):undefined;
  const rows:ReferralImportRow[]=(Array.isArray(body.rows)?body.rows:[]).map((row:any)=>{const d=row.dimensionValues||[],m=row.metricValues||[];return {
    source:String(d[0]?.value||""),landingPage:String(d[1]?.value||""),country:String(d[2]?.value||""),device:String(d[3]?.value||""),
    sessions:Number(m[0]?.value||0),engagedSessions:Number(m[1]?.value||0),conversions:Number(m[2]?.value||0),revenue:Number(m[3]?.value||0),currency};})
    .filter((row:ReferralImportRow)=>KNOWN_AI.test(String(row.source||"")));
  if(!rows.length)throw new Error("GA4 returned no recognised AI-assistant referral rows for that window.");
  return importAuthorisedReferrals(env,shop,{provider:"ga4",windowStart:input.startDate,windowEnd:input.endDate,rows});
}
