import {beforeEach,describe,expect,it,vi} from "vitest";
import type {Env} from "../src/types";
import type {PulseTarget} from "../src/agentpulse/types";
import {runHttpSynthetic} from "../src/agentpulse/http";
import {addQuery,aeoReport,recordManualObservation} from "../src/aeo";
import {extractSignals} from "../src/agentready";
import {algoliaAudit,runAuthorizedAlgoliaAudit,saveAlgoliaConnection} from "../src/algolia";
import {PLATFORM_REGISTRY,classifyWork} from "../src/platform/registry";
import {startJourney} from "../src/attribution";
import {completeExperiment,createExperiment,outcomeProofSummary,recordJourneyEvidence,recordOutcomeEvent} from "../src/outcomes/proof";
import {saveShop} from "../src/db";
import {fakeEnv} from "./helpers/env";

const SHOP="demo.myshopify.com";
let env:Env;let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,"encrypted");});

const target=(journey:string,endpoint="https://agentcart.example/read"):PulseTarget=>({
  id:`pulse_${journey}`,shop_domain:SHOP,label:journey,protocol:"http",transport:"https",endpoint,
  auth_mode:"public",journey,tool_name:null,tool_arguments_json:null,enabled:1,interval_ms:86400000,
  created_ms:1,updated_ms:1,last_run_ms:null
});

