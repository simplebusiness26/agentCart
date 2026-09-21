import type {Env} from "../types";
import type {BusinessBrain} from "../salesagent";
import type {PageEvidence} from "../agentready/types";

export type OpportunitySource="search"|"ai_prompt"|"competitor"|"site_gap"|"customer_question"|"fanout";
export interface GrowthOpportunityInput {source:OpportunitySource;query:string;intent:"informational"|"commercial"|"transactional"|"local"|"support";funnelStage:"discover"|"compare"|"decide"|"buy"|"support";targetEntity?:string;targetPage?:string;currentCoverage:"good"|"weak"|"missing";businessRelevance:number;buyerIntent:number;evidenceStrength:number;opportunityConfidence:number;estimatedDifficulty?:number;measuredDemand?:number;evidence:Record<string,unknown>;}
const clamp=(v:number)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const makeId=(prefix:string,now=Date.now())=>`${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2,8)}`;

export function prioritizeOpportunity(o:GrowthOpportunityInput){
  return Number((clamp(o.businessRelevance)*.3+clamp(o.buyerIntent)*.3+clamp(o.evidenceStrength)*.2+clamp(o.opportunityConfidence)*.2).toFixed(3));
}

export function opportunitiesFromQuestions(questions:string[],source:OpportunitySource="customer_question"):GrowthOpportunityInput[]{
  return [...new Set(questions.map(q=>q.trim()).filter(Boolean))].slice(0,100).map(query=>{
    const lower=query.toLowerCase(),local=/\bnear(?: me|\s+[a-z])|\bin\s+[a-z]|\blocal\b/.test(lower),transactional=/buy|book|quote|price|cost|available|how much/.test(lower),compare=/best|versus| vs |compare|alternative/.test(lower);
    return {source,query,intent:local?"local":transactional?"transactional":compare?"commercial":"informational",
      funnelStage:transactional?"buy":compare?"compare":"discover",currentCoverage:"missing",businessRelevance:.8,buyerIntent:transactional?.95:compare?.8:.55,
      evidenceStrength:source==="fanout"?.75:.65,opportunityConfidence:.7,evidence:{source,label:source==="fanout"?"Observed/synthetic provenance is retained by the fanout record.":"First-party question"}};
  });
}

export async function saveGrowthOpportunity(env:Env,shop:string,input:GrowthOpportunityInput,nowMs=Date.now()){
  if(!input.query.trim())throw new Error("An opportunity needs a query or customer question.");
  const id=makeId("growth",nowMs);
  await env.DB.prepare(`INSERT INTO growth_opportunities(id,shop_domain,source,query,intent,funnel_stage,target_entity,target_page,
    current_coverage,business_relevance,buyer_intent,evidence_strength,opportunity_confidence,estimated_difficulty,measured_demand,
    evidence_json,status,created_ms,updated_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'proposed',?,?)
    ON CONFLICT(shop_domain,source,query) DO UPDATE SET intent=excluded.intent,funnel_stage=excluded.funnel_stage,
    target_entity=excluded.target_entity,target_page=excluded.target_page,current_coverage=excluded.current_coverage,
    business_relevance=excluded.business_relevance,buyer_intent=excluded.buyer_intent,evidence_strength=excluded.evidence_strength,
    opportunity_confidence=excluded.opportunity_confidence,estimated_difficulty=excluded.estimated_difficulty,
    measured_demand=excluded.measured_demand,evidence_json=excluded.evidence_json,updated_ms=excluded.updated_ms`)
    .bind(id,shop,input.source,input.query.trim().slice(0,500),input.intent,input.funnelStage,input.targetEntity||null,input.targetPage||null,
      input.currentCoverage,clamp(input.businessRelevance),clamp(input.buyerIntent),clamp(input.evidenceStrength),clamp(input.opportunityConfidence),
      input.estimatedDifficulty??null,input.measuredDemand??null,JSON.stringify(input.evidence),nowMs,nowMs).run();
  return id;
}

export async function listGrowthOpportunities(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT * FROM growth_opportunities WHERE shop_domain=? ORDER BY updated_ms DESC LIMIT 200").bind(shop).all();
  return rows.results;
}

