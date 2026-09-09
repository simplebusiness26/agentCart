import type { Env, PixelEventPayload } from "./types";

export async function putOAuthState(env:Env,state:string,shop:string){
  // Abandoned installs would otherwise accumulate forever; sweep here rather than
  // adding a cron trigger for a table that grows one row per install attempt.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_states WHERE expires_at<?").bind(Date.now()),
    env.DB.prepare("INSERT OR REPLACE INTO oauth_states(state,shop_domain,expires_at) VALUES(?,?,?)").bind(state,shop,Date.now()+600000)
  ]);
}

export async function consumeOAuthState(env:Env,state:string,shop:string){
  const row=await env.DB.prepare("SELECT shop_domain,expires_at FROM oauth_states WHERE state=?").bind(state).first<{shop_domain:string;expires_at:number}>();
  await env.DB.prepare("DELETE FROM oauth_states WHERE state=?").bind(state).run();
  return !!row&&row.shop_domain===shop&&row.expires_at>Date.now();
}

export async function saveShop(env:Env,shop:string,encryptedToken:string,pixelId?:string|null,sessionEpoch=Date.now()){
  await env.DB.prepare(`INSERT INTO shops(shop_domain,encrypted_access_token,pixel_id,session_epoch,installed_at,updated_at)
    VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT(shop_domain) DO UPDATE SET encrypted_access_token=excluded.encrypted_access_token,
    pixel_id=COALESCE(excluded.pixel_id,shops.pixel_id),session_epoch=excluded.session_epoch,updated_at=CURRENT_TIMESTAMP`)
    .bind(shop,encryptedToken,pixelId??null,sessionEpoch).run();
}

export async function getShop(env:Env,shop:string){
  return env.DB.prepare("SELECT shop_domain,encrypted_access_token,pixel_id,session_epoch FROM shops WHERE shop_domain=?").bind(shop).first<{shop_domain:string;encrypted_access_token:string;pixel_id:string|null;session_epoch:number}>();
}

export async function updatePixelId(env:Env,shop:string,pixelId:string){
  await env.DB.prepare("UPDATE shops SET pixel_id=?,updated_at=CURRENT_TIMESTAMP WHERE shop_domain=?").bind(pixelId,shop).run();
}

export async function deleteShop(env:Env,shop:string){
  // `scans` is keyed on the scanned hostname and has no link to `shops`, so only the
  // case where the merchant scanned their own myshopify domain can be matched. Anything
  // stronger would need a join that does not exist; the privacy page says so.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM events WHERE shop_domain=?").bind(shop),
    env.DB.prepare("DELETE FROM oauth_states WHERE shop_domain=?").bind(shop),
    env.DB.prepare("DELETE FROM scans WHERE domain=?").bind(shop),
    env.DB.prepare("DELETE FROM shops WHERE shop_domain=?").bind(shop)
  ]);
}

export async function logComplianceRequest(env:Env,shop:string,topic:string,customerId:string|null,orderIds:string[],matched:number){
  await env.DB.prepare("INSERT INTO compliance_requests(shop_domain,topic,customer_id,order_ids_json,matched_events) VALUES(?,?,?,?,?)")
    .bind(shop,topic,customerId||null,JSON.stringify(orderIds),matched).run();
}

function orderPlaceholders(orderIds:string[]){return orderIds.map(()=>"?").join(",");}

export async function countCustomerEvents(env:Env,shop:string,orderIds:string[]){
  if(!orderIds.length)return 0;
  const row=await env.DB.prepare(`SELECT COUNT(*) AS c FROM events WHERE shop_domain=? AND order_id IN (${orderPlaceholders(orderIds)})`)
    .bind(shop,...orderIds).first<{c:number}>();
  return Number(row?.c||0);
}

export async function redactCustomer(env:Env,shop:string,orderIds:string[]){
  if(!orderIds.length)return 0;
  const ph=orderPlaceholders(orderIds);
  // Delete the identified orders' events, then anything else sharing those browsing
  // sessions -- that is the same person's activity and is in scope for a redaction.
  const before=await countCustomerEvents(env,shop,orderIds);
  await env.DB.prepare(`DELETE FROM events WHERE shop_domain=? AND session_id IS NOT NULL AND session_id IN (
      SELECT session_id FROM events WHERE shop_domain=? AND order_id IN (${ph}) AND session_id IS NOT NULL)`)
    .bind(shop,shop,...orderIds).run();
  await env.DB.prepare(`DELETE FROM events WHERE shop_domain=? AND order_id IN (${ph})`).bind(shop,...orderIds).run();
  return before;
}