describe("Phase 14 safe HTTP journeys",()=>{
  it("checks live price and availability with a single read-only GET",async()=>{
    const fetcher=vi.fn(async(_input:any,init:any)=>{expect(init.method).toBe("GET");expect(init.redirect).toBe("error");
      return Response.json({items:[{price:{min:12,currency:"GBP"},available:true}]});});
    const run=await runHttpSynthetic(target("price_availability"),fetcher as any);
    expect(run.status).toBe("pass");expect(run.schemaFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports a missing optional capability as unsupported, not failed",async()=>{
    const run=await runHttpSynthetic(target("policies"),async()=>Response.json({policies:[]}));
    expect(run.status).toBe("unsupported");expect(run.errorCode).toBe("not_advertised");
  });

  it("validates checkout handoff without opening it or purchasing",async()=>{
    const fetcher=vi.fn(async()=>Response.json({actions:[{type:"view_product",supported:true,url:"https://shop.example/products/1"}]}));
    const run=await runHttpSynthetic(target("checkout_handoff"),fetcher as any);
    expect(run.status).toBe("pass");expect(fetcher).toHaveBeenCalledTimes(1);
    expect(run.steps.find(s=>s.step==="invoke")?.detail).toContain("no handoff was followed");
  });
});

describe("Phase 15 visibility evidence",()=>{
  it("keeps mention, recommendation, selection, completion and attribution separate",async()=>{
    const queryId=await addQuery(env,SHOP,"category_location","best cleaners in Hastings","cleaners",10);
    await recordManualObservation(env,{shop:SHOP,provider:"ChatGPT",model:"manual-ui",locale:"en-GB",queryId,
      subject:"Demo Cleaners",mentioned:true,recommended:true,selected:false,taskCompleted:false,attributed:false,
      evidence:"Observed in a controlled manual query."},20);
    const report=await aeoReport(env,SHOP);
    expect(report.status).toBe("measured");expect(report.provenance[0]).toMatchObject({method:"manual",locale:"en-GB"});
    expect(report.metrics[0]).toMatchObject({mentionRate:1,recommendationRate:1,selectionRate:0,taskCompletionRate:0,attributionRate:0});
  });

  it("rejects manual evidence for another store's query",async()=>{
    const queryId=await addQuery(env,SHOP,"category","best cleaners","cleaners");
    await expect(recordManualObservation(env,{shop:"other.myshopify.com",provider:"x",queryId,subject:"x",evidence:"x"}))
      .rejects.toThrow("does not belong");
  });
});

describe("Phase 16 platform and Algolia boundaries",()=>{
  it("detects capabilities and an exposed Admin-key configuration name without extracting a key",()=>{
    const signals=extractSignals(`<script src="https://cdn.jsdelivr.net/npm/algoliasearch"></script>
      <script>const ALGOLIA_ADMIN_API_KEY = window.runtime; aa('convertedObjectIDs')</script>`);
    expect(signals.algoliaDetected).toBe(true);expect(signals.algoliaAnalyticsSignals).toBe(true);
    expect(signals.algoliaAdminKeyRisk).toBe(true);
    expect(JSON.stringify(signals)).not.toContain("window.runtime");
  });

  it("stores public metadata but rejects credentials embedded in an MCP URL",async()=>{
    await expect(saveAlgoliaConnection(env,SHOP,{publicMcpUrl:"https://mcp.example/?api_key=secret"})).rejects.toThrow("credentials");
    const audit=await saveAlgoliaConnection(env,SHOP,{applicationId:"APP12345",indexNames:["products"],publicMcpUrl:"https://mcp.example/public"});
    expect(audit.detected).toBe(true);expect(audit.connection?.indexNames).toEqual(["products"]);
    expect(sqlite.prepare("select tool_arguments_json from agentpulse_targets where journey='algolia_public_mcp'").get().tool_arguments_json).toBe(null);
  });

  it("uses a restricted Search key ephemerally and stores capability evidence only",async()=>{
    const secret="search-only-secret-key";
    const fetcher=vi.fn(async(_url:any,init:any)=>{expect(init.headers["x-algolia-api-key"]).toBe(secret);
      return Response.json({nbHits:1,hits:[{name:"Boots",price:40,in_stock:true}],facets:{brand:{Demo:1}}});});
    const audit=await runAuthorizedAlgoliaAudit(env,SHOP,{applicationId:"APP12345",indexName:"products",
      searchKey:secret,query:"walking boots"},fetcher as any,100);
    expect(audit).toMatchObject({status:"pass",priceObserved:true,availabilityObserved:true,facetsObserved:true});
    const row=sqlite.prepare("select * from algolia_audit_runs").get();
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it("never claims automatic writes for an unimplemented platform adapter",()=>{
    expect(PLATFORM_REGISTRY.find(p=>p.platform==="shopify")?.automaticWrites).toBe(true);
    for(const p of PLATFORM_REGISTRY.filter(p=>p.platform!=="shopify"))expect(p.automaticWrites,p.platform).toBe(false);
    expect(classifyWork({legal:true,automatic:true})).toBe("legal");
  });

  it("does not penalise a store merely because Algolia is absent",async()=>{
    const audit=await algoliaAudit(env,SHOP);expect(audit.detected).toBe(false);
    expect(audit.note).toContain("not a failure");
  });
});

describe("Phase 17 outcome proof",()=>{
  it("links intent and handoff while preserving evidence tiers",async()=>{
    const journeyId=await startJourney(env,SHOP,"openai",{intent:"find a cleaner",handoffType:"contact",targetUrl:"https://demo.example/contact"},100);
    await recordJourneyEvidence(env,journeyId,101);
    await recordOutcomeEvent(env,{journeyId,shop:SHOP,eventType:"enquiry",evidenceTier:"reported",
      source:"merchant_confirmation",externalReference:"lead-123"},102);
    const proof=await outcomeProofSummary(env,SHOP,0,200);
    expect(proof.events.map((e:any)=>e.event_type)).toEqual(expect.arrayContaining(["intent","handoff","enquiry"]));
    expect(proof.note).toContain("not reported as causation");
  });

  it("hashes an external lead reference and stores no contact identity",async()=>{
    const journeyId=await startJourney(env,SHOP,"openai",{},100);
    await recordOutcomeEvent(env,{journeyId,shop:SHOP,eventType:"qualified_lead",evidenceTier:"reported",
      source:"merchant",externalReference:"buyer@example.com"},102);
    const row=sqlite.prepare("select * from outcome_events where event_type='qualified_lead'").get();
    expect(row.external_reference_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain("buyer@example.com");
  });

  it("records an optional controlled experiment without claiming a result early",async()=>{
    const id=await createExperiment(env,SHOP,{hypothesis:"Clearer policies improve enquiries",population:"UK visitors",
      windowStartMs:100,changeDescription:"Published clearer delivery policy",metric:"enquiries",baselineValue:2},100);
    let proof=await outcomeProofSummary(env,SHOP);expect((proof.experiments[0] as any).status).toBe("running");
    await completeExperiment(env,SHOP,id,{resultValue:4,resultNote:"Two more enquiries in the defined window."},200);
    proof=await outcomeProofSummary(env,SHOP);expect((proof.experiments[0] as any)).toMatchObject({status:"complete",result_value:4});
  });
});