export function auditPageIntelligence(page:PageEvidence){
  const s=page.signals,issues=[] as Array<{key:string;severity:"low"|"medium"|"high";detail:string}>;
  if(!s.title)issues.push({key:"missing_title",severity:"high",detail:"The page has no readable title."});
  if(!s.h1)issues.push({key:"missing_h1",severity:"medium",detail:"The page has no clear H1."});
  if(!s.metaDescription)issues.push({key:"missing_meta_description",severity:"medium",detail:"No meta description was found."});
  if(!s.canonical)issues.push({key:"missing_canonical",severity:"medium",detail:"No canonical URL declaration was found."});
  if(!s.hasJsonLd)issues.push({key:"missing_structured_data",severity:"medium",detail:"No JSON-LD structured data was found."});
  if(s.textLength<300)issues.push({key:"thin_content",severity:"high",detail:"The page has very little readable content."});
  if(!s.faqSchema&&page.pageType==="faq")issues.push({key:"faq_not_structured",severity:"low",detail:"FAQ content is not exposed as structured data."});
  if(!(s.addToCart||s.bookingSignals||s.quoteSignals||s.contactForm)&&["product","booking","contact"].includes(page.pageType))
    issues.push({key:"no_conversion_action",severity:"high",detail:"No useful customer action was detected."});
  return {url:page.url,pageType:page.pageType,issues,score:Math.max(0,100-issues.reduce((n,i)=>n+(i.severity==="high"?20:i.severity==="medium"?10:5),0)),
    deterministic:true,note:"This first layer uses observable page evidence and does not invent keyword volume, rankings or intent."};
}

export function createContentBrief(opportunity:GrowthOpportunityInput,brain:BusinessBrain,targetPage?:string){
  const facts=brain.facts.filter(f=>f.publicSafe&&f.confidence!=="unknown").slice(0,100);
  return {targetQuery:opportunity.query,intent:opportunity.intent,funnelStage:opportunity.funnelStage,
    pageDecision:targetPage?"improve_existing":"create_only_if_no_existing_page_matches",targetPage:targetPage||null,
    customerProblem:opportunity.query,entities:brain.items.slice(0,20).map(i=>({id:i.id,title:i.title,url:i.url})),
    approvedFacts:facts.map(f=>({key:f.key,value:f.value,source:f.source,verifiedMs:f.verifiedMs})),
    prohibitedClaims:["Any price, availability, guarantee, location, qualification or result not present in approvedFacts."],
    questions:[opportunity.query],conversionAction:opportunity.funnelStage==="buy"?"Use a verified product, quote, booking or contact handoff.":"Link to the next relevant verified business page.",
    verification:["Fact-check every claim against approvedFacts.","Preview and approve customer-visible copy.","Fetch the live page after publication.","Rerun SEO/GEO and readiness checks."],
    generatedMs:Date.now()};
}

export function groundedDraft(brief:ReturnType<typeof createContentBrief>,brain:BusinessBrain){
  const items=brain.items.slice(0,5),sections=[
    {heading:brief.targetQuery,body:`${brain.name} provides verified information to help customers with: ${brief.targetQuery}.`},
    ...(brain.description?[{heading:`About ${brain.name}`,body:brain.description}]:[]),
    ...items.map(i=>({heading:i.title,body:`${i.description}${i.priceMin!=null?` Price from ${i.currency||""} ${i.priceMin}.`:""} ${i.available?"Currently listed as available.":"Availability is not currently confirmed."}`.trim()}))
  ];
  const factMap:Record<string,string[]>=Object.fromEntries(sections.map((s,i)=>[`section.${i}`,
    i===0?["business.name"]:i===1&&brain.description?["business.description"]:items[i-(brain.description?2:1)]?[`catalog.${items[i-(brain.description?2:1)].id}.identity`,`catalog.${items[i-(brain.description?2:1)].id}.price`,`catalog.${items[i-(brain.description?2:1)].id}.availability`]:[]]));
  return {title:brief.targetQuery,sections,factMap,status:"draft_requires_merchant_approval",note:"Generated only from the canonical Business Brain. Publication is not automatic."};
}

export function learningState(input:{indexed?:boolean;impressions?:number;clicks?:number;aiMentions?:number;handoffs?:number;outcomes?:number;declining?:boolean}){
  if(input.indexed===false)return {state:"not_indexed",action:"Check indexability and submit through the authorised search channel."};
  if(!input.impressions)return {state:"indexed_no_impressions",action:"Recheck intent fit, internal links and evidence depth."};
  if(!input.clicks)return {state:"impressions_weak_clicks",action:"Improve title, description and answer alignment."};
  if(input.aiMentions&&!input.handoffs)return {state:"ai_visible_no_handoff",action:"Add a relevant verified customer action."};
  if(input.outcomes)return {state:"converting",action:"Preserve the winning version and test carefully."};
  if(input.declining)return {state:"stale_or_declining",action:"Review freshness, contradictions and competitor changes."};
  return {state:"traffic_no_observed_outcome",action:"Inspect engagement and the conversion handoff without claiming causation."};
}

export const CMS_ADAPTERS=[
  {id:"wordpress",read:true,preview:true,publish:"authorization_required",rollback:true},
  {id:"woocommerce",read:true,preview:true,publish:"authorization_required",rollback:true},
  {id:"shopify",read:true,preview:true,publish:"authorization_required",rollback:true},
  {id:"webflow",read:false,preview:true,publish:"not_connected",rollback:false},
  {id:"manual_export",read:false,preview:true,publish:"manual",rollback:false}
] as const;
