import type { Env, PixelEventPayload } from "./types";

export async function putOAuthState(env:Env,state:string,shop:string){
  await env.DB.prepare("INSERT OR REPLACE INTO oauth_states(state,shop_domain,expires_at) VALUES(?,?,?)").bind(state,shop,Date.now()+600000).run();
}

export async function consumeOAuthState(env:Env,state:string,shop:string){
  const row=await env.DB.prepare("SELECT shop_domain,expires_at FROM oauth_states WHERE state=?").bind(state).first<{shop_domain:string;expires_at:number}>();
  await env.DB.prepare("DELETE FROM oauth_states WHERE state=?").bind(state).run();
  return !!row&&row.shop_domain===shop&&row.expires_at>Date.now();
}

export async function saveShop(env:Env,shop:string,encryptedToken:string,pixelId?:string|null){
  await env.DB.prepare(`INSERT INTO shops(shop_domain,encrypted_access_token,pixel_id,installed_at,updated_at)
    VALUES(?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(shop_domain) DO UPDATE SET encrypted_access_token=excluded.encrypted_access_token,
    pixel_id=COALESCE(excluded.pixel_id,shops.pixel_id),updated_at=CURRENT_TIMESTAMP`).bind(shop,encryptedToken,pixelId??null).run();
}

export async function getShop(env:Env,shop:string){
  return env.DB.prepare("SELECT shop_domain,encrypted_access_token,pixel_id FROM shops WHERE shop_domain=?").bind(shop).first<{shop_domain:string;encrypted_access_token:string;pixel_id:string|null}>();
}

export async function updatePixelId(env:Env,shop:string,pixelId:string){
  await env.DB.prepare("UPDATE shops SET pixel_id=?,updated_at=CURRENT_TIMESTAMP WHERE shop_domain=?").bind(pixelId,shop).run();
}

export async function deleteShop(env:Env,shop:string){
  await env.DB.batch([
    env.DB.prepare("DELETE FROM events WHERE shop_domain=?").bind(shop),
    env.DB.prepare("DELETE FROM shops WHERE shop_domain=?").bind(shop)
  ]);
}

export async function insertEvent(env:Env,event:PixelEventPayload,sourceAgent:string,sourceHost:string){
  await env.DB.prepare(`INSERT OR IGNORE INTO events(
    event_id,shop_domain,event_type,occurred_at,source_agent,source_host,landing_url,product_id,product_title,order_id,amount,currency,session_id,payload_json
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    event.eventId,event.shop,event.eventType,event.occurredAt,sourceAgent,sourceHost||null,event.landingUrl||null,
    event.productId||null,event.productTitle||null,event.orderId||null,typeof event.amount==="number"?event.amount:null,
    event.currency||null,event.sessionId||null,JSON.stringify(event.raw??null)
  ).run();
}

export async function saveScan(env:Env,domain:string,score:number,findings:unknown){
  await env.DB.prepare("INSERT INTO scans(domain,score,findings_json) VALUES(?,?,?)").bind(domain,score,JSON.stringify(findings)).run();
}

export async function getDashboard(env:Env,shop:string){
  const summary=await env.DB.prepare(`SELECT COUNT(*) AS events,
    COUNT(DISTINCT CASE WHEN event_type='page_viewed' THEN session_id END) AS visits,
    COUNT(DISTINCT CASE WHEN event_type='checkout_completed' THEN order_id END) AS orders,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND occurred_at>=datetime('now','-30 day')`).bind(shop).first();
  const sources=await env.DB.prepare(`SELECT source_agent AS source,
    COUNT(DISTINCT CASE WHEN event_type='page_viewed' THEN session_id END) AS visits,
    COUNT(DISTINCT CASE WHEN event_type='checkout_completed' THEN order_id END) AS orders,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND occurred_at>=datetime('now','-30 day')
    GROUP BY source_agent ORDER BY revenue DESC`).bind(shop).all();
  const funnel=await env.DB.prepare(`SELECT event_type,COUNT(*) AS count FROM events
    WHERE shop_domain=? AND occurred_at>=datetime('now','-30 day') GROUP BY event_type`).bind(shop).all();
  const topProducts=await env.DB.prepare(`SELECT product_title AS product,
    COUNT(*) AS events,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND product_title IS NOT NULL AND occurred_at>=datetime('now','-30 day')
    GROUP BY product_title ORDER BY revenue DESC LIMIT 8`).bind(shop).all();
  return {summary,sources:sources.results,funnel:funnel.results,topProducts:topProducts.results};
}
