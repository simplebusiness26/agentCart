import type {Env} from "../types";

const makeId=(prefix:string,now=Date.now(),n=0)=>`${prefix}_${now.toString(36)}_${n.toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const clean=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const clamp01=(n:number)=>Math.max(0,Math.min(1,Number.isFinite(n)?n:0));

export interface EvidenceSpanRow {run_id:string;subject:string;start_offset:number;end_offset:number;answer_length:number;provider?:string;model?:string;country?:string;observed_ms?:number;}
export function prominenceMetrics(rows:EvidenceSpanRow[]){
  const bySubject=new Map<string,Map<string,EvidenceSpanRow[]>>(),contexts=new Map<string,{subject:string;provider:string;model:string;country:string}>();
  for(const row of rows){if(row.answer_length<=0||row.end_offset<=row.start_offset)continue;
    const context={subject:row.subject,provider:clean(row.provider,80)||"unknown",model:clean(row.model,120)||"unknown",country:clean(row.country,8)||"unknown"},key=JSON.stringify(context);
    const runs=bySubject.get(key)||new Map<string,EvidenceSpanRow[]>(),spans=runs.get(row.run_id)||[];
    spans.push(row);runs.set(row.run_id,spans);bySubject.set(key,runs);contexts.set(key,context);}
  return [...bySubject].map(([key,runs])=>{const context=contexts.get(key)!,all=[...runs.values()].flat(),perRun=[...runs.values()].map(spans=>{const answerLength=Math.max(...spans.map(s=>s.answer_length));
      const earliest=Math.min(...spans.map(s=>s.start_offset)),coverage=spans.reduce((n,s)=>n+Math.max(0,s.end_offset-s.start_offset),0)/answerLength;
      const early=1-earliest/answerLength;return {early:clamp01(early),coverage:clamp01(coverage),score:clamp01(.6*early+.4*coverage)};});
    const avg=(key:"early"|"coverage"|"score")=>perRun.reduce((n,r)=>n+r[key],0)/perRun.length;
    return {...context,sampleSize:perRun.length,windowStartMs:Math.min(...all.map(r=>Number(r.observed_ms||0))),windowEndMs:Math.max(...all.map(r=>Number(r.observed_ms||0))),prominence:avg("score"),earlyPosition:avg("early"),answerCoverage:avg("coverage"),
      stability:perRun.length<5?"insufficient_sample":perRun.length<20?"early_signal":"measured"};});
}

export interface AttributeObservationRow {brand:string;attribute:string;polarity:string;evidence_span?:string;observed_ms?:number;}
export function brandPerceptionMetrics(rows:AttributeObservationRow[],minimumCorpus=5){
  const brandTotals=new Map<string,number>(),attributeTotals=new Map<string,number>(),pairs=new Map<string,number>();
  for(const row of rows){const brand=clean(row.brand,160),attribute=clean(row.attribute,160).toLowerCase();if(!brand||!attribute)continue;
    brandTotals.set(brand,(brandTotals.get(brand)||0)+1);attributeTotals.set(attribute,(attributeTotals.get(attribute)||0)+1);
    const key=`${brand}\u0000${attribute}`;pairs.set(key,(pairs.get(key)||0)+1);}
  const associations=[...pairs].map(([key,count])=>{const [brand,attribute]=key.split("\u0000"),brandSample=brandTotals.get(brand)||0,marketSample=attributeTotals.get(attribute)||0;
    return {brand,attribute,count,brandSample,marketSample,association:brandSample?count/brandSample:0,marketProminence:marketSample?count/marketSample:0,
      stability:brandSample<minimumCorpus||marketSample<minimumCorpus?"insufficient_sample":"measured"};})
    .sort((a,b)=>b.count-a.count||a.brand.localeCompare(b.brand));
  const shapes=[...brandTotals].map(([brand,sampleSize])=>({brand,sampleSize,attributes:associations.filter(a=>a.brand===brand)
    .map(a=>({attribute:a.attribute,association:a.association,marketProminence:a.marketProminence,count:a.count}))}));
  return {associations,shapes,minimumCorpus,note:"Association describes observed language in the selected corpus. It does not prove that an attribute is factually true."};
}

export interface IndustryObservation {subject:string;mentioned:number|boolean;category?:string|null;provider?:string;model?:string;country?:string;entities_json?:string|string[];}
function entities(value:IndustryObservation["entities_json"]){if(Array.isArray(value))return value.map(String);try{const parsed=JSON.parse(String(value||"[]"));return Array.isArray(parsed)?parsed.map(String):[];}catch{return [];}}
export function industryFitMetrics(rows:IndustryObservation[],minimumCorpus=10){
  const groups=new Map<string,IndustryObservation[]>(),contexts=new Map<string,{category:string;provider:string;model:string;country:string}>();for(const row of rows){const context={category:clean(row.category,160),provider:clean(row.provider,80)||"unknown",model:clean(row.model,120)||"unknown",country:clean(row.country,8)||"unknown"};if(!context.category)continue;const key=JSON.stringify(context),list=groups.get(key)||[];list.push(row);groups.set(key,list);contexts.set(key,context);}
  return [...groups].map(([key,list])=>{const context=contexts.get(key)!,counts=new Map<string,number>(),pairs=new Map<string,number>();
    for(const row of list){const present=[...new Set([...(row.mentioned?[row.subject]:[]),...entities(row.entities_json)].map(v=>clean(v,160)).filter(Boolean))];
      for(const name of present)counts.set(name,(counts.get(name)||0)+1);
      for(let i=0;i<present.length;i++)for(let j=i+1;j<present.length;j++){const key=[present[i],present[j]].sort().join("\u0000");pairs.set(key,(pairs.get(key)||0)+1);}}
    const sampleSize=list.length,subjects=[...counts].map(([subject,count])=>({subject,count,industryFit:count/sampleSize})).sort((a,b)=>b.count-a.count);
    const cooccurrence=[...pairs].map(([key,count])=>{const [left,right]=key.split("\u0000");return {left,right,count,rate:count/sampleSize};}).sort((a,b)=>b.count-a.count);
    return {...context,sampleSize,
      subjects,cooccurrence,stability:sampleSize<minimumCorpus?"insufficient_sample":"measured"};});
}

export async function refreshIndustryBenchmarks(env:Env,shop:string,nowMs=Date.now()){
  const windowStart=nowMs-30*24*60*60*1000;
  const rows=await env.DB.prepare(`SELECT subject,mentioned,category,provider,model,country,entities_json FROM visibility_prompt_runs
    WHERE shop_domain=? AND category IS NOT NULL AND observed_ms>=? ORDER BY observed_ms DESC LIMIT 20000`).bind(shop,windowStart).all<IndustryObservation>();
  const panels=industryFitMetrics(rows.results);
  for(const panel of panels){
    await env.DB.prepare("DELETE FROM merchant_industry_benchmarks WHERE shop_domain=? AND category=? AND provider=? AND model=? AND country=?").bind(shop,panel.category,panel.provider,panel.model,panel.country).run();
    await env.DB.prepare(`INSERT INTO merchant_industry_benchmarks(id,shop_domain,category,provider,model,country,window_start_ms,window_end_ms,sample_size,subjects_json,cooccurrence_json,created_ms)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(makeId("industry",nowMs),shop,panel.category,panel.provider,panel.model,panel.country,windowStart,nowMs,panel.sampleSize,
        JSON.stringify(panel.subjects),JSON.stringify(panel.cooccurrence),nowMs).run();
  }
  return panels;
}

