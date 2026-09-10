import type {Env} from "../types";
import {LAUNCH_CHECKS,type LaunchResult,recordLaunchResults,launchStatus,missingPrerequisites} from "./gate";
import {getCatalog,getBusinessProfile} from "../platform";
import {getShop,rateLimit} from "../db";
import {verifyJourney} from "../agentic/journey";

// Runs the checks that CAN be executed from inside the deployed Worker against real
// infrastructure. Manual checks are recorded as blocked with the reason, never as passes.
//
// This runs only where the environment is real. It cannot be satisfied locally, by design.

async function runId(){
  const b=new Uint8Array(6);crypto.getRandomValues(b);
  return `launch_${Date.now().toString(36)}_${Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")}`;
}

async function tryCheck(key:string,fn:()=>Promise<{evidence:string}>):Promise<LaunchResult>{
  try{
    const {evidence}=await fn();
    return {key,status:"pass",evidence};
  }catch(e){
    const check=LAUNCH_CHECKS.find(c=>c.key===key);
    return {key,status:"fail",
      failureReason:e instanceof Error?e.message:"Check failed.",
      remediation:check?.proves};
  }
}

export async function runLaunchGate(env:Env,opts:{shop?:string;environment?:string;appVersion?:string}={}){
  const environment=opts.environment||"production";
  const appVersion=opts.appVersion||"unknown";
  const id=await runId();
  const results:LaunchResult[]=[];

  const missing=missingPrerequisites(env);
  if(missing.length){
    // Cannot even begin. Everything is blocked, and nothing is recorded as passing.
    for(const c of LAUNCH_CHECKS)
      results.push({key:c.key,status:"blocked",
        failureReason:`Missing configuration: ${missing.join(", ")}.`,
        remediation:"Complete the owner setup steps in docs/USER_ACTIONS.md, then run the gate again."});
    await recordLaunchResults(env,id,environment,appVersion,results);
    return {runId:id,environment,results,status:await launchStatus(env,environment)};
  }

  // --- D1 checks, executable from the Worker against the real database -------------------
  results.push(await tryCheck("d1-migrations",async()=>{
    const row=await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table'").first<{c:number}>();
    const tables=Number(row?.c||0);
    if(tables<10)throw new Error(`Only ${tables} tables exist; migrations do not appear to have been applied.`);
    return {evidence:`${tables} tables present in the live database.`};
  }));

  results.push(await tryCheck("d1-returning",async()=>{
    const probe=await rateLimit(env,"launchgate",id,1000,60000);
    if(typeof probe.count!=="number"||probe.count<1)
      throw new Error("The RETURNING upsert did not return a usable count on hosted D1.");
    return {evidence:`ON CONFLICT ... RETURNING produced count=${probe.count}.`};
  }));

  results.push(await tryCheck("d1-batch",async()=>{
    const key=`launchgate_batch_${id}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO rate_buckets(bucket,count,expires_at) VALUES(?,1,?)").bind(key,Date.now()+60000),
      env.DB.prepare("UPDATE rate_buckets SET count=count+1 WHERE bucket=?").bind(key)
    ]);
    const row=await env.DB.prepare("SELECT count FROM rate_buckets WHERE bucket=?").bind(key).first<{count:number}>();
    await env.DB.prepare("DELETE FROM rate_buckets WHERE bucket=?").bind(key).run().catch(()=>{});
    if(Number(row?.count)!==2)throw new Error(`Batched writes produced count=${row?.count}, expected 2.`);
    return {evidence:"Batched insert plus update applied in order on hosted D1."};
  }));

  const shop=opts.shop;
  const connected=shop?await getShop(env,shop):null;

  const needsStore=(key:string)=>{
    results.push({key,status:"blocked",
      failureReason:"No connected development store was supplied to the gate.",
      remediation:"Install AgentCart on a Shopify development store, then run the gate with that store's domain."});
  };

  // --- Checks needing a connected store -------------------------------------------------
  if(!connected){
    for(const key of ["pixel-origin","pixel-timestamps","catalog-sync","fix-lifecycle","rescan-delta",
                      "ai-layer-live","discovery-live","journey-live"])needsStore(key);
  }else{
    results.push(await tryCheck("pixel-timestamps",async()=>{
      const row=await env.DB.prepare(
        "SELECT COUNT(*) AS total, SUM(CASE WHEN occurred_ms IS NULL THEN 1 ELSE 0 END) AS bad FROM events WHERE shop_domain=?")
        .bind(shop).first<{total:number;bad:number}>();
      const total=Number(row?.total||0);
      if(!total)throw new Error("No pixel events have been received yet, so timestamp parsing is unproven.");
      if(Number(row?.bad||0)>0)throw new Error(`${row?.bad} of ${total} events have an unparseable timestamp.`);
      return {evidence:`${total} events received, all with a parseable timestamp.`};
    }));

    results.push(await tryCheck("pixel-origin",async()=>{
      const rows=await env.DB.prepare(
        `SELECT DISTINCT json_extract(payload_json,'$.origin') AS origin FROM events
         WHERE shop_domain=? AND json_extract(payload_json,'$.origin') IS NOT NULL LIMIT 5`).bind(shop).all();
      const origins=(rows.results as Array<any>).map(r=>String(r.origin)).filter(Boolean);
      if(!origins.length)throw new Error("No Origin header has been observed on any pixel event yet.");
      return {evidence:`Observed pixel Origin value(s): ${origins.join(", ")}. Base any enforcement rule on these.`};
    }));

    results.push(await tryCheck("catalog-sync",async()=>{
      const items=await getCatalog(env,shop!,5,0);
      if(!items.length)throw new Error("No catalogue items have been synced from the real Admin API.");
      const priced=items.filter(i=>i.price_min!=null).length;
      return {evidence:`${items.length} item(s) synced from the live Admin API, ${priced} with a price.`};
    }));

    results.push(await tryCheck("ai-layer-live",async()=>{
      const profile=await getBusinessProfile(env,shop!);
      if(!profile?.name)throw new Error("No business profile is available to serve through the AI layer.");
      return {evidence:`Public AI layer has real profile data for "${String(profile.name)}".`};
    }));

    results.push(await tryCheck("journey-live",async()=>{
      const profile=await getBusinessProfile(env,shop!);
      const site=String(profile?.primary_url||"");
      if(!site)throw new Error("No storefront URL is known for this store.");
      const journey=await verifyJourney(site,"buy_product");
      return {evidence:`Live journey reached "${journey.reached}". ${journey.stoppedBecause}`};
    }));

    results.push(await tryCheck("discovery-live",async()=>{
      const profile=await getBusinessProfile(env,shop!);
      const site=String(profile?.primary_url||"");
      if(!site)throw new Error("No storefront URL is known for this store.");
      const found:string[]=[];
      for(const p of ["/agents.md","/llms.txt","/llms-full.txt","/.well-known/ucp"]){
        try{const res=await fetch(new URL(p,site).toString());if(res.ok)found.push(p);}catch{/* absent */}
      }
      return {evidence:`Discovery files present on the live storefront: ${found.join(", ")||"none"}.`};
    }));

    for(const key of ["fix-lifecycle","rescan-delta"])
      results.push({key,status:"blocked",
        failureReason:"This check changes merchant data, so it is run deliberately rather than automatically.",
        remediation:"Apply one real fix from the Fixes tab on the development store, then rescan and confirm the score moved."});
  }

  // --- Manual checks: recorded as blocked with instructions, never as passes -------------
  for(const c of LAUNCH_CHECKS.filter(c=>c.mode==="manual")){
    if(results.some(r=>r.key===c.key))continue;
    results.push({key:c.key,status:"blocked",
      failureReason:"This check requires a person to perform it against real infrastructure.",
      remediation:c.proves});
  }

  await recordLaunchResults(env,id,environment,appVersion,results);
  return {runId:id,environment,results,status:await launchStatus(env,environment)};
}
