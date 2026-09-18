import type {Env} from "../types";
import type {PulseRun,PulseTarget} from "./types";

const cleanEndpoint=(raw:string)=>{const u=new URL(raw);u.hash="";u.username="";u.password="";return u.toString();};
const targetId=(shop:string,endpoint:string)=>{
  let h=2166136261;for(const c of `${shop}|${endpoint}|mcp-read`)h=Math.imul(h^c.charCodeAt(0),16777619);
  return `pulse_${(h>>>0).toString(16).padStart(8,"0")}`;
};

function journeyTargetId(shop:string,endpoint:string,journey:string){
  let h=2166136261;for(const c of `${shop}|${endpoint}|${journey}`)h=Math.imul(h^c.charCodeAt(0),16777619);
  return `pulse_${(h>>>0).toString(16).padStart(8,"0")}`;
}

export async function ensureHostedMcpTarget(env:Env,shop:string,endpoint:string,nowMs=Date.now()){
  const safe=cleanEndpoint(endpoint);
  const id=targetId(shop,safe);
  await env.DB.prepare(`INSERT INTO agentpulse_targets
    (id,shop_domain,label,protocol,transport,endpoint,auth_mode,journey,tool_name,tool_arguments_json,
     enabled,interval_ms,created_ms,updated_ms)
    VALUES(?,?,?,'mcp','streamable_http',?,'public','mcp_read','get_supported_actions','{}',1,86400000,?,?)
    ON CONFLICT(endpoint,journey) DO UPDATE SET shop_domain=excluded.shop_domain,label=excluded.label,
      tool_name=excluded.tool_name,tool_arguments_json=excluded.tool_arguments_json,
      updated_ms=excluded.updated_ms,enabled=1`)
    .bind(id,shop,`Hosted AI layer for ${shop}`,safe,nowMs,nowMs).run();
  return await env.DB.prepare("SELECT * FROM agentpulse_targets WHERE endpoint=? AND journey='mcp_read'")
    .bind(safe).first<PulseTarget>();
}

export async function ensurePublicMcpTarget(env:Env,input:{shop:string;label:string;endpoint:string;journey?:string},nowMs=Date.now()){
  const safe=cleanEndpoint(input.endpoint),journey=input.journey||"external_public_mcp";
  const id=journeyTargetId(input.shop,safe,journey);
  await env.DB.prepare(`INSERT INTO agentpulse_targets
    (id,shop_domain,label,protocol,transport,endpoint,auth_mode,journey,tool_name,tool_arguments_json,
     enabled,interval_ms,created_ms,updated_ms)
    VALUES(?,?,?,'mcp','streamable_http',?,'public',?,NULL,NULL,1,86400000,?,?)
    ON CONFLICT(endpoint,journey) DO UPDATE SET shop_domain=excluded.shop_domain,label=excluded.label,
      updated_ms=excluded.updated_ms,enabled=1`).bind(id,input.shop,input.label,safe,journey,nowMs,nowMs).run();
  return await env.DB.prepare("SELECT * FROM agentpulse_targets WHERE endpoint=? AND journey=?")
    .bind(safe,journey).first<PulseTarget>();
}

export async function ensureHttpTarget(env:Env,input:{shop:string;label:string;endpoint:string;journey:string},nowMs=Date.now()){
  const safe=cleanEndpoint(input.endpoint),id=journeyTargetId(input.shop,safe,input.journey);
  await env.DB.prepare(`INSERT INTO agentpulse_targets
    (id,shop_domain,label,protocol,transport,endpoint,auth_mode,journey,enabled,interval_ms,created_ms,updated_ms)
    VALUES(?,?,?,'http','https',?,'public',?,1,86400000,?,?)
    ON CONFLICT(endpoint,journey) DO UPDATE SET shop_domain=excluded.shop_domain,label=excluded.label,
      updated_ms=excluded.updated_ms,enabled=1`).bind(id,input.shop,input.label,safe,input.journey,nowMs,nowMs).run();
  return await env.DB.prepare("SELECT * FROM agentpulse_targets WHERE endpoint=? AND journey=?")
    .bind(safe,input.journey).first<PulseTarget>();
}