export async function insertEvent(env:Env,event:PixelEventPayload,sourceAgent:string,sourceHost:string){
  // An unparseable timestamp falls back to arrival time rather than dropping the event:
  // a slightly misdated event is far less harmful than a silently discarded order.
  const parsed=Date.parse(event.occurredAt);
  const occurredMs=Number.isNaN(parsed)?Date.now():parsed;
  await env.DB.prepare(`INSERT OR IGNORE INTO events(
    event_id,shop_domain,event_type,occurred_at,occurred_ms,source_agent,source_host,landing_url,product_id,product_title,order_id,amount,currency,session_id,payload_json
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    event.eventId,event.shop,event.eventType,event.occurredAt,occurredMs,sourceAgent,sourceHost||null,event.landingUrl||null,
    event.productId||null,event.productTitle||null,event.orderId||null,typeof event.amount==="number"?event.amount:null,
    event.currency||null,event.sessionId||null,JSON.stringify(event.raw??null)
  ).run();
}

export async function saveScan(env:Env,domain:string,score:number,findings:unknown){
  await env.DB.batch([
    env.DB.prepare("INSERT INTO scans(domain,score,findings_json) VALUES(?,?,?)").bind(domain,score,JSON.stringify(findings)),
    // Anyone can write here, so cap how long it is kept rather than only how fast it grows.
    env.DB.prepare("DELETE FROM scans WHERE created_at < datetime('now','-90 day')")
  ]);
}

export const WINDOW_MS=30*24*60*60*1000;

export async function getDashboard(env:Env,shop:string,fromMs:number,toMs:number){
  const summary=await env.DB.prepare(`SELECT COUNT(*) AS events,
    COUNT(DISTINCT CASE WHEN event_type='page_viewed' THEN session_id END) AS visits,
    COUNT(DISTINCT CASE WHEN event_type='checkout_completed' THEN order_id END) AS orders,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND occurred_ms>=? AND occurred_ms<?`).bind(shop,fromMs,toMs).first();
  const sources=await env.DB.prepare(`SELECT source_agent AS source,
    COUNT(DISTINCT CASE WHEN event_type='page_viewed' THEN session_id END) AS visits,
    COUNT(DISTINCT CASE WHEN event_type='checkout_completed' THEN order_id END) AS orders,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND occurred_ms>=? AND occurred_ms<?
    GROUP BY source_agent ORDER BY revenue DESC`).bind(shop,fromMs,toMs).all();
  const funnel=await env.DB.prepare(`SELECT event_type,COUNT(*) AS count FROM events
    WHERE shop_domain=? AND occurred_ms>=? AND occurred_ms<? GROUP BY event_type`).bind(shop,fromMs,toMs).all();
  const topProducts=await env.DB.prepare(`SELECT product_title AS product, product_id,
    COUNT(*) AS events,
    COALESCE(SUM(CASE WHEN event_type='checkout_completed' THEN amount ELSE 0 END),0) AS revenue
    FROM events WHERE shop_domain=? AND product_title IS NOT NULL AND occurred_ms>=? AND occurred_ms<?
    GROUP BY product_id, product_title ORDER BY revenue DESC, events DESC LIMIT 8`).bind(shop,fromMs,toMs).all();
  // Summing across currencies is wrong however it is formatted, so report which currency
  // dominates and how many were seen; the UI says so rather than inventing conversion.
  const currency=await env.DB.prepare(`SELECT currency, COUNT(*) AS n FROM events
    WHERE shop_domain=? AND currency IS NOT NULL AND event_type='checkout_completed'
    AND occurred_ms>=? AND occurred_ms<? GROUP BY currency ORDER BY n DESC LIMIT 1`).bind(shop,fromMs,toMs).first<{currency:string}>();
  const currencyCount=await env.DB.prepare(`SELECT COUNT(DISTINCT currency) AS c FROM events
    WHERE shop_domain=? AND currency IS NOT NULL AND event_type='checkout_completed'
    AND occurred_ms>=? AND occurred_ms<?`).bind(shop,fromMs,toMs).first<{c:number}>();
  return {summary,sources:sources.results,funnel:funnel.results,topProducts:topProducts.results,
    currency:currency?.currency||null,currencyCount:Number(currencyCount?.c||0)};
}

// Current window plus the one immediately before it, for trend deltas. The two ranges are
// half-open and share a boundary, so no event can be counted in both.
export async function getDashboardWindows(env:Env,shop:string,nowMs:number){
  // Anchor one millisecond past now so an event stamped exactly now still counts;
  // both ranges stay half-open and share a boundary, so nothing lands in both.
  const anchor=nowMs+1;
  const current=await getDashboard(env,shop,anchor-WINDOW_MS,anchor);
  const prior=await getDashboard(env,shop,anchor-2*WINDOW_MS,anchor-WINDOW_MS);
  return {...current,previous:prior.summary};
}

// Fixed-window rate limiting in D1. Cloudflare's native rate-limit binding would avoid
// these writes, but it is per-colo and cannot be exercised without workerd, so correctness
// would rest on untested code. See wrangler.toml for the scale-up path.
export async function rateLimit(env:Env,kind:string,key:string,limit:number,windowMs:number){
  const now=Date.now();
  const bucket=`${kind}:${key}:${Math.floor(now/windowMs)}`;
  const row=await env.DB.prepare(`INSERT INTO rate_buckets(bucket,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`).bind(bucket,now+windowMs).first<{count:number}>();
  const count=Number(row?.count||1);
  if(count===1)await env.DB.prepare("DELETE FROM rate_buckets WHERE expires_at<?").bind(now).run().catch(()=>{});
  return {ok:count<=limit,count,limit,retryAfter:Math.ceil((Math.floor(now/windowMs)*windowMs+windowMs-now)/1000)};
}
