import type { Env } from "./types";

const scopes=["read_products","write_pixels","read_customer_events"];
const encoder=new TextEncoder();

export function validShop(shop:string){return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);}
export function randomState(){const b=new Uint8Array(24);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");}

async function hmacBytes(secret:string,message:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(message)));
}
function hex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
function b64(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function fromB64(value:string){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0));}
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}

export function installUrl(env:Env,shop:string,state:string){
  const redirect=`${env.APP_URL}/api/shopify/callback`;
  const p=new URLSearchParams({client_id:env.SHOPIFY_API_KEY,scope:scopes.join(","),redirect_uri:redirect,state});
  return `https://${shop}/admin/oauth/authorize?${p.toString()}`;
}

export async function verifyOAuthHmac(url:URL,secret:string){
  const given=url.searchParams.get("hmac")||"";
  const message=[...url.searchParams.entries()].filter(([k])=>k!=="hmac"&&k!=="signature").sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&");
  return safeEqual(given,hex(await hmacBytes(secret,message)));
}

export async function exchangeCode(env:Env,shop:string,code:string){
  const res=await fetch(`https://${shop}/admin/oauth/access_token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({client_id:env.SHOPIFY_API_KEY,client_secret:env.SHOPIFY_API_SECRET,code})});
  if(!res.ok)throw new Error(`Shopify token exchange failed (${res.status}).`);
  const data=await res.json<{access_token:string}>();
  if(!data.access_token)throw new Error("Shopify returned no access token.");
  return data.access_token;
}

async function aesKey(secret:string){
  const digest=await crypto.subtle.digest("SHA-256",encoder.encode(secret));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
export async function encryptToken(token:string,secret:string){
  const iv=new Uint8Array(12);crypto.getRandomValues(iv);
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(secret),encoder.encode(token)));
  return `${b64(iv)}.${b64(encrypted)}`;
}
export async function decryptToken(value:string,secret:string){
  const [a,b]=value.split(".");if(!a||!b)throw new Error("Invalid encrypted token.");
  const out=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(a)},await aesKey(secret),fromB64(b));
  return new TextDecoder().decode(out);
}

export async function createWebPixel(env:Env,shop:string,accessToken:string){
  const query=`mutation Pixel($webPixel: WebPixelInput!){webPixelCreate(webPixel:$webPixel){webPixel{id settings} userErrors{field message code}}}`;
  const variables={webPixel:{settings:{endpoint:`${env.APP_URL}/api/events`,shop}}};
  const res=await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,{method:"POST",headers:{"content-type":"application/json","x-shopify-access-token":accessToken},body:JSON.stringify({query,variables})});
  if(!res.ok)throw new Error(`Could not activate AgentCart pixel (${res.status}).`);
  const json=await res.json<any>();
  const result=json?.data?.webPixelCreate;
  if(result?.userErrors?.length)throw new Error(result.userErrors.map((e:any)=>e.message).join("; "));
  return result?.webPixel?.id as string|undefined;
}

export async function sessionCookie(secret:string,shop:string){
  const sig=hex(await hmacBytes(secret,shop));
  return `agentcart_session=${encodeURIComponent(`${shop}.${sig}`)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}
export async function shopFromCookie(secret:string,cookie:string|null){
  const match=(cookie||"").match(/(?:^|;\s*)agentcart_session=([^;]+)/);if(!match)return null;
  const value=decodeURIComponent(match[1]);const cut=value.lastIndexOf(".");if(cut<1)return null;
  const shop=value.slice(0,cut),sig=value.slice(cut+1);return safeEqual(sig,hex(await hmacBytes(secret,shop)))?shop:null;
}

export async function verifyWebhookHmac(secret:string,raw:string,header:string|null){
  if(!header)return false;return safeEqual(header,b64(await hmacBytes(secret,raw)));
}
