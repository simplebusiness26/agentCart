import type {Env} from "../types";
import type {BusinessBrain} from "../salesagent";
import {opportunitiesFromQuestions,saveGrowthOpportunity} from "../growth";
import {refreshIndustryBenchmarks} from "./market";
import {aiShelfAnalytics} from "./shelf";

export type FanoutSource="observed_provider"|"manual_observed"|"agentready_synthetic";
export type FanoutType="search"|"shopping"|"other";
export interface FanoutInput {query:string;source:FanoutSource;type:FanoutType;topic?:string;evidenceRef?:string;occurrenceCount?:number;}
export interface SourceInput {url:string;accessed?:boolean;sourceType?:SourceType;ownership?:"owned"|"competitor"|"third_party";}
export type SourceType="owned"|"editorial"|"corporate"|"community"|"social"|"reference"|"marketplace"|"other";
export interface CitationInput {url:string;evidenceSpan?:string;position?:number;}
export interface EvidenceSpanInput {subject?:string;sourceUrl?:string;spanType:"brand"|"source"|"attribute"|"citation";startOffset:number;endOffset:number;evidenceExcerpt?:string;}
export interface BrandAttributeInput {brand:string;attribute:string;polarity?:"positive"|"neutral"|"negative";evidenceSpan:string;}
export interface ChatFeatures {webSearch?:boolean;shopping?:boolean;productComparison?:boolean;mapsLocal?:boolean;ads?:boolean;citations?:boolean;}
export interface PromptRunInput {
  queryId?:string;prompt:string;provider:string;model?:string;country?:string;locale?:string;surface?:string;accountState?:string;category?:string;
  method:"provider_api"|"provider_export"|"manual"|"authorised_automation";
  responseText?:string;subject:string;mentioned:boolean;cited:boolean;recommended:boolean;selected?:boolean;taskCompleted?:boolean;attributed?:boolean;
  position?:number|null;sentiment?:"positive"|"neutral"|"negative";sentimentScore?:number;sentimentEvidence?:string;
  entities?:string[];sources?:SourceInput[];citations?:CitationInput[];fanouts?:FanoutInput[];chatFeatures?:ChatFeatures;
  ownedDomain?:string;competitorDomains?:string[];
  evidenceSpans?:EvidenceSpanInput[];brandAttributes?:BrandAttributeInput[];
}

