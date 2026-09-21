import {describe,expect,it} from "vitest";
import {channelCapabilities,compileChannelPackage,defaultScenarios,evaluateReply,groundedReply,type BusinessBrain,type SalesAgentConfig} from "../src/salesagent";
import {BENCHMARK_CAPABILITIES,benchmarkSummary,buildPathTo100} from "../src/readiness";
import {auditPageIntelligence,createContentBrief,groundedDraft,learningState,opportunitiesFromQuestions,prioritizeOpportunity} from "../src/growth";
import {aggregateVisibility,analyticsCsv,classifySource,evaluateShopping,injectedBrands,perceptionFromResponse,repeatedTerms,sourceGap,syntheticFanouts} from "../src/analytics";
import type {AgentReadyReport,PageEvidence} from "../src/agentready/types";

const brain:BusinessBrain={shop:"demo.myshopify.com",version:"1:1:10",name:"Northstar Outdoors",description:"Outdoor equipment for walking and camping.",website:"https://northstar.example",
  contact:{email:"hello@northstar.example",phone:null},location:{city:"Brighton",country:"GB"},policies:{returns:"Unworn products can be returned within 30 days.",shipping:"Delivery times depend on the destination."},
  items:[{id:"shoe-1",handle:"trail-runner",title:"Trail Runner GTX",description:"Waterproof trail shoes.",category:"Footwear",vendor:"Northstar",url:"https://northstar.example/products/trail-runner",priceMin:129,priceMax:129,currency:"GBP",available:true,syncedMs:100,source:"connected_catalog"}],
  facts:[{key:"business.name",type:"identity",value:"Northstar Outdoors",source:"business_profile",confidence:"verified",merchantApproved:false,publicSafe:true,verifiedMs:100},
    {key:"catalog.shoe-1.price",type:"catalog",value:{min:129,currency:"GBP"},source:"connected_catalog",confidence:"verified",merchantApproved:false,publicSafe:true,verifiedMs:100}],generatedMs:100};

const agent:SalesAgentConfig={id:"agent-1",shop:brain.shop,publicId:"northstar-ai",status:"active",displayName:"Northstar AI",purpose:"Help customers",tone:["clear","honest"],
  supportedIntents:["product_discovery","policy","contact"],allowedScopes:["catalog","policies"],allowedActions:["view_item","contact"],
  escalation:{message:"I do not have verified information for that."},unsupportedTopics:["medical advice"],locale:"en-GB",version:2,createdMs:1,updatedMs:2};

describe("Phases 18-21 Business Brain and Sales Agent",()=>{
  it("answers product questions from canonical facts and retains provenance",()=>{
    const reply=groundedReply(brain,agent,"Do you have waterproof trail shoes under £150?");
    expect(reply.unknown).toBe(false);expect(reply.text).toContain("£129");expect(reply.itemIds).toEqual(["shoe-1"]);
    expect(reply.factsUsed).toContain("catalog.shoe-1.price");expect(reply.action?.type).toBe("view_item");
  });
  it("refuses unsupported claims instead of inventing them",()=>{
    const reply=groundedReply(brain,agent,"Do you offer a lifetime guarantee?");
    expect(reply.unknown).toBe(true);expect(reply.escalation).toBe(true);expect(reply.factsUsed).toEqual([]);
  });
  it("returns a verified policy",()=>{
    const reply=groundedReply(brain,agent,"What is your returns policy?");
    expect(reply.text).toContain("30 days");expect(reply.factsUsed).toContain("policy.returns");
  });
  it("blocks configured unsupported topics",()=>{
    expect(groundedReply(brain,agent,"Give me medical advice").warnings).toContain("unsupported_topic");
  });
  it("builds and evaluates deterministic regression scenarios",()=>{
    const scenarios=defaultScenarios(brain),scenario=scenarios.find(s=>s.id==="product-price")!;
    expect(evaluateReply(groundedReply(brain,agent,scenario.prompt),scenario).passed).toBe(true);
    expect(scenarios.some(s=>s.expected.mustRefuse)).toBe(true);
  });
  it("keeps Demo Ready and Live as distinct channel states",()=>{
    const channels=channelCapabilities(),openai=channels.find(c=>c.id==="openai_sponsored_agent")!;
    expect(openai.canPublish).toBe(false);expect(openai.state).toBe("provider_not_available");
    expect(compileChannelPackage(brain,agent,"openai_sponsored_agent").note).toContain("not provider activation");
  });
});

describe("Scanner Superset and Path to 100",()=>{
  it("preserves the completed Phase 29 benchmark while exposing new market blockers",()=>{
    const phase29=benchmarkSummary(29),current=benchmarkSummary();
    expect(phase29.capabilities.filter(c=>c.state==="planned")).toEqual([]);
    expect(phase29.milestoneReady).toBe(true);expect(phase29.peecCapabilities).toBeGreaterThanOrEqual(28);
    expect(current.milestoneReady).toBe(false);
    expect(current.capabilities.filter(c=>c.state==="planned").map(c=>c.key)).toEqual(expect.arrayContaining([
      "prominence","industry_fit","brand_attribute_association","attribute_market_prominence","ga4_referral_dimensions"
    ]));
    expect(BENCHMARK_CAPABILITIES.some(c=>c.benchmark==="Cloudflare")).toBe(true);
  });
  it("turns every applicable non-pass into a remediation route",()=>{
    const report={score:72,checks:[{key:"catalog-price",category:"catalog",status:"fail",points:0,maxPoints:8,plainTitle:"Prices",whyItMatters:"Customers need prices",evidence:"none",technicalDetail:"",recommendedFix:"Publish prices",fixType:"automatic",estimatedGain:8},
      {key:"action-book",category:"actions",status:"partial",points:2,maxPoints:5,plainTitle:"Booking",whyItMatters:"Book",evidence:"partial",technicalDetail:"",recommendedFix:"Add booking",fixType:"manual",estimatedGain:3}],
      categories:[],capabilities:{canUnderstand:[],cannotUnderstand:[],canDo:[],cannotDo:[]},url:"https://example.com",domain:"example.com",grade:"Good",scoringVersion:"x",platform:{platform:"other",confidence:0,signals:[]},pages:[],pointsRecoverable:11,scannedAt:"now"} as AgentReadyReport;
    const path=buildPathTo100(report);expect(path.paths).toHaveLength(2);expect(path.potentialScore).toBe(83);expect(path.grouped.automatic).toBe(8);expect(path.grouped.guided).toBe(3);
  });
});

