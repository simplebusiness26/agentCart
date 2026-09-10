import type {Env} from "./types";
import {redact} from "./launch/gate";

// Operational observability (Phase 11.4). Enough to diagnose a broken merchant connection,
// deliberately not enough to become an analytics store: structured, low-cardinality, retained
// briefly, and scrubbed of anything that looks like a credential.

export type OpsSeverity="info"|"warn"|"error";

export async function recordOps(env:Env,kind:string,severity:OpsSeverity,message:string,ctx:{shop?:string;context?:Record<string,unknown>}={},nowMs=Date.now()){
  try{
    await env.DB.prepare(`INSERT INTO ops_events(shop_domain,kind,severity,message,context_json,created_ms)
      VALUES(?,?,?,?,?,?)`)
      .bind(ctx.shop||null,kind,severity,redact(message),
        ctx.context?redact(JSON.stringify(ctx.context)):null,nowMs).run();
    // Keep 14 days. Observability that grows without bound becomes a liability.
    if(Math.random()<0.02)
      await env.DB.prepare("DELETE FROM ops_events WHERE created_ms<?").bind(nowMs-14*24*60*60*1000).run();
  }catch{/* observability must never break the request it is observing */}
}

export async function recentOps(env:Env,shop:string,limit=50){
  const rows=await env.DB.prepare(`SELECT kind,severity,message,context_json,created_ms FROM ops_events
    WHERE shop_domain=? OR shop_domain IS NULL ORDER BY created_ms DESC LIMIT ?`).bind(shop,limit).all();
  return rows.results as Array<Record<string,unknown>>;
}

// ---------------------------------------------------------------------------
// Connection health (Phase 11.3)
// ---------------------------------------------------------------------------

export type HealthState="ok"|"degraded"|"broken"|"unknown";

export interface HealthCheck {
  key:string;
  label:string;
  state:HealthState;
  detail:string;
  /** What the merchant can do about it, in their words. */
  fix:string;
}

export interface ConnectionHealth {
  overall:HealthState;
  checks:HealthCheck[];
  summary:string;
}

/** Self-diagnosis of one merchant's connection. Every check says what to do about it, because a
 *  health page that only reports "degraded" makes the merchant do the diagnosis themselves. */
export async function connectionHealth(env:Env,shop:string,nowMs=Date.now()):Promise<ConnectionHealth>{
  const checks:HealthCheck[]=[];
  const add=(c:HealthCheck)=>checks.push(c);

  const store=await env.DB.prepare("SELECT pixel_id,ingest_token,session_epoch FROM shops WHERE shop_domain=?")
    .bind(shop).first<{pixel_id:string|null;ingest_token:string|null;session_epoch:number}>();
  if(!store)
    return {overall:"broken",summary:"This store is not connected to AgentCart.",
      checks:[{key:"installed",label:"Store is connected",state:"broken",
        detail:"No record of this store exists.",fix:"Reinstall AgentCart from your Shopify admin."}]};

  add({key:"installed",label:"Store is connected",state:"ok",
    detail:"AgentCart has an active record for this store.",fix:"No action needed."});

  add({key:"pixel",label:"Attribution pixel is active",
    state:store.pixel_id?"ok":"degraded",
    detail:store.pixel_id?"A Web Pixel is registered for this store."
      :"No Web Pixel is registered, so browser-side attribution will stay empty.",
    fix:store.pixel_id?"No action needed."
      :"Reconnect AgentCart from the home page, or activate the AgentCart pixel under Settings then Customer events in Shopify."});

  const events=await env.DB.prepare(
    "SELECT COUNT(*) AS c, MAX(occurred_ms) AS last FROM events WHERE shop_domain=?")
    .bind(shop).first<{c:number;last:number}>();
  const total=Number(events?.c||0);
  const lastMs=Number(events?.last||0);
  const staleDays=lastMs?Math.floor((nowMs-lastMs)/86400000):null;
  add({key:"events",label:"Events are arriving",
    state:!total?"degraded":staleDays!==null&&staleDays>7?"degraded":"ok",
    detail:!total?"No storefront events have ever been received."
      :staleDays!==null&&staleDays>7?`The most recent event arrived ${staleDays} days ago.`
      :`${total} event(s) received, most recently ${staleDays===0?"today":`${staleDays} day(s) ago`}.`,
    fix:!total?"Visit your storefront once and check the pixel is active. If nothing arrives, reconnect AgentCart."
      :staleDays!==null&&staleDays>7?"If your store is getting traffic, check the AgentCart pixel is still active in Shopify."
      :"No action needed."});

  const sync=await env.DB.prepare("SELECT status,items,started_ms,error FROM sync_runs WHERE shop_domain=? ORDER BY started_ms DESC LIMIT 1")
    .bind(shop).first<{status:string;items:number;started_ms:number;error:string}>();
  add({key:"sync",label:"Catalogue is syncing",
    state:!sync?"unknown":sync.status==="complete"?"ok":sync.status==="needs_reauthorization"?"broken":"degraded",
    detail:!sync?"No catalogue sync has run yet."
      :sync.status==="complete"?`Last sync brought in ${Number(sync.items||0)} item(s).`
      :sync.status==="needs_reauthorization"?"The last sync failed because AgentCart is missing a permission."
      :`The last sync failed: ${String(sync.error||"unknown reason")}`,
    fix:!sync?"Run a sync from the dashboard."
      :sync.status==="needs_reauthorization"?"Reconnect your store to grant the missing permission."
      :sync.status==="complete"?"No action needed.":"Run the sync again. If it keeps failing, reconnect the store."});

  const profile=await env.DB.prepare("SELECT slug,active FROM ai_profiles WHERE shop_domain=?")
    .bind(shop).first<{slug:string;active:number}>();
  add({key:"ai-layer",label:"AI profile is published",
    state:!profile?"degraded":Number(profile.active)?"ok":"degraded",
    detail:!profile?"No AI profile has been created."
      :Number(profile.active)?`Published at /ai/${profile.slug}.`:"The AI profile exists but is switched off.",
    fix:!profile?"Publish your AI profile from the AI Layer tab."
      :Number(profile.active)?"No action needed.":"Switch the AI profile on from the AI Layer tab."});

  const errors=await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM ops_events WHERE shop_domain=? AND severity='error' AND created_ms>?")
    .bind(shop,nowMs-86400000).first<{c:number}>();
  const errorCount=Number(errors?.c||0);
  add({key:"errors",label:"No recent errors",
    state:errorCount>10?"degraded":errorCount>0?"ok":"ok",
    detail:errorCount?`${errorCount} error(s) recorded in the last 24 hours.`:"No errors recorded in the last 24 hours.",
    fix:errorCount>10?"Check the recent activity list below for a repeating problem.":"No action needed."});

  const overall:HealthState=checks.some(c=>c.state==="broken")?"broken"
    :checks.some(c=>c.state==="degraded")?"degraded"
    :checks.some(c=>c.state==="unknown")?"unknown":"ok";

  const problems=checks.filter(c=>c.state==="broken"||c.state==="degraded");
  return {overall,checks,
    summary:overall==="ok"?"Your AgentCart connection is healthy."
      :overall==="broken"?`Your connection needs attention: ${problems[0]?.label.toLowerCase()}.`
      :`Your connection is working but ${problems.length} thing(s) could be better.`};
}
