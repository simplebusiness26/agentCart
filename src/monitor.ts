import {assessSite} from "./agentready";
import {businessId,getScanComparison,recordFailedScan,saveScanRun} from "./agentready/store";
import {syncConnectedStore} from "./platform";
import type {Env} from "./types";

// Scheduled rescans of connected businesses. Free-tier conscious: a small batch per
// firing, oldest first, so cost stays bounded no matter how many stores connect.
export const MONITOR_BATCH=5;
export const MONITOR_INTERVAL_MS=24*60*60*1000;

export interface MonitorOutcome {
  domain:string;
  shop:string;
  status:"improved"|"declined"|"unchanged"|"failed"|"skipped";
  score:number|null;
  previous:number|null;
  delta:number|null;
  detail:string;
}

// Stores whose last monitored scan is older than the interval, oldest first. A store
// that has never been monitored sorts first.
export async function dueForMonitoring(env:Env,nowMs:number,limit=MONITOR_BATCH){
  const rows=await env.DB.prepare(`
    SELECT b.domain AS domain, b.connected_shop_domain AS shop,
           COALESCE(MAX(r.started_ms),0) AS last_ms
    FROM businesses b
    LEFT JOIN scan_runs r ON r.domain=b.domain AND r.trigger='monitor'
    WHERE b.connected_shop_domain IS NOT NULL
    GROUP BY b.domain, b.connected_shop_domain
    HAVING last_ms < ?
    ORDER BY last_ms ASC
    LIMIT ?`).bind(nowMs-MONITOR_INTERVAL_MS,limit).all();
  return rows.results as Array<{domain:string;shop:string;last_ms:number}>;
}

// Links a connected store to the business record its website scan created, so monitoring
// knows which sites belong to a merchant rather than rescanning anonymous public scans.
export async function linkShopToBusiness(env:Env,shop:string,domain:string){
  // Upsert, not update: a merchant can connect Shopify without ever having run a website
  // scan, in which case no business row exists yet. An UPDATE would silently affect no
  // rows and the store would never be picked up for monitoring.
  await env.DB.prepare(`INSERT INTO businesses(id,domain,connected_shop_domain,updated_at)
    VALUES(?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(domain) DO UPDATE SET connected_shop_domain=excluded.connected_shop_domain,
    updated_at=CURRENT_TIMESTAMP`).bind(businessId(domain),domain,shop).run();
}

export async function monitorOne(env:Env,domain:string,shop:string,nowMs=Date.now()):Promise<MonitorOutcome>{
  // Refresh catalogue data first so the score reflects what the merchant actually has.
  try{await syncConnectedStore(env,shop,nowMs);}catch(e){console.error("monitor sync failed",shop,e);}
  let report;
  try{report=await assessSite(`https://${domain}`);}
  catch(e){
    const detail=e instanceof Error?e.message:"Scan failed";
    await recordFailedScan(env,domain,detail,nowMs).catch(()=>{});
    return {domain,shop,status:"failed",score:null,previous:null,delta:null,detail};
  }
  await saveScanRun(env,report,"monitor",nowMs);
  const comparison=await getScanComparison(env,domain);
  const previous=comparison?.comparable&&comparison.previous?Number(comparison.previous.score):null;
  const delta=previous===null?null:report.score-previous;
  const status=delta===null?"unchanged":delta>0?"improved":delta<0?"declined":"unchanged";
  const detail=delta===null
    ? `Agent Ready score ${report.score}.`
    : delta===0?`Score unchanged: ${report.score}.`
    : delta>0?`Score improved ${previous} to ${report.score}.`
    : `Score fell ${previous} to ${report.score}.`;
  return {domain,shop,status,score:report.score,previous,delta,detail};
}

export async function runMonitorPass(env:Env,nowMs=Date.now(),limit=MONITOR_BATCH){
  const due=await dueForMonitoring(env,nowMs,limit);
  const outcomes:MonitorOutcome[]=[];
  for(const row of due){
    try{outcomes.push(await monitorOne(env,row.domain,row.shop,nowMs));}
    catch(e){
      // One bad store must never stop the rest of the batch.
      outcomes.push({domain:row.domain,shop:row.shop,status:"failed",score:null,previous:null,delta:null,
        detail:e instanceof Error?e.message:"Monitoring failed"});
    }
  }
  return outcomes;
}

// Dashboard-facing history: what changed, most recent first.
export async function monitoringHistory(env:Env,shop:string,limit=12){
  const rows=await env.DB.prepare(`
    SELECT r.id,r.domain,r.score,r.grade,r.trigger,r.started_ms,r.scoring_version
    FROM scan_runs r JOIN businesses b ON b.domain=r.domain
    WHERE b.connected_shop_domain=? AND r.status='complete'
    ORDER BY r.started_ms DESC LIMIT ?`).bind(shop,limit).all();
  const runs=rows.results as Array<{id:string;domain:string;score:number;grade:string;trigger:string;
    started_ms:number;scoring_version:string}>;
  return runs.map((run,i)=>{
    const prior=runs[i+1];
    // Only compare like with like; a different scoring model is not a score change.
    const comparable=prior&&prior.scoring_version===run.scoring_version;
    return {...run,delta:comparable?Number(run.score)-Number(prior.score):null};
  });
}
