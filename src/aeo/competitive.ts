import type {Env} from "../types";
import {associationLanguage} from "./index";

export interface ObservableScore {domain:string;score:number;freshnessMs:number|null;completeness:number;
  structuredData:number;availability:number;policies:number;taskSuccess:number;toolReliability:number|null;evidence:string[]}

async function observed(env:Env,domain:string):Promise<ObservableScore|null>{
  const run=await env.DB.prepare(`SELECT id,score,completed_ms FROM scan_runs WHERE domain=? AND status='complete'
    ORDER BY started_ms DESC LIMIT 1`).bind(domain).first<any>();
  if(!run)return null;
  const findings=(await env.DB.prepare("SELECT key,category,status FROM scan_findings WHERE scan_run_id=?")
    .bind(run.id).all<any>()).results;
  const ratio=(filter:(f:any)=>boolean)=>{const rows=findings.filter(filter);return rows.length?rows.filter((f:any)=>f.status==="pass").length/rows.length:0;};
  const business=await env.DB.prepare("SELECT connected_shop_domain FROM businesses WHERE domain=?")
    .bind(domain).first<{connected_shop_domain:string|null}>();
  let toolReliability:number|null=null;
  if(business?.connected_shop_domain){
    const rows=(await env.DB.prepare("SELECT status FROM agentpulse_runs WHERE shop_domain=? ORDER BY started_ms DESC LIMIT 30")
      .bind(business.connected_shop_domain).all<any>()).results.filter(r=>r.status!=="unsupported");
    toolReliability=rows.length?rows.filter(r=>r.status==="pass").length/rows.length:null;
  }
  return {domain,score:Number(run.score),freshnessMs:run.completed_ms==null?null:Number(run.completed_ms),
    completeness:ratio(f=>["business","catalog"].includes(f.category)),structuredData:ratio(f=>/schema|structured|json/i.test(f.key)),
    availability:ratio(f=>/availability|stock|price/.test(f.key)),
    policies:ratio(f=>f.category==="policies"),taskSuccess:ratio(f=>f.category==="actions"),toolReliability,
    evidence:[`Latest public scan ${run.id}`,`${findings.length} observable readiness findings`]};
}

export async function observableComparison(env:Env,shop:string){
  const mine=await env.DB.prepare("SELECT domain FROM businesses WHERE connected_shop_domain=? LIMIT 1")
    .bind(shop).first<{domain:string}>();
  const competitors=(await env.DB.prepare("SELECT name,domain FROM aeo_competitors WHERE shop_domain=? AND domain IS NOT NULL")
    .bind(shop).all<{name:string;domain:string}>()).results;
  const me=mine?await observed(env,mine.domain):null;
  const others=[] as Array<{name:string;metrics:ObservableScore|null}>;
  for(const competitor of competitors)others.push({name:competitor.name,metrics:await observed(env,competitor.domain)});
  return {mine:me,competitors:others,note:"Only public, observable evidence from stored scans and synthetic runs is compared. Hidden model reasoning is never inferred."};
}

export async function whyLosingReport(env:Env,shop:string){
  const comparison=await observableComparison(env,shop),gaps=[] as Array<Record<string,unknown>>;
  if(!comparison.mine)return {status:"unknown",gaps,note:"Scan the connected website before comparing observable gaps."};
  const labels:{key:keyof ObservableScore;label:string;fix:string}[]=[
    {key:"completeness",label:"business and catalogue completeness",fix:"Complete the missing business or catalogue fields, then rescan."},
    {key:"structuredData",label:"structured business and product data",fix:"Publish validated structured data from merchant-owned facts, then rescan."},
    {key:"availability",label:"price and availability evidence",fix:"Publish current price and availability together on item pages or the hosted AI layer."},
    {key:"policies",label:"policy clarity",fix:"Publish clear policy pages and link them from the AI profile."},
    {key:"taskSuccess",label:"action handoffs",fix:"Expose a safe, working contact, booking or product handoff and verify it with AgentPulse."}
  ];
  for(const competitor of comparison.competitors){if(!competitor.metrics)continue;
    for(const item of labels){const mine=Number(comparison.mine[item.key]||0),theirs=Number(competitor.metrics[item.key]||0);
      if(theirs-mine>=.15)gaps.push({competitor:competitor.name,gap:item.label,mine,theirs,fix:item.fix,
        explanation:associationLanguage(item.label),evidence:competitor.metrics.evidence});}}
  return {status:gaps.length?"gaps_observed":"no_supported_gap",gaps,note:comparison.note};
}