/** All hosted-layer journeys are safe reads. Handoff monitors validate a URL but never open it,
 * so a cron can never submit a form, create a cart or make a purchase. */
export async function ensureHostedJourneyTargets(env:Env,shop:string,base:string,slug:string,nowMs=Date.now()){
  const root=base.replace(/\/$/,"");
  const specs=[
    {journey:"discovery",label:"AI profile discovery",endpoint:`${root}/api/ai/${slug}/profile`},
    {journey:"price_availability",label:"Price and availability",endpoint:`${root}/api/ai/${slug}/catalog`},
    {journey:"policies",label:"Policy discovery",endpoint:`${root}/api/ai/${slug}/policies`},
    {journey:"quote_contact",label:"Quote or contact handoff",endpoint:`${root}/api/ai/${slug}/actions`},
    {journey:"booking_handoff",label:"Booking handoff",endpoint:`${root}/api/ai/${slug}/actions`},
    {journey:"checkout_handoff",label:"Checkout handoff without purchase",endpoint:`${root}/api/ai/${slug}/actions`}
  ];
  const mcp=await ensureHostedMcpTarget(env,shop,`${root}/api/ai/${slug}/mcp`,nowMs);
  const http=[] as PulseTarget[];
  for(const spec of specs){const target=await ensureHttpTarget(env,{shop,...spec},nowMs);if(target)http.push(target);}
  return [...(mcp?[mcp]:[]),...http];
}

export async function getTarget(env:Env,id:string){
  return await env.DB.prepare("SELECT * FROM agentpulse_targets WHERE id=?").bind(id).first<PulseTarget>();
}

export async function dueTargets(env:Env,nowMs=Date.now(),limit=3){
  const rows=await env.DB.prepare(`SELECT * FROM agentpulse_targets WHERE enabled=1
    AND (last_run_ms IS NULL OR last_run_ms+interval_ms<=?) ORDER BY COALESCE(last_run_ms,0),id LIMIT ?`)
    .bind(nowMs,limit).all<PulseTarget>();
  return rows.results;
}

function safeEvidence(run:PulseRun){
  // This allowlisted object is intentional. Never replace it with serialization of network
  // request/response objects: those may contain credentials or customer data.
  return JSON.stringify(run.evidence);
}

