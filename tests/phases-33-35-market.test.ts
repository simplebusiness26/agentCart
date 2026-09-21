import {describe,expect,it} from "vitest";
import {aiShelfAnalytics,commerceSourceClass,shelfRecommendationShare,shelfSourceMix} from "../src/analytics/shelf";
import {benchmarkSummary} from "../src/readiness";

describe("Phase 33 AI Shelf analytics",()=>{
  it("classifies recommendation evidence by commercial source class",()=>{
    expect(commerceSourceClass({url:"https://brand.example/products/1",source_type:"owned",ownership:"owned"})).toBe("brand_owned");
    expect(commerceSourceClass({url:"https://www.amazon.com/item",source_type:"marketplace",ownership:"third_party"})).toBe("retailer");
    expect(commerceSourceClass({url:"https://reddit.com/r/shoes",source_type:"community",ownership:"third_party"})).toBe("ugc_social");
    expect(commerceSourceClass({url:"https://example-news.com/review",source_type:"editorial",ownership:"third_party"})).toBe("earned_media");
  });

  it("keeps source mix provider and surface specific",()=>{
    const rows=shelfSourceMix([
      {provider:"OpenAI",surface:"shopping",url:"https://retailer.example/a",source_type:"marketplace",citations:3},
      {provider:"OpenAI",surface:"shopping",url:"https://brand.example/a",source_type:"owned",ownership:"owned",citations:1},
      {provider:"Gemini",surface:"shopping",url:"https://brand.example/a",source_type:"owned",ownership:"owned",citations:4}
    ]);
    const openaiRetail=rows.find(r=>r.provider==="OpenAI"&&r.sourceClass==="retailer");
    const geminiOwned=rows.find(r=>r.provider==="Gemini"&&r.sourceClass==="brand_owned");
    expect(openaiRetail?.citationShare).toBe(.75);expect(geminiOwned?.citationShare).toBe(1);
  });

  it("calculates recommendation share without hiding sample size",()=>{
    const rows=shelfRecommendationShare([
      {provider:"OpenAI",surface:"shopping",category:"boots",subject:"Northstar",recommended:true},
      {provider:"OpenAI",surface:"shopping",category:"boots",subject:"Northstar",recommended:false},
      {provider:"OpenAI",surface:"shopping",category:"boots",subject:"Rival",recommended:true}
    ]);
    const northstar=rows.find(r=>r.subject==="Northstar")!;
    expect(northstar.recommendationRate).toBe(.5);
    expect(northstar.recommendationShare).toBe(.5);
    expect(northstar.observations).toBe(2);
    expect(northstar.stability).toBe("insufficient_sample");
  });

  it("does not turn published market source percentages into merchant ranking weights",()=>{
    const result=aiShelfAnalytics({sources:[],recommendations:[]});
    expect(result.caveat).toContain("not ranking weights");
  });
});

describe("Phases 34-35 are tracked, not falsely implemented",()=>{
  it("keeps Phase 32 complete and newer WebMCP/merchant work planned",()=>{
    expect(benchmarkSummary(32).milestoneReady).toBe(true);
    const current=benchmarkSummary(),planned=current.capabilities.filter(c=>c.state==="planned").map(c=>c.key);
    expect(current.milestoneReady).toBe(false);
    expect(planned).toEqual(expect.arrayContaining(["merchant_ai_performance","conversational_attributes","meta_agentic_channel","action_mapper","installer","runtime_monitoring","webmcp_reuse"]));
  });
});
