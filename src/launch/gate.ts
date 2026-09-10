import type {Env} from "../types";
import {LAUNCH_CHECKS} from "./checks";
import type {LaunchCheck,LaunchStatus} from "./checks";

export * from "./checks";

// Evidence recorder and MVP status. Phase 11.2's hard rule is enforced here in code, not in prose:
// a green test suite cannot make readyForLaunch true. Only recorded passes against a real
// environment can, and only when every check has one.

export interface LaunchResult {
  key:string;
  status:LaunchStatus;
  evidence?:string;
  failureReason?:string;
  remediation?:string;
}

// Anything that looks like a credential is removed before evidence is stored. The evidence record
// must never contain secrets, so redaction happens on the way in, not on the way out.
const SECRET_PATTERNS:RegExp[]=[
  /\bshp(?:at|ca|pa|ss)_[A-Za-z0-9]{8,}/g,
  /\bsk_(?:live|test)_[A-Za-z0-9]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{12,}/gi,
  /\b[A-Fa-f0-9]{40,}\b/g,
  /"?(?:secret|token|password|api[_-]?key|authorization)"?\s*[:=]\s*"?[^\s",}]{6,}/gi
];

export function redact(text:string){
  let out=String(text||"").slice(0,1000);
  for(const re of SECRET_PATTERNS)out=out.replace(re,"[redacted]");
  return out;
}

export async function recordLaunchResults(env:Env,runId:string,environment:string,appVersion:string,results:LaunchResult[],nowMs=Date.now()){
  if(!results.length)return;
  await env.DB.batch(results.map(r=>{
    const check=LAUNCH_CHECKS.find(c=>c.key===r.key);
    return env.DB.prepare(`INSERT INTO launch_checks(run_id,environment,check_key,title,status,evidence,
        failure_reason,remediation,app_version,checked_ms) VALUES(?,?,?,?,?,?,?,?,?,?)`)
      .bind(runId,environment,r.key,check?.title||r.key,r.status,
        r.evidence?redact(r.evidence):null,
        r.failureReason?redact(r.failureReason):null,
        r.remediation?redact(r.remediation):null,appVersion,nowMs);
  }));
}

export interface LaunchStatusReport {
  readyForLaunch:boolean;
  environment:string|null;
  total:number;
  passed:number;
  failed:number;
  notRun:number;
  blocked:number;
  checks:Array<LaunchCheck&{status:LaunchStatus;evidence?:string;failureReason?:string;checkedMs?:number}>;
  summary:string;
}

/** Latest recorded result per check, for one environment. */
export async function launchStatus(env:Env,environment="production"):Promise<LaunchStatusReport>{
  // Latest row per check. "inner" is a reserved word in SQLite, so both sides are aliased
  // explicitly; getting this wrong fails the query and silently reports nothing as passing.
  const rows=await env.DB.prepare(`SELECT lc.check_key, lc.status, lc.evidence, lc.failure_reason, lc.checked_ms
    FROM launch_checks lc
    WHERE lc.environment=? AND lc.id=(
      SELECT prev.id FROM launch_checks prev
      WHERE prev.check_key=lc.check_key AND prev.environment=lc.environment
      ORDER BY prev.checked_ms DESC, prev.id DESC LIMIT 1)`)
    .bind(environment).all();
  const latest=new Map((rows.results as Array<any>).map(r=>[String(r.check_key),r]));

  const checks=LAUNCH_CHECKS.map(c=>{
    const row=latest.get(c.key);
    return {...c,
      status:(row?String(row.status):"not_run") as LaunchStatus,
      evidence:row?.evidence?String(row.evidence):undefined,
      failureReason:row?.failure_reason?String(row.failure_reason):undefined,
      checkedMs:row?Number(row.checked_ms):undefined};
  });

  const passed=checks.filter(c=>c.status==="pass").length;
  const failed=checks.filter(c=>c.status==="fail").length;
  const blocked=checks.filter(c=>c.status==="blocked").length;
  const notRun=checks.filter(c=>c.status==="not_run").length;

  // The rule, in code: every check must have a recorded pass against real infrastructure.
  const readyForLaunch=passed===LAUNCH_CHECKS.length;

  const summary=readyForLaunch
    ? `All ${LAUNCH_CHECKS.length} launch checks passed against ${environment}.`
    : notRun===LAUNCH_CHECKS.length
    ? "The launch gate has never been run. AgentCart is not launch ready: a green test suite does not establish this."
    : `${passed} of ${LAUNCH_CHECKS.length} launch checks have passed. ${failed} failed, ${blocked} blocked, ${notRun} not yet run. AgentCart is not launch ready.`;

  return {readyForLaunch,environment,total:LAUNCH_CHECKS.length,passed,failed,notRun,blocked,checks,summary};
}

/** What the owner must provide before the gate can run at all. */
export function missingPrerequisites(env:Env){
  const missing:string[]=[];
  if(!env.SHOPIFY_API_KEY)missing.push("SHOPIFY_API_KEY");
  if(!env.SHOPIFY_API_SECRET)missing.push("SHOPIFY_API_SECRET");
  if(!env.TOKEN_ENCRYPTION_KEY)missing.push("TOKEN_ENCRYPTION_KEY");
  if(!env.APP_URL||/localhost|127\.0\.0\.1/.test(env.APP_URL))missing.push("APP_URL (a real public HTTPS URL)");
  return missing;
}
