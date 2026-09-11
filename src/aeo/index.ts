import type {Env} from "../types";

// AI Visibility / AEO. Agent readiness and AI recommendation are different questions: a business
// can be perfectly readable and still never mentioned.
//
// THE RULE THAT SHAPES THIS MODULE: a provider that cannot be tested programmatically and
// reproducibly is marked unsupported. It is never estimated, inferred or faked. No adapter ships
// enabled, so AgentCart currently reports "not measured" rather than a number it cannot stand up.

export type AeoStatus="measured"|"unsupported"|"not_run"|"failed";

export interface AeoProviderAdapter {
  id:string;
  label:string;
  /** Enabled only when legitimate programmatic access exists and is configured. */
  available(env:Env):boolean;
  unsupportedReason:string;
  run?(env:Env,queries:AeoQuery[],subjects:string[]):Promise<AeoObservation[]>;
}

export interface AeoQuery { id:string; intent:string; query:string; category?:string }
export interface AeoObservation {
  queryId:string;subject:string;isCompetitor:boolean;
  mentioned:boolean;cited:boolean;recommended:boolean;position:number|null;evidence:string;
}

// Adapters are declared so the shape is real and a key can activate one later. None is available
// today: querying a live assistant needs paid API access that this deployment does not have.
export const ADAPTERS:AeoProviderAdapter[]=[
  {id:"openai",label:"ChatGPT",available:()=>false,
   unsupportedReason:"Programmatic testing needs an OpenAI API key, which is not configured. AgentCart will not estimate a number it cannot measure."},
  {id:"anthropic",label:"Claude",available:()=>false,
   unsupportedReason:"Programmatic testing needs an Anthropic API key, which is not configured."},
  {id:"google",label:"Gemini",available:()=>false,
   unsupportedReason:"Programmatic testing needs a Google AI API key, which is not configured."},
  {id:"perplexity",label:"Perplexity",available:()=>false,
   unsupportedReason:"Programmatic testing needs a Perplexity API key, which is not configured."},
  {id:"meta",label:"Meta Muse",available:()=>false,
   unsupportedReason:"Muse has no documented programmatic testing interface. Scraping a consumer interface would breach provider terms, so this is reported as manual-only rather than measured."}
];

// --- Query sets ---------------------------------------------------------------------------

const INTENTS=[
  {intent:"category_location",template:(b:string,c:string,l:string)=>`best ${c} in ${l}`},
  {intent:"product_problem",template:(b:string,c:string)=>`what should I buy for ${c}`},
  {intent:"comparison",template:(b:string,c:string)=>`best ${c} compared`},
  {intent:"service_urgency",template:(b:string,c:string,l:string)=>`${c} near ${l} available this week`},
  {intent:"informational",template:(b:string,c:string)=>`how do I choose a ${c}`}
];

/** Query sets are built from category and location, never from the business name.
 *  "Tell me about <business>" measures nothing: an assistant asked about a named business will
 *  discuss it regardless of whether it would ever recommend it. */
export function suggestQueries(category:string,location?:string):Array<{intent:string;query:string}>{
  const c=category.trim().toLowerCase();
  if(!c)return [];
  const l=(location||"").trim();
  return INTENTS
    .filter(i=>l||!i.template.length||!/location|urgency/.test(i.intent))
    .map(i=>({intent:i.intent,query:i.template("",c,l).replace(/\s+/g," ").trim()}))
    .filter(q=>q.query&&!/ in $| near $/.test(q.query));
}

export function isVanityQuery(query:string,businessName:string){
  const q=query.toLowerCase(),name=businessName.trim().toLowerCase();
  if(!name)return false;
  // A query naming the business is not a visibility measurement.
  return q.includes(name);
}