const makeId=(prefix:string,now=Date.now(),n=0)=>`${prefix}_${now.toString(36)}_${n.toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const clean=(v:string,max=1000)=>v.trim().slice(0,max);
const clamp=(n:number,min=-1,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
function domainOf(url:string){try{return new URL(url).hostname.toLowerCase();}catch{return "";}}
async function sha256(value:string){const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");}

export function classifySource(url:string,ownedDomain?:string,competitorDomains:string[]=[]):{domain:string;sourceType:SourceType;ownership:"owned"|"competitor"|"third_party"}{
  const domain=domainOf(url),owned=ownedDomain&&domain===ownedDomain.toLowerCase(),competitor=competitorDomains.some(d=>domain===d.toLowerCase());
  const sourceType:SourceType=owned?"owned":/(reddit|quora|forum|community)/.test(domain)?"community":/(wikipedia|gov\.uk|\.gov\.|directory)/.test(domain)?"reference":/(amazon|etsy|ebay|marketplace)/.test(domain)?"marketplace":"other";
  return {domain,sourceType,ownership:owned?"owned":competitor?"competitor":"third_party"};
}

export async function recordPromptRun(env:Env,shop:string,input:PromptRunInput,nowMs=Date.now()){
  if(!input.prompt.trim()||!input.provider.trim()||!input.subject.trim())throw new Error("Prompt, provider and subject are required.");
  if(input.position!=null&&(!Number.isInteger(input.position)||input.position<1||input.position>100))throw new Error("Position must be a whole number from 1 to 100.");
  const runId=makeId("vpr",nowMs),responseHash=input.responseText?await sha256(input.responseText):null;
  await env.DB.prepare(`INSERT INTO visibility_prompt_runs(id,shop_domain,query_id,prompt,provider,model,country,locale,surface,
    account_state,method,response_hash,response_excerpt,subject,mentioned,cited,recommended,selected,task_completed,attributed,
    position,sentiment,sentiment_score,sentiment_evidence,entities_json,category,observed_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(runId,shop,input.queryId||null,clean(input.prompt,2000),clean(input.provider,80),
      input.model?clean(input.model,120):null,input.country?clean(input.country,8):null,input.locale?clean(input.locale,30):null,input.surface?clean(input.surface,80):null,
      input.accountState?clean(input.accountState,80):null,input.method,responseHash,input.responseText?clean(input.responseText,500):null,clean(input.subject,160),
      input.mentioned?1:0,input.cited?1:0,input.recommended?1:0,input.selected?1:0,input.taskCompleted?1:0,input.attributed?1:0,
      input.position??null,input.sentiment||null,input.sentimentScore==null?null:clamp(input.sentimentScore),input.sentimentEvidence?clean(input.sentimentEvidence,500):null,
      JSON.stringify((input.entities||[]).map(v=>clean(v,160)).slice(0,100)),input.category?clean(input.category,160):null,nowMs).run();

  const statements=[] as D1PreparedStatement[];let n=0;
  for(const source of input.sources||[]){const classified=classifySource(source.url,input.ownedDomain,input.competitorDomains||[]);if(!classified.domain)continue;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO visibility_sources(id,run_id,url,domain,source_type,ownership,accessed,observed_ms)
      VALUES(?,?,?,?,?,?,?,?)`).bind(makeId("vsrc",nowMs,n++),runId,clean(source.url,1500),classified.domain,source.sourceType||classified.sourceType,source.ownership||classified.ownership,source.accessed?1:0,nowMs));}
  n=0;for(const citation of input.citations||[]){const domain=domainOf(citation.url);if(!domain)continue;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO visibility_citations(id,run_id,url,domain,evidence_span,position,observed_ms)
      VALUES(?,?,?,?,?,?,?)`).bind(makeId("vcit",nowMs,n++),runId,clean(citation.url,1500),domain,citation.evidenceSpan?clean(citation.evidenceSpan,500):null,citation.position??null,nowMs));}
  n=0;for(const fanout of input.fanouts||[]){if(!fanout.query.trim())continue;
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO visibility_fanouts(id,run_id,query_id,provider,model,source,type,query,topic,
      locale,country,occurrence_count,evidence_ref,observed_ms) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(makeId("vfan",nowMs,n++),runId,input.queryId||null,input.provider,input.model||null,fanout.source,fanout.type,clean(fanout.query,500),
        fanout.topic?clean(fanout.topic,160):null,input.locale||null,input.country||null,Math.max(1,Math.floor(fanout.occurrenceCount||1)),fanout.evidenceRef?clean(fanout.evidenceRef,1000):null,nowMs));}
  if(input.chatFeatures)statements.push(env.DB.prepare(`INSERT INTO visibility_chat_features(run_id,web_search,shopping,product_comparison,maps_local,ads,citations,evidence_json)
    VALUES(?,?,?,?,?,?,?,?)`).bind(runId,input.chatFeatures.webSearch==null?null:input.chatFeatures.webSearch?1:0,input.chatFeatures.shopping==null?null:input.chatFeatures.shopping?1:0,
      input.chatFeatures.productComparison==null?null:input.chatFeatures.productComparison?1:0,input.chatFeatures.mapsLocal==null?null:input.chatFeatures.mapsLocal?1:0,
      input.chatFeatures.ads==null?null:input.chatFeatures.ads?1:0,input.chatFeatures.citations==null?null:input.chatFeatures.citations?1:0,JSON.stringify({method:input.method})));
  const answerLength=input.responseText?.length||0;
  n=0;for(const span of input.evidenceSpans||[]){const start=Math.floor(Number(span.startOffset)),end=Math.floor(Number(span.endOffset));
    if(!answerLength||start<0||end<=start||end>answerLength)continue;
    statements.push(env.DB.prepare(`INSERT INTO visibility_evidence_spans(id,run_id,subject,source_url,span_type,start_offset,end_offset,answer_length,evidence_excerpt,observed_ms)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(makeId("vspan",nowMs,n++),runId,clean(span.subject||input.subject,160),span.sourceUrl?clean(span.sourceUrl,1500):null,
        span.spanType,start,end,answerLength,span.evidenceExcerpt?clean(span.evidenceExcerpt,500):input.responseText?.slice(start,end)||null,nowMs));}
  n=0;for(const attribute of input.brandAttributes||[]){if(!attribute.brand?.trim()||!attribute.attribute?.trim()||!attribute.evidenceSpan?.trim())continue;
    statements.push(env.DB.prepare(`INSERT INTO brand_attribute_observations(id,shop_domain,run_id,brand,attribute,polarity,evidence_span,observed_ms)
      VALUES(?,?,?,?,?,?,?,?)`).bind(makeId("battr",nowMs,n++),shop,runId,clean(attribute.brand,160),clean(attribute.attribute,160),attribute.polarity||"neutral",clean(attribute.evidenceSpan,500),nowMs));}
  for(let i=0;i<statements.length;i+=50)await env.DB.batch(statements.slice(i,i+50));
  if(input.category)await refreshIndustryBenchmarks(env,nowMs);
  return runId;
}

export * from "./market";
export * from "./shelf";

export interface VisibilityRow {subject:string;mentioned:number;cited:number;recommended:number;selected:number;task_completed:number;attributed:number;position:number|null;sentiment:string|null;sentiment_score:number|null;provider?:string;model?:string;country?:string;surface?:string;category?:string;observed_ms?:number;}
export function aggregateVisibility(rows:VisibilityRow[]){
  const groups=new Map<string,VisibilityRow[]>();for(const row of rows){const list=groups.get(row.subject)||[];list.push(row);groups.set(row.subject,list);}
  const metrics=[...groups].map(([subject,list])=>{const count=list.length,sum=(key:keyof VisibilityRow)=>list.reduce((n,r)=>n+Number(r[key]||0),0),positions=list.map(r=>r.position).filter((v):v is number=>v!=null);
    const sentiments=list.map(r=>r.sentiment_score).filter((v):v is number=>v!=null);
    return {subject,sampleSize:count,visibility:sum("mentioned")/count,citationRate:sum("cited")/count,recommendationRate:sum("recommended")/count,
      selectionRate:sum("selected")/count,taskCompletionRate:sum("task_completed")/count,attributionRate:sum("attributed")/count,
      averagePosition:positions.length?positions.reduce((a,b)=>a+b,0)/positions.length:null,sentiment:sentiments.length?sentiments.reduce((a,b)=>a+b,0)/sentiments.length:null};});
  const totalMentions=metrics.reduce((n,m)=>n+m.visibility*m.sampleSize,0);
  return metrics.map(m=>({...m,shareOfVoice:totalMentions?m.visibility*m.sampleSize/totalMentions:0,
    stability:m.sampleSize<3?"insufficient_sample":m.sampleSize<10?"early_signal":"measured"}));
}

const STOP=new Set(["what","which","that","with","from","under","over","best","near","this","your","have","does","into","about","should","could","would","there","their"]);
export function repeatedTerms(queries:string[],limit=20){
  const counts=new Map<string,number>();for(const query of queries)for(const term of new Set(query.toLowerCase().replace(/[^a-z0-9£$€]+/g," ").split(/\s+/).filter(t=>t.length>2&&!STOP.has(t))))counts.set(term,(counts.get(term)||0)+1);
  return [...counts].map(([term,count])=>({term,count})).sort((a,b)=>b.count-a.count||a.term.localeCompare(b.term)).slice(0,limit);
}

export function syntheticFanouts(prompt:string,context:{category?:string;location?:string;price?:string;attributes?:string[];competitors?:string[];year?:number}={}):FanoutInput[]{
  const p=clean(prompt,500),year=context.year||new Date().getUTCFullYear(),base=context.category||p,loc=context.location?` ${context.location}`:"",price=context.price?` ${context.price}`:"";
  const raw=[`${base}${loc} reviews`,`${base}${price} comparison`,`${base}${loc} best ${year}`,
    ...(context.attributes||[]).slice(0,4).map(a=>`${base} ${a}`),...(context.competitors||[]).slice(0,4).map(c=>`${base} vs ${c}`)];
  return [...new Set(raw.map(v=>v.replace(/\s+/g," ").trim()).filter(v=>v&&v.toLowerCase()!==p.toLowerCase()))].map(query=>({query,source:"agentready_synthetic",type:/product|shoe|price|buy|shop/i.test(prompt)?"shopping":"search",topic:context.category||"planning"}));
}

export function injectedBrands(parentPrompt:string,fanouts:string[],knownBrands:string[]){
  const parent=parentPrompt.toLowerCase();return knownBrands.filter(brand=>!parent.includes(brand.toLowerCase())&&fanouts.some(q=>q.toLowerCase().includes(brand.toLowerCase())));
}

export function sourceGap(sources:Array<{domain:string;ownership:string;citations:number}>) {
  return sources.filter(s=>s.ownership!=="owned"&&s.citations>0).sort((a,b)=>b.citations-a.citations).map(s=>({domain:s.domain,citations:s.citations,
    action:s.ownership==="competitor"?"Improve owned evidence and identify legitimate third-party coverage gaps.":"Review whether accurate editorial, directory or community representation is missing.",
    warning:"Do not automate spam, fake reviews or undisclosed promotion."}));
}

export interface CrawlObservationInput {sourceAdapter:"cloudflare"|"vercel"|"signed_webhook"|"wordpress"|"clf_csv";bot:string;provider?:string;purpose?:string;path:string;status?:number;latencyMs?:number;bytes?:number;errorCode?:string;evidenceTier:"verified_first_party"|"authorised_import"|"reported";observedMs:number;}
export async function recordCrawlObservation(env:Env,shop:string,input:CrawlObservationInput,nowMs=Date.now()){
  if(!input.bot.trim()||!input.path.trim())throw new Error("Crawler observations need a bot and path.");
  const id=makeId("crawlobs",nowMs);await env.DB.prepare(`INSERT INTO crawler_observations(id,shop_domain,source_adapter,bot,provider,purpose,path,status,latency_ms,bytes,error_code,evidence_tier,observed_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,shop,input.sourceAdapter,clean(input.bot,300),input.provider?clean(input.provider,80):null,input.purpose?clean(input.purpose,80):null,
      clean(input.path,1500),input.status??null,input.latencyMs??null,input.bytes??null,input.errorCode?clean(input.errorCode,100):null,input.evidenceTier,input.observedMs).run();return id;
}

export function perceptionFromResponse(response:string,subject:string,brain:BusinessBrain){
  const lower=response.toLowerCase(),themes=[] as Array<{theme:string;polarity:"positive"|"neutral"|"negative";evidence:string;conflictsFactKey?:string}>;
  for(const [theme,words,polarity] of [["value",["good value","affordable","expensive"],"neutral"],["quality",["high quality","reliable","poor quality"],"neutral"],["availability",["in stock","out of stock","unavailable"],"neutral"]] as const){
    const word=words.find(w=>lower.includes(w));if(word)themes.push({theme,polarity,evidence:word});
  }
  for(const item of brain.items){const prices=[...response.matchAll(/[£$€]\s?(\d+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1]));if(!lower.includes(item.title.toLowerCase())||!prices.length||item.priceMin==null)continue;
    const mismatched=prices.find(p=>Math.abs(p-item.priceMin!)>.005);if(mismatched!=null)themes.push({theme:"misinformation",polarity:"negative",evidence:`Response quoted ${mismatched}; canonical price is ${item.priceMin}.`,conflictsFactKey:`catalog.${item.id}.price`});
  }
  return {subject,themes,misinformation:themes.filter(t=>t.conflictsFactKey),evaluated:true,note:"Themes are evaluated observations; Business Brain conflicts are deterministic checks."};
}

export async function recordPerception(env:Env,shop:string,runId:string|null,observation:ReturnType<typeof perceptionFromResponse>,nowMs=Date.now()){
  if(!observation.themes.length)return 0;
  await env.DB.batch(observation.themes.map((theme,index)=>env.DB.prepare(`INSERT INTO perception_observations(
    id,shop_domain,run_id,subject,theme,polarity,evidence_span,evaluated,conflicts_fact_key,observed_ms)
    VALUES(?,?,?,?,?,?,?,1,?,?)`).bind(makeId("perception",nowMs,index),shop,runId,observation.subject,theme.theme,theme.polarity,
      clean(theme.evidence,500),theme.conflictsFactKey||null,nowMs)));
  return observation.themes.length;
}

export function evaluateShopping(input:{itemId:string;prompt:string;visible:boolean;position?:number;quotedPrice?:number;currency?:string;competitors?:string[];attributes?:string[];sourceUrls?:string[]},brain:BusinessBrain){
  const item=brain.items.find(i=>i.id===input.itemId);if(!item)throw new Error("That catalogue item is not in the Business Brain.");
  const priceMatch=input.quotedPrice==null||item.priceMin==null?null:Math.abs(input.quotedPrice-item.priceMin)<.005;
  return {...input,canonicalPrice:item.priceMin,canonicalCurrency:item.currency,priceMatch,won:input.visible&&(input.position||99)===1,
    action:priceMatch===false?{route:"feed_or_content_correction",title:`Correct the quoted price for ${item.title}`,evidence:{quoted:input.quotedPrice,canonical:item.priceMin},verification:["Verify the public source price.","Rerun the same shopping prompt."],retest:true}:null};
}

export async function recordShoppingObservation(env:Env,shop:string,runId:string|null,result:ReturnType<typeof evaluateShopping>,evidenceTier:"observed"|"manual"|"synthetic",nowMs=Date.now()){
  const id=makeId("shopobs",nowMs);
  await env.DB.prepare(`INSERT INTO shopping_observations(id,shop_domain,run_id,item_id,prompt,visible,won,position,
    quoted_price,quoted_currency,canonical_price,price_match,competitors_json,attributes_json,source_urls_json,evidence_tier,observed_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,shop,runId,result.itemId,clean(result.prompt,1000),result.visible?1:0,result.won?1:0,
      result.position??null,result.quotedPrice??null,result.currency||null,result.canonicalPrice,result.priceMatch==null?null:result.priceMatch?1:0,
      JSON.stringify(result.competitors||[]),JSON.stringify(result.attributes||[]),JSON.stringify(result.sourceUrls||[]),evidenceTier,nowMs).run();
  return id;
}

export async function createAnalyticsAction(env:Env,shop:string,input:{sourceType:string;sourceId:string;route:"fix_site"|"fix_content"|"business_brain"|"source_opportunity"|"catalog"|"sales_agent"|"provider_dependency"|"manual";title:string;evidence:Record<string,unknown>;expectedMetric?:string;confidence:number;owner:string;preview?:unknown;verification:string[];rollbackAvailable?:boolean},nowMs=Date.now()){
  const id=makeId("action",nowMs);await env.DB.prepare(`INSERT INTO analytics_actions(id,shop_domain,source_type,source_id,route,title,evidence_json,expected_metric,confidence,owner,preview_json,verification_json,rollback_available,status,created_ms,updated_ms)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'proposed',?,?) ON CONFLICT(shop_domain,source_type,source_id,route) DO UPDATE SET title=excluded.title,evidence_json=excluded.evidence_json,expected_metric=excluded.expected_metric,confidence=excluded.confidence,owner=excluded.owner,preview_json=excluded.preview_json,verification_json=excluded.verification_json,rollback_available=excluded.rollback_available,updated_ms=excluded.updated_ms`)
    .bind(id,shop,input.sourceType,input.sourceId,input.route,clean(input.title,300),JSON.stringify(input.evidence),input.expectedMetric||null,clamp(input.confidence,0,1),clean(input.owner,80),input.preview==null?null:JSON.stringify(input.preview),JSON.stringify(input.verification),input.rollbackAvailable?1:0,nowMs,nowMs).run();return id;
}

export async function analyticsReport(env:Env,shop:string){
  const runs=await env.DB.prepare(`SELECT subject,mentioned,cited,recommended,selected,task_completed,attributed,position,sentiment,sentiment_score,provider,model,country,surface,category,observed_ms
    FROM visibility_prompt_runs WHERE shop_domain=? ORDER BY observed_ms DESC LIMIT 1000`).bind(shop).all<VisibilityRow>();
  const fanouts=await env.DB.prepare(`SELECT f.* FROM visibility_fanouts f JOIN visibility_prompt_runs r ON r.id=f.run_id
    WHERE r.shop_domain=? ORDER BY f.observed_ms DESC LIMIT 1000`).bind(shop).all<Record<string,unknown>>();
  const sources=await env.DB.prepare(`SELECT s.domain,s.ownership,COUNT(*) AS occurrences,
    SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS citations FROM visibility_sources s
    JOIN visibility_prompt_runs r ON r.id=s.run_id LEFT JOIN visibility_citations c ON c.run_id=s.run_id AND c.url=s.url
    WHERE r.shop_domain=? GROUP BY s.domain,s.ownership ORDER BY citations DESC,occurrences DESC LIMIT 200`).bind(shop).all<Record<string,unknown>>();
  const shelfSources=await env.DB.prepare(`SELECT r.provider,r.surface,s.url,s.source_type,s.ownership,COUNT(*) AS occurrences,
    SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS citations FROM visibility_sources s
    JOIN visibility_prompt_runs r ON r.id=s.run_id LEFT JOIN visibility_citations c ON c.run_id=s.run_id AND c.url=s.url
    WHERE r.shop_domain=? GROUP BY r.provider,r.surface,s.url,s.source_type,s.ownership
    ORDER BY citations DESC,occurrences DESC LIMIT 1000`).bind(shop).all<Record<string,unknown>>();
  const crawlers=await env.DB.prepare(`SELECT provider,bot,COUNT(*) AS visits,SUM(CASE WHEN status>=400 OR error_code IS NOT NULL THEN 1 ELSE 0 END) AS failures,
    MAX(observed_ms) AS last_seen_ms FROM crawler_observations WHERE shop_domain=? GROUP BY provider,bot ORDER BY visits DESC`).bind(shop).all();
  const shopping=await env.DB.prepare(`SELECT item_id,COUNT(*) AS prompts,SUM(visible) AS visible,SUM(won) AS wins,AVG(position) AS average_position,
    SUM(CASE WHEN price_match=0 THEN 1 ELSE 0 END) AS price_mismatches FROM shopping_observations WHERE shop_domain=? GROUP BY item_id`).bind(shop).all();
  const chatFeatures=await env.DB.prepare(`SELECT COUNT(*) AS runs,AVG(web_search) AS web_search_rate,AVG(shopping) AS shopping_rate,
    AVG(product_comparison) AS comparison_rate,AVG(maps_local) AS maps_rate,AVG(ads) AS ads_rate,AVG(citations) AS citation_feature_rate
    FROM visibility_chat_features f JOIN visibility_prompt_runs r ON r.id=f.run_id WHERE r.shop_domain=?`).bind(shop).first();
  const perception=await env.DB.prepare(`SELECT subject,theme,polarity,COUNT(*) AS observations,
    SUM(CASE WHEN conflicts_fact_key IS NOT NULL THEN 1 ELSE 0 END) AS misinformation_alerts,MAX(observed_ms) AS latest_ms
    FROM perception_observations WHERE shop_domain=? GROUP BY subject,theme,polarity ORDER BY observations DESC LIMIT 100`).bind(shop).all();
  const actions=await env.DB.prepare("SELECT * FROM analytics_actions WHERE shop_domain=? ORDER BY updated_ms DESC LIMIT 200").bind(shop).all();
  const fanoutRows=fanouts.results as Array<Record<string,unknown>>;
  return {visibility:aggregateVisibility(runs.results),fanouts:{total:fanoutRows.length,observed:fanoutRows.filter(f=>f.source!=="agentready_synthetic").length,
      synthetic:fanoutRows.filter(f=>f.source==="agentready_synthetic").length,repeatedTerms:repeatedTerms(fanoutRows.map(f=>String(f.query))),rows:fanoutRows},
    sources:sources.results,sourceGaps:sourceGap((sources.results as any[]).map(s=>({domain:String(s.domain),ownership:String(s.ownership),citations:Number(s.citations||0)}))),
    aiShelf:aiShelfAnalytics({sources:shelfSources.results as any[],recommendations:runs.results.map(r=>({provider:r.provider,surface:r.surface,category:r.category,subject:r.subject,recommended:r.recommended}))}),
    chatFeatures:chatFeatures||{runs:0},perception:perception.results,crawlers:crawlers.results,shopping:shopping.results,actions:actions.results,
    caveat:"Observed provider evidence, authorised imports, manual evidence and synthetic planning data remain separate. Small samples are not presented as stable rankings."};
}

export async function fanoutsToGrowthOpportunities(env:Env,shop:string,fanouts:FanoutInput[]){
  const created=[] as string[];for(const opportunity of opportunitiesFromQuestions(fanouts.map(f=>f.query),"fanout"))created.push(await saveGrowthOpportunity(env,shop,opportunity));return created;
}

export const ANALYTICS_EXPORT_COLUMNS=["observed_ms","provider","model","country","locale","prompt","subject","mentioned","cited","recommended","position","sentiment","method"] as const;
export function analyticsCsv(rows:Array<Record<string,unknown>>){
  const quote=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;
  return [ANALYTICS_EXPORT_COLUMNS.join(","),...rows.map(r=>ANALYTICS_EXPORT_COLUMNS.map(c=>quote(r[c])).join(","))].join("\n");
}