describe("Phases 22-24 Growth Engine",()=>{
  it("creates buyer-intent opportunities without inventing demand",()=>{
    const opportunity=opportunitiesFromQuestions(["How much are waterproof shoes near Brighton?"])[0];
    expect(opportunity.intent).toBe("local");expect(opportunity.measuredDemand).toBeUndefined();expect(prioritizeOpportunity(opportunity)).toBeGreaterThan(.5);
  });
  it("audits deterministic page evidence",()=>{
    const page={url:"https://example.com/item",pageType:"product",status:200,title:"",signals:{title:"",h1:"",metaDescription:"",canonical:false,hasJsonLd:false,textLength:20,faqSchema:false,addToCart:false,bookingSignals:false,quoteSignals:false,contactForm:false}} as unknown as PageEvidence;
    const audit=auditPageIntelligence(page);expect(audit.score).toBeLessThan(50);expect(audit.issues.map(i=>i.key)).toContain("no_conversion_action");
  });
  it("creates a fact-grounded brief and approval-only draft",()=>{
    const opportunity=opportunitiesFromQuestions(["best waterproof trail shoes"])[0],brief=createContentBrief(opportunity,brain);
    const draft=groundedDraft(brief,brain);expect(brief.approvedFacts.length).toBeGreaterThan(0);expect(draft.status).toBe("draft_requires_merchant_approval");expect(draft.factMap["section.2"]).toContain("catalog.shoe-1.price");
  });
  it("classifies learning states without claiming causation",()=>{
    expect(learningState({indexed:false}).state).toBe("not_indexed");expect(learningState({indexed:true,impressions:100,clicks:10,aiMentions:5,handoffs:0}).state).toBe("ai_visible_no_handoff");
    expect(learningState({indexed:true,impressions:100,clicks:10,outcomes:2}).state).toBe("converting");
  });
});

describe("Phases 25-29 Analytics Superset",()=>{
  it("aggregates visibility, position, sentiment and share of voice from atomic rows",()=>{
    const metrics=aggregateVisibility([{subject:"Northstar",mentioned:1,cited:1,recommended:1,selected:0,task_completed:0,attributed:0,position:1,sentiment:"positive",sentiment_score:.8},
      {subject:"Northstar",mentioned:0,cited:0,recommended:0,selected:0,task_completed:0,attributed:0,position:null,sentiment:"neutral",sentiment_score:0},
      {subject:"Rival",mentioned:1,cited:0,recommended:0,selected:0,task_completed:0,attributed:0,position:2,sentiment:"neutral",sentiment_score:0}]);
    expect(metrics.find(m=>m.subject==="Northstar")?.visibility).toBe(.5);expect(metrics.reduce((n,m)=>n+m.shareOfVoice,0)).toBeCloseTo(1);expect(metrics[0].stability).toBe("insufficient_sample");
  });
  it("labels generated fanouts synthetic and produces useful variants",()=>{
    const fanouts=syntheticFanouts("best waterproof walking shoes under £150",{category:"waterproof walking shoes",location:"UK",price:"under £150",competitors:["Rival"]});
    expect(fanouts.length).toBeGreaterThan(2);expect(fanouts.every(f=>f.source==="agentready_synthetic")).toBe(true);expect(fanouts.some(f=>f.query.includes("Rival"))).toBe(true);
  });
  it("finds repeated fanout terms and injected brands",()=>{
    expect(repeatedTerms(["shoe reviews 2026","walking shoe reviews"])).toEqual(expect.arrayContaining([{term:"shoe",count:2},{term:"reviews",count:2}]));
    expect(injectedBrands("best walking shoes",["Nike walking shoe reviews"],["Nike","Adidas"])).toEqual(["Nike"]);
  });
  it("classifies source types and builds honest source gaps",()=>{
    expect(classifySource("https://reddit.com/r/shoes").sourceType).toBe("community");
    expect(sourceGap([{domain:"example.org",ownership:"third_party",citations:4}])[0].warning).toContain("fake reviews");
  });
  it("detects price misinformation against the Business Brain",()=>{
    const perception=perceptionFromResponse("Trail Runner GTX costs £159 and is high quality.",brain.name,brain);
    expect(perception.misinformation[0].conflictsFactKey).toBe("catalog.shoe-1.price");
  });
  it("turns a shopping price mismatch into a retestable action",()=>{
    const result=evaluateShopping({itemId:"shoe-1",prompt:"best trail shoes",visible:true,position:1,quotedPrice:159,currency:"GBP"},brain);
    expect(result.priceMatch).toBe(false);expect(result.won).toBe(true);expect(result.action?.retest).toBe(true);
  });
  it("exports stable CSV columns and escapes values",()=>{
    const csv=analyticsCsv([{observed_ms:1,provider:"OpenAI",prompt:'best "shoe"'}]);
    expect(csv.split("\n")[0]).toContain("provider");expect(csv).toContain('"best ""shoe"""');
  });
});
