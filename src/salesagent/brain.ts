import type {Env} from "../types";
import type {BrainItem,BusinessBrain,BusinessFact} from "./types";

function parseObject(value:unknown):Record<string,unknown>{
  try{const out=JSON.parse(String(value||"{}"));return out&&typeof out==="object"&&!Array.isArray(out)?out:{};}
  catch{return {};}
}
function text(value:unknown){return value==null?"":String(value);}
function numberOrNull(value:unknown){const n=Number(value);return value==null||!Number.isFinite(n)?null:n;}
function stableId(value:string){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}

function fact(key:string,type:BusinessFact["type"],value:unknown,source:string,verifiedMs:number,options:Partial<BusinessFact>={}):BusinessFact{
  return {key,type,value,source,confidence:"verified",merchantApproved:false,publicSafe:true,verifiedMs,...options};
}

export async function buildBusinessBrain(env:Env,shop:string,nowMs=Date.now()):Promise<BusinessBrain>{
  const profile=await env.DB.prepare("SELECT * FROM business_profiles WHERE shop_domain=?").bind(shop).first<Record<string,unknown>>();
  if(!profile)throw new Error("Sync the business profile before creating its Business Brain.");
  const rows=await env.DB.prepare(`SELECT * FROM catalog_items WHERE shop_domain=? AND status!='archived'
    ORDER BY title LIMIT 500`).bind(shop).all<Record<string,unknown>>();
  const address=parseObject(profile.address_json),policies=parseObject(profile.policies_json);
  const synced=Number(profile.synced_ms||nowMs);
  const items:BrainItem[]=rows.results.map(row=>({
    id:text(row.item_id),handle:text(row.handle),title:text(row.title),description:text(row.description),
    category:text(row.product_type),vendor:text(row.vendor),url:text(row.url),
    priceMin:numberOrNull(row.price_min),priceMax:numberOrNull(row.price_max),currency:row.currency?text(row.currency):null,
    available:!!Number(row.available),syncedMs:Number(row.synced_ms||synced),source:"connected_catalog"
  }));
  const facts:BusinessFact[]=[
    fact("business.name","identity",text(profile.name),"business_profile",synced),
    fact("business.description","identity",text(profile.description),"business_profile",synced),
    fact("business.website","identity",text(profile.primary_url),"business_profile",synced),
    fact("business.contact.email","contact",profile.contact_email||null,"business_profile",synced),
    fact("business.contact.phone","contact",profile.contact_phone||null,"business_profile",synced),
    fact("business.location","location",address,"business_profile",synced),
    ...Object.entries(policies).map(([key,value])=>fact(`policy.${key}`,"policy",value,"connected_platform",synced))
  ].filter(f=>f.value!==""&&f.value!=null);
  for(const item of items){
    const base=`catalog.${item.id}`;
    facts.push(
      fact(`${base}.identity`,"catalog",{title:item.title,description:item.description,category:item.category,vendor:item.vendor,url:item.url},item.source,item.syncedMs,{sourceRecordId:item.id,freshnessMs:item.syncedMs}),
      fact(`${base}.price`,"catalog",{min:item.priceMin,max:item.priceMax,currency:item.currency},item.source,item.syncedMs,{sourceRecordId:item.id,freshnessMs:item.syncedMs}),
      fact(`${base}.availability`,"catalog",item.available,item.source,item.syncedMs,{sourceRecordId:item.id,freshnessMs:item.syncedMs})
    );
  }
  const version=`${synced}:${items.reduce((n,i)=>Math.max(n,i.syncedMs),0)}:${facts.length}`;
  return {shop,version,name:text(profile.name),description:text(profile.description),website:text(profile.primary_url),
    contact:{email:profile.contact_email?text(profile.contact_email):null,phone:profile.contact_phone?text(profile.contact_phone):null},
    location:address,policies,items,facts,generatedMs:nowMs};
}

export async function syncBusinessFacts(env:Env,brain:BusinessBrain){
  if(!brain.facts.length)return 0;
  for(let i=0;i<brain.facts.length;i+=50){
    await env.DB.batch(brain.facts.slice(i,i+50).map(f=>env.DB.prepare(`INSERT INTO business_facts(
      id,shop_domain,fact_key,fact_type,value_json,source,source_record_id,confidence,merchant_approved,public_safe,
      freshness_ms,verified_ms,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(shop_domain,fact_key,source) DO UPDATE SET value_json=excluded.value_json,
      source_record_id=excluded.source_record_id,confidence=excluded.confidence,merchant_approved=excluded.merchant_approved,
      public_safe=excluded.public_safe,freshness_ms=excluded.freshness_ms,verified_ms=excluded.verified_ms,version=business_facts.version+1`)
      .bind(`bf_${stableId(`${brain.shop}:${f.key}:${f.source}`)}`,brain.shop,f.key,f.type,JSON.stringify(f.value),f.source,
        f.sourceRecordId||null,f.confidence,f.merchantApproved?1:0,f.publicSafe?1:0,f.freshnessMs||null,f.verifiedMs)));
  }
  return brain.facts.length;
}

export function publicFacts(brain:BusinessBrain){return brain.facts.filter(f=>f.publicSafe&&f.confidence!=="unknown");}

