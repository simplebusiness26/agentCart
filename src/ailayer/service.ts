import type {Env} from "../types";
import {getBusinessProfile,getCatalog,getCatalogItem,searchCatalog} from "../platform";

// The single source of truth for everything AgentCart tells an AI system about a
// business. The JSON endpoints and the MCP tool adapter are both thin wrappers over
// these functions -- there is deliberately no second path that could drift.
//
// SAFETY: only fields explicitly listed here are ever emitted. Access tokens, ingest
// tokens, session data, internal analytics and anything customer-derived are absent by
// construction rather than by filtering, and a test asserts it against a seeded database.

export interface AiAction {
  type:string;
  supported:boolean;
  url?:string;
  description:string;
  source:string;
  limitations?:string;
}

export function slugFor(shop:string){
  return shop.replace(/\.myshopify\.com$/i,"").toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"")||"store";
}

export async function resolveSlug(env:Env,slug:string){
  const row=await env.DB.prepare("SELECT shop_domain,slug,version,active FROM ai_profiles WHERE slug=? AND active=1")
    .bind(slug.toLowerCase()).first<{shop_domain:string;slug:string;version:number;active:number}>();
  return row||null;
}

export async function ensureProfile(env:Env,shop:string,nowMs=Date.now()){
  const existing=await env.DB.prepare("SELECT slug FROM ai_profiles WHERE shop_domain=?").bind(shop).first<{slug:string}>();
  if(existing)return existing.slug;
  // A slug collision between two stores would cross-serve their data, so disambiguate.
  let slug=slugFor(shop);
  for(let n=2;n<50;n++){
    const taken=await env.DB.prepare("SELECT 1 AS x FROM ai_profiles WHERE slug=?").bind(slug).first();
    if(!taken)break;
    slug=`${slugFor(shop)}-${n}`;
  }
  await env.DB.prepare(`INSERT INTO ai_profiles(shop_domain,slug,version,active,last_generated_ms) VALUES(?,?,1,1,?)`)
    .bind(shop,slug,nowMs).run();
  return slug;
}

export async function setProfileActive(env:Env,shop:string,active:boolean){
  await env.DB.prepare("UPDATE ai_profiles SET active=?,version=version+1 WHERE shop_domain=?")
    .bind(active?1:0,shop).run();
}

export async function getProfileMeta(env:Env,shop:string){
  return env.DB.prepare("SELECT slug,version,active,last_generated_ms FROM ai_profiles WHERE shop_domain=?")
    .bind(shop).first<Record<string,unknown>>();
}

function parse<T>(v:unknown,fallback:T):T{
  try{return v?JSON.parse(String(v)) as T:fallback;}catch{return fallback;}
}

export async function getBusiness(env:Env,shop:string,slug:string){
  const p=await getBusinessProfile(env,shop);
  if(!p)return null;
  const address=parse<Record<string,string>>(p.address_json,{});
  return {
    slug,
    name:String(p.name||""),
    description:String(p.description||""),
    website:String(p.primary_url||""),
    currency:String(p.currency||""),
    contact:{email:String(p.contact_email||""),phone:String(p.contact_phone||"")},
    location:{city:address.city||"",region:address.province||"",postalCode:address.zip||"",country:address.country||""},
    lastUpdated:new Date(Number(p.synced_ms||0)).toISOString(),
    provenance:"Synced from the merchant's connected Shopify store."
  };
}

function itemView(row:Record<string,unknown>,detailed=false){
  const base={
    id:String(row.item_id||""),
    handle:String(row.handle||""),
    title:String(row.title||""),
    url:String(row.url||""),
    price:{min:row.price_min==null?null:Number(row.price_min),max:row.price_max==null?null:Number(row.price_max),
      currency:String(row.currency||"")},
    available:!!Number(row.available||0),
    category:String(row.product_type||""),
    brand:String(row.vendor||"")
  };
  if(!detailed)return base;
  return {...base,
    description:String(row.description||""),
    image:{url:String(row.image_url||""),alt:String(row.image_alt||"")},
    identifiers:parse<Record<string,string>>(row.identifiers_json,{}),
    variants:parse<Array<Record<string,unknown>>>(row.variants_json,[]).map(v=>({
      title:String(v.title||""),price:v.price==null?null:Number(v.price),
      available:!!v.available,sku:String(v.sku||"")})),
    lastUpdated:new Date(Number(row.synced_ms||0)).toISOString()
  };
}

