import type {Env} from "../types";
import type {NormalizedBusiness,NormalizedItem} from "./types";

export async function saveBusinessProfile(env:Env,shop:string,b:NormalizedBusiness,nowMs=Date.now()){
  await env.DB.prepare(`INSERT INTO business_profiles(shop_domain,name,description,contact_email,contact_phone,
      address_json,currency,primary_url,policies_json,synced_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(shop_domain) DO UPDATE SET name=excluded.name,description=excluded.description,
      contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,address_json=excluded.address_json,
      currency=excluded.currency,primary_url=excluded.primary_url,policies_json=excluded.policies_json,
      synced_ms=excluded.synced_ms`)
    .bind(shop,b.name,b.description,b.contactEmail,b.contactPhone,JSON.stringify(b.address),
      b.currency,b.primaryUrl,JSON.stringify(b.policies),nowMs).run();
}

export async function saveCatalog(env:Env,shop:string,items:NormalizedItem[],nowMs=Date.now()){
  if(!items.length)return 0;
  // Written in chunks: D1 batches are bounded, and one oversized batch would fail whole.
  for(let i=0;i<items.length;i+=25){
    await env.DB.batch(items.slice(i,i+25).map(it=>env.DB.prepare(
      `INSERT INTO catalog_items(shop_domain,item_id,handle,title,description,product_type,vendor,url,image_url,image_alt,
         price_min,price_max,currency,available,variants_json,seo_title,seo_description,identifiers_json,status,synced_ms)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(shop_domain,item_id) DO UPDATE SET handle=excluded.handle,title=excluded.title,
         description=excluded.description,product_type=excluded.product_type,vendor=excluded.vendor,url=excluded.url,
         image_url=excluded.image_url,image_alt=excluded.image_alt,price_min=excluded.price_min,price_max=excluded.price_max,
         currency=excluded.currency,available=excluded.available,variants_json=excluded.variants_json,
         seo_title=excluded.seo_title,seo_description=excluded.seo_description,identifiers_json=excluded.identifiers_json,
         status=excluded.status,synced_ms=excluded.synced_ms`)
      .bind(shop,it.id,it.handle,it.title,it.description,it.productType,it.vendor,it.url,it.imageUrl,it.imageAlt,
        it.priceMin,it.priceMax,it.currency,it.available?1:0,JSON.stringify(it.variants),it.seoTitle,it.seoDescription,
        JSON.stringify(it.identifiers),it.status,nowMs)));
  }
  // Products deleted upstream must not linger in a public AI profile.
  await env.DB.prepare("DELETE FROM catalog_items WHERE shop_domain=? AND synced_ms<?").bind(shop,nowMs).run();
  return items.length;
}

export async function getBusinessProfile(env:Env,shop:string){
  return env.DB.prepare("SELECT * FROM business_profiles WHERE shop_domain=?").bind(shop).first<Record<string,unknown>>();
}

export async function getCatalog(env:Env,shop:string,limit=100,offset=0){
  const rows=await env.DB.prepare(`SELECT * FROM catalog_items WHERE shop_domain=?
    ORDER BY title LIMIT ? OFFSET ?`).bind(shop,limit,offset).all();
  return rows.results as Array<Record<string,unknown>>;
}

export async function getCatalogItem(env:Env,shop:string,idOrHandle:string){
  return env.DB.prepare(`SELECT * FROM catalog_items WHERE shop_domain=? AND (item_id=? OR handle=?)`)
    .bind(shop,idOrHandle,idOrHandle).first<Record<string,unknown>>();
}

export async function searchCatalog(env:Env,shop:string,query:string,limit=20){
  // Strip LIKE wildcards so a query cannot widen its own match. If nothing is left, the
  // search is empty rather than matching the entire catalogue.
  const cleaned=query.toLowerCase().replace(/[%_]/g,"").trim();
  if(!cleaned)return [];
  const like=`%${cleaned}%`;
  const rows=await env.DB.prepare(`SELECT * FROM catalog_items WHERE shop_domain=?
    AND (lower(title) LIKE ? OR lower(description) LIKE ? OR lower(product_type) LIKE ? OR lower(vendor) LIKE ?)
    ORDER BY title LIMIT ?`).bind(shop,like,like,like,like,limit).all();
  return rows.results as Array<Record<string,unknown>>;
}

export async function recordSyncRun(env:Env,shop:string,kind:string,status:string,items:number,error:string|null,nowMs=Date.now()){
  const rand=new Uint8Array(6);crypto.getRandomValues(rand);
  const id=`sync_${nowMs.toString(36)}_${Array.from(rand,b=>b.toString(16).padStart(2,"0")).join("")}`;
  await env.DB.prepare(`INSERT INTO sync_runs(id,shop_domain,kind,status,items,error,started_ms,completed_ms)
    VALUES(?,?,?,?,?,?,?,?)`).bind(id,shop,kind,status,items,error?String(error).slice(0,500):null,nowMs,nowMs).run();
  return id;
}

export async function getLastSync(env:Env,shop:string){
  return env.DB.prepare("SELECT * FROM sync_runs WHERE shop_domain=? ORDER BY started_ms DESC LIMIT 1")
    .bind(shop).first<Record<string,unknown>>();
}
