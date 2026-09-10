import type {Env} from "../types";
import type {AgentReadyReport} from "./types";

// Stable id for a domain so repeat scans accumulate against one business without
// needing a lookup round-trip first.
export function businessId(domain:string){return `biz_${domain.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;}
export function scanRunId(nowMs:number){
  const rand=new Uint8Array(8);crypto.getRandomValues(rand);
  return `run_${nowMs.toString(36)}_${Array.from(rand,b=>b.toString(16).padStart(2,"0")).join("")}`;
}

export async function upsertBusiness(env:Env,report:AgentReadyReport,nowMs=Date.now()){
  const id=businessId(report.domain);
  await env.DB.prepare(`INSERT INTO businesses(id,domain,canonical_url,platform,platform_confidence,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(domain) DO UPDATE SET canonical_url=excluded.canonical_url,platform=excluded.platform,
    platform_confidence=excluded.platform_confidence,updated_at=CURRENT_TIMESTAMP`)
    .bind(id,report.domain,report.url,report.platform.platform,report.platform.confidence).run();
  return id;
}

export async function saveScanRun(env:Env,report:AgentReadyReport,trigger:"user"|"monitor"="user",nowMs=Date.now()){
  const business=await upsertBusiness(env,report,nowMs);
  const id=scanRunId(nowMs);
  const startedMs=Date.parse(report.scannedAt)||nowMs;
  await env.DB.prepare(`INSERT INTO scan_runs(id,business_id,domain,score,grade,scoring_version,platform,trigger,status,
      category_scores_json,capabilities_json,started_ms,completed_ms)
    VALUES(?,?,?,?,?,?,?,?, 'complete',?,?,?,?)`)
    .bind(id,business,report.domain,report.score,report.grade,report.scoringVersion,report.platform.platform,trigger,
      JSON.stringify(report.categories),JSON.stringify(report.capabilities),startedMs,nowMs).run();

  // Pages and findings are written in one batch so a run is never half-persisted.
  const writes=[
    ...report.pages.map(p=>env.DB.prepare(`INSERT INTO scan_pages(scan_run_id,url,page_type,http_status,title,evidence_json)
      VALUES(?,?,?,?,?,?)`).bind(id,p.url,p.pageType,p.status,p.title.slice(0,300),JSON.stringify(p.signals))),
    ...report.checks.map(c=>env.DB.prepare(`INSERT INTO scan_findings(scan_run_id,key,category,status,points,max_points,
        plain_title,why_it_matters,technical_detail,evidence_json,recommended_fix,fix_type,estimated_score_gain)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,c.key,c.category,c.status,c.points,c.maxPoints,c.plainTitle,c.whyItMatters,c.technicalDetail,
        JSON.stringify({evidence:c.evidence}),c.recommendedFix,c.fixType,c.estimatedGain))
  ];
  if(writes.length)await env.DB.batch(writes);
  return id;
}

export async function recordFailedScan(env:Env,domain:string,message:string,nowMs=Date.now()){
  const id=scanRunId(nowMs);
  await env.DB.prepare(`INSERT INTO businesses(id,domain,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(domain) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`).bind(businessId(domain),domain).run();
  await env.DB.prepare(`INSERT INTO scan_runs(id,business_id,domain,scoring_version,status,error,started_ms,completed_ms)
    VALUES(?,?,?,'',?,?,?,?)`).bind(id,businessId(domain),domain,"failed",message.slice(0,500),nowMs,nowMs).run();
  return id;
}

export async function getScanHistory(env:Env,domain:string,limit=12){
  const rows=await env.DB.prepare(`SELECT id,score,grade,scoring_version,platform,trigger,status,started_ms,completed_ms
    FROM scan_runs WHERE domain=? AND status='complete' ORDER BY started_ms DESC LIMIT ?`).bind(domain,limit).all();
  return rows.results as Array<Record<string,unknown>>;
}

export async function getLatestScan(env:Env,domain:string){
  return env.DB.prepare(`SELECT * FROM scan_runs WHERE domain=? AND status='complete'
    ORDER BY started_ms DESC LIMIT 1`).bind(domain).first<Record<string,unknown>>();
}

// Two most recent complete runs, so the UI can show "54 -> 82 (+28)" honestly. Returns
// previous=null on a first scan rather than pretending the delta is zero.
export async function getScanComparison(env:Env,domain:string){
  const rows=await env.DB.prepare(`SELECT id,score,grade,scoring_version,started_ms FROM scan_runs
    WHERE domain=? AND status='complete' ORDER BY started_ms DESC LIMIT 2`).bind(domain).all();
  const [latest,previous]=rows.results as Array<any>;
  if(!latest)return null;
  // A score computed under a different scoring version is not comparable.
  const comparable=previous&&previous.scoring_version===latest.scoring_version;
  return {latest,previous:previous||null,comparable:!!comparable,
    delta:comparable?Number(latest.score)-Number(previous.score):null};
}

export async function getFindings(env:Env,scanRunId:string){
  const rows=await env.DB.prepare(`SELECT * FROM scan_findings WHERE scan_run_id=? ORDER BY estimated_score_gain DESC`)
    .bind(scanRunId).all();
  return rows.results as Array<Record<string,unknown>>;
}