export interface ReferralImportRow {assistant?:string|null;source?:string|null;landingPage?:string|null;country?:string|null;device?:string|null;sessions?:number;engagedSessions?:number;conversions?:number;revenue?:number;currency?:string|null;}
const assistantName=(row:ReferralImportRow)=>{const raw=clean(row.assistant||row.source,160).toLowerCase();
  if(/chatgpt|openai/.test(raw))return "ChatGPT";if(/perplexity/.test(raw))return "Perplexity";if(/gemini|bard/.test(raw))return "Gemini";
  if(/claude|anthropic/.test(raw))return "Claude";if(/copilot|bing/.test(raw))return "Microsoft Copilot";return raw?clean(row.assistant||row.source,160):"Unknown AI assistant";};

export function normalizeReferralRows(rows:ReferralImportRow[]){return rows.slice(0,10_000).map(row=>({assistant:assistantName(row),
  landingPage:clean(row.landingPage,1000)||null,country:clean(row.country,80)||null,device:clean(row.device,80)||null,
  sessions:Math.max(0,Math.floor(Number(row.sessions)||0)),engagedSessions:Math.max(0,Math.floor(Number(row.engagedSessions)||0)),
  conversions:Math.max(0,Number(row.conversions)||0),revenue:Math.max(0,Number(row.revenue)||0),currency:clean(row.currency,8)||null}));}

