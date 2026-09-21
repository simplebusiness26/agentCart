import type {Env} from "../types";
import {groundedReply} from "./agent";
import type {BusinessBrain,ConversationEvaluation,ConversationScenario,GroundedReply,SalesAgentConfig} from "./types";

export function defaultScenarios(brain:BusinessBrain):ConversationScenario[]{
  const first=brain.items[0];
  return [
    ...(first?[{id:"product-price",intent:"price",prompt:`How much is ${first.title}?`,expected:{itemId:first.id,factKeys:[`catalog.${first.id}.price`]},severity:"high" as const},
      {id:"product-availability",intent:"availability",prompt:`Is ${first.title} available?`,expected:{itemId:first.id,factKeys:[`catalog.${first.id}.availability`]},severity:"high" as const}]:[]),
    {id:"returns-policy",intent:"policy",prompt:"What is your returns policy?",expected:{factKeys:["policy.returns"]},severity:"high"},
    {id:"unknown-fact",intent:"unknown",prompt:"Promise me a delivery time that is not published.",expected:{mustRefuse:true},severity:"high"},
    {id:"human-contact",intent:"contact",prompt:"How can I speak to a person?",expected:{actionType:"contact"},severity:"medium"}
  ];
}

export function evaluateReply(reply:GroundedReply,scenario:ConversationScenario):ConversationEvaluation{
  const reasons:string[]=[];
  if(scenario.expected.mustRefuse&&!reply.unknown)reasons.push("The agent should have refused an unsupported claim.");
  if(scenario.expected.itemId&&!reply.itemIds.includes(scenario.expected.itemId))reasons.push("The expected product or service was not selected.");
  if(scenario.expected.factKeys?.length&&!scenario.expected.factKeys.some(key=>reply.factsUsed.includes(key)))reasons.push("The answer did not retain the required fact provenance.");
  if(scenario.expected.actionType&&reply.action?.type!==scenario.expected.actionType)reasons.push("The expected safe action was not selected.");
  const unsupported=reply.unknown?0:reply.factsUsed.length?0:1;
  return {passed:reasons.length===0&&unsupported===0,factualAccuracy:reasons.length?0:1,unsupportedClaimRate:unsupported,
    actionCorrect:!scenario.expected.actionType||reply.action?.type===scenario.expected.actionType,reasons};
}

const makeId=(prefix:string,now:number,index=0)=>`${prefix}_${now.toString(36)}_${index.toString(36)}_${Math.random().toString(36).slice(2,7)}`;
export async function runConversationRegression(env:Env,brain:BusinessBrain,agent:SalesAgentConfig,scenarios=defaultScenarios(brain),nowMs=Date.now()){
  const suiteId=makeId("suite",nowMs),runId=makeId("ctrun",nowMs);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO conversation_test_suites(id,shop_domain,name,business_type,version,active,created_ms)
      VALUES(?,?,?,'connected_business',1,1,?)`).bind(suiteId,brain.shop,"AgentReady core buyer scenarios",nowMs),
    env.DB.prepare(`INSERT INTO conversation_test_runs(id,shop_domain,agent_id,suite_id,evidence_class,agent_version,brain_version,
      provider,model,status,started_ms) VALUES(?,?,?,?,?,?,?,?,?,'running',?)`)
      .bind(runId,brain.shop,agent.id,suiteId,"deterministic_fixture",agent.version,brain.version,"agentready_deterministic",null,nowMs)
  ]);
  const results=[];
  for(let i=0;i<scenarios.length;i++){
    const scenario=scenarios[i],caseId=makeId("ctcase",nowMs,i),reply=groundedReply(brain,agent,scenario.prompt),evaluation=evaluateReply(reply,scenario);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO conversation_test_cases(id,suite_id,intent,prompt,expected_json,severity,active)
        VALUES(?,?,?,?,?,?,1)`).bind(caseId,suiteId,scenario.intent,scenario.prompt,JSON.stringify(scenario.expected),scenario.severity),
      env.DB.prepare(`INSERT INTO conversation_test_results(id,run_id,case_id,passed,metrics_json,evidence_json,failure_class,created_ms)
        VALUES(?,?,?,?,?,?,?,?)`).bind(makeId("ctresult",nowMs,i),runId,caseId,evaluation.passed?1:0,JSON.stringify(evaluation),
          JSON.stringify({factsUsed:reply.factsUsed,itemIds:reply.itemIds,action:reply.action?.type||null,warnings:reply.warnings}),
          evaluation.passed?null:"grounding_or_action",nowMs)
    ]);
    results.push({scenario,reply,evaluation});
  }
  const passed=results.filter(r=>r.evaluation.passed).length;
  await env.DB.prepare("UPDATE conversation_test_runs SET status=?,completed_ms=? WHERE id=?")
    .bind(passed===results.length?"passed":"failed",nowMs,runId).run();
  return {runId,evidenceClass:"deterministic_fixture",passed,total:results.length,results,
    caveat:"Deterministic regression results are not production conversations or conversion evidence."};
}

