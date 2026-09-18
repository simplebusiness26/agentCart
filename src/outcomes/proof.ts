import type {Env} from "../types";
import {getJourney,verifyJourneyId,type SourceTier} from "../attribution";

const EVENT_TYPES=["intent","discovery","tool_journey","handoff","enquiry","booking","qualified_lead","order"] as const;
type EventType=typeof EVENT_TYPES[number];

async function digest(value:string){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function eventId(){return typeof crypto.randomUUID==="function"?crypto.randomUUID():`oe_${Date.now()}_${Math.random()}`;}

export async function recordOutcomeEvent(env:Env,input:{journeyId:string;shop:string;eventType:EventType;
  evidenceTier:SourceTier;source:string;externalReference?:string;amount?:number|null;currency?:string|null;
  evidence?:Record<string,unknown>},nowMs=Date.now()){
  if(!EVENT_TYPES.includes(input.eventType))throw new Error("Unsupported outcome event.");
  const journey=await getJourney(env,input.journeyId);
  if(!journey||String(journey.shop_domain)!==input.shop)throw new Error("Unknown journey.");
  const provider=String(journey.provider||"");
  if(!await verifyJourneyId(env.SHOPIFY_API_SECRET,input.shop,provider,input.journeyId))throw new Error("Journey signature is invalid.");
  const hash=await digest(`${input.shop}|${input.externalReference||`${input.journeyId}|${input.eventType}|${input.source}`}`);
  const amount=input.amount==null?null:Number(input.amount);
  if(amount!=null&&!Number.isFinite(amount))throw new Error("Outcome amount is invalid.");
  await env.DB.prepare(`INSERT OR IGNORE INTO outcome_events(id,journey_id,shop_domain,event_type,evidence_tier,source,
    external_reference_hash,amount,currency,evidence_json,occurred_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(eventId(),input.journeyId,input.shop,input.eventType,input.evidenceTier,input.source.slice(0,120),hash,amount,
      input.currency?.slice(0,8)||null,JSON.stringify(input.evidence||{}).slice(0,2000),nowMs).run();
  await env.DB.prepare("UPDATE commerce_journeys SET last_seen_ms=? WHERE journey_id=?").bind(nowMs,input.journeyId).run();
}

export async function recordJourneyEvidence(env:Env,journeyId:string,nowMs=Date.now()){
  const journey=await getJourney(env,journeyId);if(!journey)return;
  const shop=String(journey.shop_domain),base={journeyId,shop,evidenceTier:"identifiable_referral" as const};
  await recordOutcomeEvent(env,{...base,eventType:"intent",source:"agentcart_journey",
    evidence:{intent:journey.intent||null}},nowMs);
  if(journey.discovery_run_id)await recordOutcomeEvent(env,{...base,eventType:"discovery",source:"agent_ready_scan",
    evidence:{scanRunId:journey.discovery_run_id}},nowMs);
  if(journey.pulse_run_id)await recordOutcomeEvent(env,{...base,eventType:"tool_journey",source:"agentpulse",
    evidence:{pulseRunId:journey.pulse_run_id}},nowMs);
  if(journey.target_url&&journey.handoff_type)await recordOutcomeEvent(env,{...base,eventType:"handoff",source:"agentcart_handoff",
    evidence:{type:journey.handoff_type}},nowMs);
}

export async function outcomeProofSummary(env:Env,shop:string,fromMs=0,toMs=Date.now()+1){
  const rows=(await env.DB.prepare(`SELECT event_type,evidence_tier,COUNT(*) AS count,COALESCE(SUM(amount),0) AS amount
    FROM outcome_events WHERE shop_domain=? AND occurred_ms>=? AND occurred_ms<? GROUP BY event_type,evidence_tier`)
    .bind(shop,fromMs,toMs).all<any>()).results;
  const experiments=(await env.DB.prepare(`SELECT id,hypothesis,population,window_start_ms,window_end_ms,change_description,
    metric,baseline_value,result_value,status,result_note FROM outcome_experiments WHERE shop_domain=? ORDER BY created_ms DESC LIMIT 20`)
    .bind(shop).all()).results;
  return {events:rows,experiments,note:"Intent, discovery, tool success, handoff, lead and order evidence remain separate. Association is not reported as causation without a controlled experiment."};
}

export async function createExperiment(env:Env,shop:string,input:{hypothesis:string;population:string;windowStartMs:number;
  windowEndMs?:number;changeDescription:string;metric:string;baselineValue?:number},nowMs=Date.now()){
  for(const value of [input.hypothesis,input.population,input.changeDescription,input.metric])if(!String(value||"").trim())
    throw new Error("Experiment hypothesis, population, change and metric are required.");
  const id=`exp_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  await env.DB.prepare(`INSERT INTO outcome_experiments(id,shop_domain,hypothesis,population,window_start_ms,window_end_ms,
    change_description,metric,baseline_value,status,created_ms) VALUES(?,?,?,?,?,?,?,?,?,'running',?)`)
    .bind(id,shop,input.hypothesis.slice(0,500),input.population.slice(0,300),Number(input.windowStartMs)||nowMs,
      input.windowEndMs??null,input.changeDescription.slice(0,500),input.metric.slice(0,160),input.baselineValue??null,nowMs).run();
  return id;
}

export async function completeExperiment(env:Env,shop:string,id:string,input:{resultValue:number;resultNote:string},nowMs=Date.now()){
  await env.DB.prepare(`UPDATE outcome_experiments SET result_value=?,result_note=?,status='complete',completed_ms=?
    WHERE id=? AND shop_domain=? AND status='running'`).bind(input.resultValue,input.resultNote.slice(0,500),nowMs,id,shop).run();
  return env.DB.prepare("SELECT * FROM outcome_experiments WHERE id=? AND shop_domain=?").bind(id,shop).first();
}