async function importReferralRows(env:Env,shop:string,input:{provider:"ga4"|"manual";evidenceTier:"authorised_ga4"|"manual_import";windowStart:string;windowEnd:string;rows:ReferralImportRow[]},nowMs=Date.now()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.windowStart)||!/^\d{4}-\d{2}-\d{2}$/.test(input.windowEnd))throw new Error("Referral windows must use YYYY-MM-DD dates.");
  const rows=normalizeReferralRows(Array.isArray(input.rows)?input.rows:[]);if(!rows.length)throw new Error("No referral rows were supplied.");
  const existing=await env.DB.prepare("SELECT id FROM analytics_import_batches WHERE shop_domain=? AND provider=? AND window_start=? AND window_end=?")
    .bind(shop,input.provider,input.windowStart,input.windowEnd).all<{id:string}>();
  for(const batch of existing.results){await env.DB.prepare("DELETE FROM analytics_referrals WHERE batch_id=?").bind(batch.id).run();await env.DB.prepare("DELETE FROM analytics_import_batches WHERE id=?").bind(batch.id).run();}
  const batchId=makeId(input.provider==="ga4"?"ga":"manual",nowMs);await env.DB.prepare(`INSERT INTO analytics_import_batches(id,shop_domain,provider,evidence_tier,window_start,window_end,row_count,imported_ms)
    VALUES(?,?,?,?,?,?,?,?)`).bind(batchId,shop,input.provider,input.evidenceTier,input.windowStart,input.windowEnd,rows.length,nowMs).run();
  for(let i=0;i<rows.length;i+=50)await env.DB.batch(rows.slice(i,i+50).map((row,n)=>env.DB.prepare(`INSERT INTO analytics_referrals(id,batch_id,shop_domain,
    assistant,landing_page,country,device,sessions,engaged_sessions,conversions,revenue,currency,evidence_tier,window_start,window_end)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(makeId("ref",nowMs,i+n),batchId,shop,row.assistant,row.landingPage,row.country,row.device,row.sessions,row.engagedSessions,
      row.conversions,row.revenue,row.currency,input.evidenceTier,input.windowStart,input.windowEnd)));
  return {batchId,rows:rows.length,evidenceTier:input.evidenceTier,replacedWindow:existing.results.length>0,
    note:input.provider==="ga4"?"Authorised GA4 referral evidence is reported separately from signed AgentReady journeys and verified platform orders; it is never added to them as duplicate revenue.":"Manually supplied rows remain a weaker manual evidence tier and are never relabelled as an authorised GA4 import or summed with verified revenue."};
}

export function importAuthorisedReferrals(env:Env,shop:string,input:{provider:"ga4";windowStart:string;windowEnd:string;rows:ReferralImportRow[]},nowMs=Date.now()){
  return importReferralRows(env,shop,{...input,evidenceTier:"authorised_ga4"},nowMs);
}

export function importManualReferrals(env:Env,shop:string,input:{windowStart:string;windowEnd:string;rows:ReferralImportRow[]},nowMs=Date.now()){
  return importReferralRows(env,shop,{provider:"manual",evidenceTier:"manual_import",...input},nowMs);
}

export async function marketAnalyticsReport(env:Env,shop:string){
  const [spans,attributes,industry,referrals,batches,panels]=await Promise.all([
    env.DB.prepare(`SELECT s.run_id,s.subject,s.start_offset,s.end_offset,s.answer_length,r.provider,r.model,r.country,s.observed_ms FROM visibility_evidence_spans s
      JOIN visibility_prompt_runs r ON r.id=s.run_id WHERE r.shop_domain=? ORDER BY s.observed_ms DESC LIMIT 5000`).bind(shop).all<EvidenceSpanRow>(),
    env.DB.prepare("SELECT brand,attribute,polarity,evidence_span,observed_ms FROM brand_attribute_observations WHERE shop_domain=? ORDER BY observed_ms DESC LIMIT 5000").bind(shop).all<AttributeObservationRow>(),
    env.DB.prepare("SELECT subject,mentioned,category,provider,model,country,entities_json FROM visibility_prompt_runs WHERE shop_domain=? AND category IS NOT NULL ORDER BY observed_ms DESC LIMIT 5000").bind(shop).all<IndustryObservation>(),
    env.DB.prepare(`SELECT assistant,landing_page,country,device,SUM(sessions) sessions,SUM(engaged_sessions) engaged_sessions,
      SUM(conversions) conversions,SUM(revenue) revenue,currency FROM analytics_referrals WHERE shop_domain=?
      GROUP BY assistant,landing_page,country,device,currency ORDER BY sessions DESC LIMIT 1000`).bind(shop).all(),
    env.DB.prepare("SELECT id,provider,evidence_tier,window_start,window_end,row_count,imported_ms FROM analytics_import_batches WHERE shop_domain=? ORDER BY imported_ms DESC LIMIT 50").bind(shop).all(),
    env.DB.prepare("SELECT category,provider,model,country,window_start_ms,window_end_ms,sample_size,subjects_json,cooccurrence_json FROM merchant_industry_benchmarks WHERE shop_domain=? ORDER BY created_ms DESC LIMIT 100").bind(shop).all()
  ]);
  return {prominence:prominenceMetrics(spans.results),industryFit:industryFitMetrics(industry.results),industryPanels:panels.results,brandPerception:brandPerceptionMetrics(attributes.results),
    referrals:{rows:referrals.results,batches:batches.results,evidenceTiers:["authorised_ga4","manual_import"]},
    attributionRule:"Imported analytics, signed AgentReady journeys and verified platform orders remain separate evidence tiers and are never summed as identical proof."};
}