export async function addQuery(env:Env,shop:string,intent:string,query:string,category?:string,nowMs=Date.now()){
  const id=`q_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  await env.DB.prepare(`INSERT INTO aeo_queries(id,shop_domain,intent,query,category,active,created_ms)
    VALUES(?,?,?,?,?,1,?)`).bind(id,shop,intent,query,category||null,nowMs).run();
  return id;
}

export async function listQueries(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT * FROM aeo_queries WHERE shop_domain=? AND active=1 ORDER BY created_ms")
    .bind(shop).all();
  return rows.results as unknown as AeoQuery[];
}

export async function setCompetitors(env:Env,shop:string,competitors:Array<{name:string;domain?:string}>){
  await env.DB.prepare("DELETE FROM aeo_competitors WHERE shop_domain=?").bind(shop).run();
  if(!competitors.length)return;
  await env.DB.batch(competitors.slice(0,10).map(c=>
    env.DB.prepare("INSERT INTO aeo_competitors(shop_domain,name,domain) VALUES(?,?,?)")
      .bind(shop,c.name,c.domain||null)));
}

export async function listCompetitors(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT name,domain FROM aeo_competitors WHERE shop_domain=?").bind(shop).all();
  return rows.results as Array<{name:string;domain:string|null}>;
}

// --- Running ------------------------------------------------------------------------------

export interface AeoRunResult {
  runId:string;provider:string;status:AeoStatus;
  unsupportedReason?:string;observations:AeoObservation[];
}

export async function runAeo(env:Env,shop:string,providerId:string,businessName:string,nowMs=Date.now()):Promise<AeoRunResult>{
  const adapter=ADAPTERS.find(a=>a.id===providerId);
  const runId=`aeo_${nowMs.toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  if(!adapter)
    return {runId,provider:providerId,status:"unsupported",
      unsupportedReason:"Unknown provider.",observations:[]};

  if(!adapter.available(env)||!adapter.run){
    await env.DB.prepare(`INSERT INTO aeo_runs(id,shop_domain,provider,status,unsupported_reason,started_ms,completed_ms)
      VALUES(?,?,?,'unsupported',?,?,?)`)
      .bind(runId,shop,adapter.id,adapter.unsupportedReason,nowMs,nowMs).run();
    return {runId,provider:adapter.id,status:"unsupported",
      unsupportedReason:adapter.unsupportedReason,observations:[]};
  }

  const queries=(await listQueries(env,shop)).filter(q=>!isVanityQuery(q.query,businessName));
  const subjects=[businessName,...(await listCompetitors(env,shop)).map(c=>c.name)];
  await env.DB.prepare(`INSERT INTO aeo_runs(id,shop_domain,provider,status,started_ms) VALUES(?,?,?,'running',?)`)
    .bind(runId,shop,adapter.id,nowMs).run();
  try{
    const observations=await adapter.run(env,queries,subjects);
    if(observations.length)
      await env.DB.batch(observations.map(o=>env.DB.prepare(
        `INSERT INTO aeo_results(run_id,query_id,subject,is_competitor,mentioned,cited,recommended,position,evidence,created_ms)
         VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .bind(runId,o.queryId,o.subject,o.isCompetitor?1:0,o.mentioned?1:0,o.cited?1:0,
          o.recommended?1:0,o.position,o.evidence.slice(0,500),nowMs)));
    await env.DB.prepare("UPDATE aeo_runs SET status='measured',completed_ms=? WHERE id=?").bind(nowMs,runId).run();
    return {runId,provider:adapter.id,status:"measured",observations};
  }catch(e){
    await env.DB.prepare("UPDATE aeo_runs SET status='failed',unsupported_reason=?,completed_ms=? WHERE id=?")
      .bind(e instanceof Error?e.message.slice(0,300):"run failed",nowMs,runId).run();
    return {runId,provider:adapter.id,status:"failed",observations:[]};
  }
}

// --- Reporting ----------------------------------------------------------------------------

export interface AeoMetrics {
  subject:string;isCompetitor:boolean;
  queries:number;mentionRate:number;citationRate:number;recommendationRate:number;
  averagePosition:number|null;
}

export interface AeoReport {
  status:AeoStatus;
  measuredProviders:string[];
  unsupportedProviders:Array<{provider:string;reason:string}>;
  metrics:AeoMetrics[];
  shareOfVoice:Array<{subject:string;isCompetitor:boolean;share:number}>;
  caveat:string;
  summary:string;
}

export const AEO_CAVEAT=
  "These figures come from a fixed set of test questions, not from real customer conversations. They show how assistants answered those questions when asked; they do not predict what every customer will see, and no ranking or recommendation is promised.";

export async function aeoReport(env:Env,shop:string):Promise<AeoReport>{
  const runs=await env.DB.prepare("SELECT id,provider,status,unsupported_reason FROM aeo_runs WHERE shop_domain=? ORDER BY started_ms DESC LIMIT 20")
    .bind(shop).all();
  const rows=runs.results as Array<any>;
  const measured=rows.filter(r=>r.status==="measured");
  const unsupported=ADAPTERS.filter(a=>!a.available(env))
    .map(a=>({provider:a.label,reason:a.unsupportedReason}));

  if(!measured.length)
    return {status:"unsupported",measuredProviders:[],unsupportedProviders:unsupported,
      metrics:[],shareOfVoice:[],caveat:AEO_CAVEAT,
      summary:"AI visibility has not been measured. No assistant can currently be queried programmatically from this deployment, so AgentCart reports nothing rather than estimating."};

  const results=await env.DB.prepare(
    `SELECT subject,is_competitor,COUNT(*) AS queries,
       SUM(mentioned) AS mentions, SUM(cited) AS citations, SUM(recommended) AS recommendations,
       AVG(position) AS avg_position
     FROM aeo_results WHERE run_id IN (${measured.map(()=>"?").join(",")})
     GROUP BY subject,is_competitor`).bind(...measured.map(r=>r.id)).all();

  const metrics:AeoMetrics[]=(results.results as Array<any>).map(r=>({
    subject:String(r.subject),isCompetitor:!!Number(r.is_competitor),
    queries:Number(r.queries||0),
    mentionRate:Number(r.queries)?Number(r.mentions)/Number(r.queries):0,
    citationRate:Number(r.queries)?Number(r.citations)/Number(r.queries):0,
    recommendationRate:Number(r.queries)?Number(r.recommendations)/Number(r.queries):0,
    averagePosition:r.avg_position==null?null:Number(r.avg_position)}));

  const totalMentions=metrics.reduce((n,m)=>n+m.mentionRate*m.queries,0);
  const shareOfVoice=metrics.map(m=>({subject:m.subject,isCompetitor:m.isCompetitor,
    share:totalMentions?(m.mentionRate*m.queries)/totalMentions:0}));

  const me=metrics.find(m=>!m.isCompetitor);
  return {status:"measured",measuredProviders:[...new Set(measured.map(r=>String(r.provider)))],
    unsupportedProviders:unsupported,metrics,shareOfVoice,caveat:AEO_CAVEAT,
    summary:me
      ? `You were recommended in ${Math.round(me.recommendationRate*me.queries)} of ${me.queries} test questions.`
      : "No results were recorded for your business."};
}

/** Language for connecting an AEO gap to a readiness finding, without claiming causation. */
export function associationLanguage(gap:string){
  return `Assistants that favoured a competitor most often had clearer ${gap}. This is an observed difference and a likely contributor, not a proven cause.`;
}
