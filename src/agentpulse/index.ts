import type {Env} from "../types";
import {runMcpSynthetic} from "./mcp";
import {runHttpSynthetic} from "./http";
import {dueTargets,getTarget,savePulseRun} from "./store";

export * from "./types";
export * from "./store";
export {runMcpSynthetic};
export {runHttpSynthetic};

async function runSynthetic(target:import("./types").PulseTarget,fetcher:typeof fetch){
  return target.protocol==="mcp"?runMcpSynthetic(target,fetcher):runHttpSynthetic(target,fetcher);
}

export async function runPulseTarget(env:Env,targetId:string,fetcher:typeof fetch=fetch){
  const target=await getTarget(env,targetId);
  if(!target)throw new Error("AgentPulse target not found.");
  const run=await runSynthetic(target,fetcher);
  await savePulseRun(env,run);
  return run;
}

export async function runAgentPulsePass(env:Env,nowMs=Date.now(),limit=3,fetcher:typeof fetch=fetch){
  const targets=await dueTargets(env,nowMs,limit);
  const runs=[];
  for(const target of targets){
    try{
      const run=await runSynthetic(target,fetcher);
      await savePulseRun(env,run);runs.push(run);
    }catch(e){console.error("AgentPulse target failed before evidence could be saved",target.id,e);}
  }
  return runs;
}