export async function getCatalogView(env:Env,shop:string,limit=50,offset=0){
  return (await getCatalog(env,shop,Math.min(Math.max(1,limit),200),Math.max(0,offset))).map(r=>itemView(r));
}

export async function getItemView(env:Env,shop:string,idOrHandle:string){
  const row=await getCatalogItem(env,shop,idOrHandle);
  return row?itemView(row,true):null;
}

export async function searchCatalogView(env:Env,shop:string,query:string,limit=20){
  return (await searchCatalog(env,shop,query,Math.min(Math.max(1,limit),50))).map(r=>itemView(r));
}

export async function getPolicies(env:Env,shop:string){
  const p=await getBusinessProfile(env,shop);
  if(!p)return [];
  return parse<Array<{type:string;title:string;url:string;body:string}>>(p.policies_json,[])
    .map(x=>({type:x.type,title:x.title,url:x.url,summary:String(x.body||"").slice(0,1200)}));
}

// The action model describes and links. It never claims AgentCart can transact for a
// customer, because it cannot -- telling an assistant otherwise would be the most
// damaging thing this layer could do.
export async function getActions(env:Env,shop:string):Promise<AiAction[]>{
  const profile=await getBusinessProfile(env,shop);
  const items=await getCatalog(env,shop,1,0);
  const hasCatalog=items.length>0;
  const site=String(profile?.primary_url||`https://${shop}`).replace(/\/$/,"");
  const email=String(profile?.contact_email||"");
  const phone=String(profile?.contact_phone||"");
  return [
    {type:"view_product",supported:hasCatalog,url:hasCatalog?String(items[0].url||site):undefined,
     description:"Open a product page on the merchant's own website.",
     source:"Merchant catalogue synced from Shopify.",
     limitations:hasCatalog?undefined:"No catalogue has been synced for this business yet."},
    {type:"browse_catalog",supported:hasCatalog,url:hasCatalog?`${site}/collections/all`:undefined,
     description:"Browse the merchant's full catalogue.",
     source:"Merchant storefront.",
     limitations:hasCatalog?undefined:"No catalogue has been synced for this business yet."},
    {type:"add_to_cart",supported:false,
     description:"Add an item to the customer's cart.",
     source:"Not implemented.",
     limitations:"AgentCart does not place items in a cart. Send the customer to the product page instead."},
    {type:"purchase",supported:false,
     description:"Complete a purchase on the customer's behalf.",
     source:"Not implemented.",
     limitations:"AgentCart never transacts for a customer. Checkout happens on the merchant's own site."},
    {type:"contact_by_email",supported:!!email,url:email?`mailto:${email}`:undefined,
     description:"Contact the business by email.",
     source:"Merchant's published contact address.",
     limitations:email?undefined:"The business has not published a contact email."},
    {type:"contact_by_phone",supported:!!phone,url:phone?`tel:${phone.replace(/[^\d+]/g,"")}`:undefined,
     description:"Contact the business by telephone.",
     source:"Merchant's published contact number.",
     limitations:phone?undefined:"The business has not published a contact number."}
  ];
}

export async function buildProfile(env:Env,shop:string,slug:string){
  const [business,catalogSample,policies,actions]=await Promise.all([
    getBusiness(env,shop,slug),getCatalogView(env,shop,50),getPolicies(env,shop),getActions(env,shop)
  ]);
  if(!business)return null;
  return {business,catalogSample,policies,actions,catalogUrl:`/api/ai/${slug}/catalog`,schemaVersion:"1.0"};
}