export async function savePulseRun(env:Env,run:PulseRun){
  const statements=[
    env.DB.prepare(`INSERT INTO agentpulse_runs
      (id,target_id,shop_domain,protocol,journey,status,era,protocol_version,started_ms,completed_ms,
       latency_ms,error_category,error_code,schema_fingerprint,tool_count,evidence_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(run.id,run.targetId,run.shop,run.protocol,run.journey,
        run.status,run.era,run.protocolVersion,run.startedMs,run.completedMs,run.latencyMs,run.errorCategory,
        run.errorCode,run.schemaFingerprint,run.toolCount,safeEvidence(run)),
    env.DB.prepare("UPDATE agentpulse_targets SET last_run_ms=?,updated_ms=? WHERE id=?")
      .bind(run.completedMs,run.completedMs,run.targetId),
    ...run.steps.map((s,i)=>env.DB.prepare(`INSERT INTO agentpulse_steps
      (run_id,sequence,step,status,latency_ms,detail) VALUES(?,?,?,?,?,?)`)
      .bind(run.id,i,s.step,s.status,s.latencyMs,s.detail.slice(0,500)))
  ];
  await env.DB.batch(statements);

  if(run.status==="pass"){
    await env.DB.prepare(`UPDATE agentpulse_incidents SET state='recovered',recovered_ms=?
      WHERE target_id=? AND state='open'`).bind(run.completedMs,run.targetId).run();
  }else if(run.status==="fail"||run.status==="blocked"){
    const category=run.errorCategory||run.status;
    const dedupe=`${run.targetId}:${category}:${run.errorCode||"none"}`;
    const id=`incident_${run.targetId}_${category}_${run.errorCode||"none"}`.replace(/[^a-z0-9_-]/gi,"_");
    await env.DB.prepare(`INSERT INTO agentpulse_incidents
      (id,target_id,dedupe_key,category,state,first_seen_ms,last_seen_ms,occurrences,latest_run_id)
      VALUES(?,?,?,?,'open',?,?,1,?)
      ON CONFLICT(dedupe_key) DO UPDATE SET state='open',last_seen_ms=excluded.last_seen_ms,
      recovered_ms=NULL,occurrences=agentpulse_incidents.occurrences+1,latest_run_id=excluded.latest_run_id`)
      .bind(id,run.targetId,dedupe,category,run.completedMs,run.completedMs,run.id).run();
  }
}

const percentile=(values:number[],p:number)=>values.length?values[Math.max(0,Math.ceil(values.length*p)-1)]:null;

export async function reliabilitySummary(env:Env,shop:string,limit=100){
  const rows=(await env.DB.prepare(`SELECT r.*,t.label FROM agentpulse_runs r
    JOIN agentpulse_targets t ON t.id=r.target_id WHERE r.shop_domain=?
    ORDER BY r.started_ms DESC LIMIT ?`).bind(shop,limit).all()).results as Array<Record<string,unknown>>;
  const latencies=rows.filter(r=>r.status==="pass").map(r=>Number(r.latency_ms)).sort((a,b)=>a-b);
  const measured=rows.filter(r=>r.status!=="unsupported");
  const success=measured.filter(r=>r.status==="pass").length;
  let consecutiveFailures=0;for(const r of rows){if(r.status==="pass")break;if(r.status!=="unsupported")consecutiveFailures++;}
  const byTarget=new Map<string,Array<Record<string,unknown>>>();
  for(const row of rows){const key=String(row.target_id);byTarget.set(key,[...(byTarget.get(key)||[]),row]);}
  const driftTargets=[...byTarget.entries()].filter(([,runs])=>{
    const fingerprints=runs.map(r=>String(r.schema_fingerprint||"")).filter(Boolean);return fingerprints.length>1&&fingerprints[0]!==fingerprints[1];
  }).map(([targetId])=>targetId);
  const journeys=[...new Set(rows.map(r=>String(r.journey)))].map(journey=>{
    const group=rows.filter(r=>String(r.journey)===journey),eligible=group.filter(r=>r.status!=="unsupported");
    return {journey,runs:group.length,status:String(group[0]?.status||"unknown"),
      successRate:eligible.length?eligible.filter(r=>r.status==="pass").length/eligible.length:null,
      lastRunMs:Number(group[0]?.completed_ms||0)||null};
  });
  const incidents=(await env.DB.prepare(`SELECT category,state,first_seen_ms,last_seen_ms,recovered_ms,occurrences
    FROM agentpulse_incidents WHERE target_id IN
    (SELECT id FROM agentpulse_targets WHERE shop_domain=?) ORDER BY last_seen_ms DESC LIMIT 20`)
    .bind(shop).all()).results;
  return {
    runs:rows.length,measuredRuns:measured.length,successes:success,successRate:measured.length?success/measured.length:null,
    p50Ms:percentile(latencies,.5),p95Ms:percentile(latencies,.95),
    lastSuccessMs:Number(rows.find(r=>r.status==="pass")?.completed_ms||0)||null,
    consecutiveFailures,
    schemaDrift:driftTargets.length>0,driftTargets,journeys,
    latest:rows[0]||null,incidents,
    note:"Percentiles and success rate use measured runs in the stored window. Unsupported capabilities are shown separately, not counted as merchant failures. These are observed results, not an SLA."
  };
}
