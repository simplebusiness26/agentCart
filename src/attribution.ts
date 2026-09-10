import type {Env} from "./types";
import {normalizeOrderId} from "./shopify";
import {PROVIDERS} from "./providers/registry";

// Evidence tiers, strongest first. These are never mixed in a total, and nothing is promoted to a
// stronger tier by inference -- Phase 10.7 is explicit that a missing pixel must never be read as
// evidence of an agentic purchase.
export const TIERS=["verified","identifiable_referral","reported","assisted","unknown"] as const;
export type SourceTier=typeof TIERS[number];

export const TIER_LABELS:Record<SourceTier,string>={
  verified:"Verified",
  identifiable_referral:"Identifiable AI referral",
  reported:"Reported",
  assisted:"Assisted",
  unknown:"Unknown"
};

export const TIER_MEANING:Record<SourceTier,string>={
  verified:"Confirmed by a cryptographically verified order record from the platform.",
  identifiable_referral:"An AgentCart journey link was followed and joined to this order.",
  reported:"Reported by the storefront pixel. Useful, but a browser can be made to say anything.",
  assisted:"Modelled, not measured. Never counted as verified revenue.",
  unknown:"No defensible source. Deliberately not guessed."
};

// ---------------------------------------------------------------------------
// Commerce journey ids
// ---------------------------------------------------------------------------

const encoder=new TextEncoder();
const b64url=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");

async function sign(secret:string,message:string){
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(message))));
}

/** A signed, collision-resistant journey id. Carries no secret and no customer identity --
 *  only a random nonce, the shop and the provider, so a handoff can be joined to a later order. */
export async function createJourneyId(secret:string,shop:string,provider:string,nowMs=Date.now()){
  const nonce=new Uint8Array(12);crypto.getRandomValues(nonce);
  const body=`${b64url(nonce)}.${nowMs.toString(36)}`;
  const sig=(await sign(secret,`${shop}|${provider}|${body}`)).slice(0,16);
  return `ac1_${body}.${sig}`;
}

export async function verifyJourneyId(secret:string,shop:string,provider:string,journeyId:string){
  const m=String(journeyId||"").match(/^ac1_([A-Za-z0-9_-]{1,64}\.[A-Za-z0-9]{1,16})\.([A-Za-z0-9_-]{1,32})$/);
  if(!m)return false;
  const expected=(await sign(secret,`${shop}|${provider}|${m[1]}`)).slice(0,16);
  // Constant-time-ish comparison; lengths are fixed by construction.
  if(expected.length!==m[2].length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^m[2].charCodeAt(i);
  return diff===0;
}

export async function startJourney(env:Env,shop:string,provider:string,opts:{intent?:string;targetUrl?:string;itemId?:string;agentLabel?:string}={},nowMs=Date.now()){
  const journeyId=await createJourneyId(env.SHOPIFY_API_SECRET,shop,provider,nowMs);
  await env.DB.prepare(`INSERT INTO commerce_journeys(journey_id,shop_domain,provider,agent_label,intent,target_url,item_id,created_ms,last_seen_ms)
    VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(journeyId,shop,provider,opts.agentLabel||null,opts.intent||null,opts.targetUrl||null,opts.itemId||null,nowMs,nowMs).run();
  return journeyId;
}

export async function getJourney(env:Env,journeyId:string){
  return env.DB.prepare("SELECT * FROM commerce_journeys WHERE journey_id=?").bind(journeyId)
    .first<Record<string,unknown>>();
}

// ---------------------------------------------------------------------------
// Classifying a server-side order
// ---------------------------------------------------------------------------

export interface OrderSourceInput {
  /** Shopify-provided channel/source metadata, where the API exposes it. */
  channel?:string|null;
  sourceName?:string|null;
  referringSite?:string|null;
  landingSite?:string|null;
  journeyId?:string|null;
}

export interface OrderSourceResult {
  tier:SourceTier;
  agent:string;
  channel:string|null;
  evidence:string[];
}

// Matches platform channel/source metadata to a known provider.
//
// Deliberately narrow: it matches AGENTIC markers only, never a parent company's ordinary sales
// channel. Shopify reports source_name "facebook" for the Facebook Shop channel and "google" for
// Google Shopping -- neither is an AI agent, and counting them as one would fabricate exactly the
// AI revenue this product exists to measure honestly.
//
// Note \b does not work here: word boundaries treat "_" as a word character, so \bmeta\b fails
// to match the underscore-separated tokens platforms actually emit ("meta_ai_checkout").
const SEP="(?:^|[^a-z0-9])",END="(?:[^a-z0-9]|$)";
const CHANNEL_HINTS:Array<[RegExp,string,string]>=[
  [new RegExp(`${SEP}(?:muse|meta[_-]?ai)${END}`,"i"),"meta","Meta"],
  [new RegExp(`${SEP}(?:chatgpt|openai|instant[_-]?checkout)${END}`,"i"),"openai","ChatGPT"],
  [new RegExp(`${SEP}perplexity${END}`,"i"),"perplexity","Perplexity"],
  [new RegExp(`${SEP}gemini${END}`,"i"),"google","Gemini"],
  [new RegExp(`${SEP}(?:claude|anthropic)${END}`,"i"),"anthropic","Claude"]
];

export function classifyOrderSource(input:OrderSourceInput):OrderSourceResult{
  const evidence:string[]=[];
  const channel=input.channel||input.sourceName||null;

  // Strongest: an AgentCart journey id that survived into order metadata.
  if(input.journeyId){
    evidence.push(`AgentCart journey id present: ${input.journeyId}`);
  }

  const haystack=[input.channel,input.sourceName,input.referringSite,input.landingSite]
    .filter(Boolean).join(" ");
  for(const [re,id,label] of CHANNEL_HINTS){
    if(re.test(haystack)){
      const matched=haystack.match(re)?.[0]||"";
      evidence.push(`Platform order metadata matched "${matched}".`);
      return {tier:"verified",agent:label,channel,evidence};
    }
  }

  if(input.journeyId)
    return {tier:"identifiable_referral",agent:"AgentCart journey",channel,evidence};

  // A server-verified order with no AI evidence is a real order from an unknown source.
  // It is emphatically NOT attributed to an agent because the pixel did not fire.
  if(channel){
    evidence.push(`Platform reported channel "${channel}" with no AI marker.`);
    return {tier:"verified",agent:"Direct / unknown",channel,evidence};
  }
  evidence.push("No channel or referral evidence on the order.");
  return {tier:"unknown",agent:"Direct / unknown",channel:null,evidence};
}

export async function recordOrderSource(env:Env,shop:string,orderId:string,result:OrderSourceResult,journeyId?:string|null){
  await env.DB.prepare(`UPDATE orders SET source_tier=?,source_agent=?,source_channel=?,journey_id=?,evidence_json=?
    WHERE shop_domain=? AND order_id=?`)
    .bind(result.tier,result.agent,result.channel,journeyId||null,JSON.stringify(result.evidence),shop,orderId).run();
  if(journeyId)
    await env.DB.prepare("UPDATE commerce_journeys SET order_id=?,last_seen_ms=? WHERE journey_id=? AND shop_domain=?")
      .bind(normalizeOrderId(orderId),Date.now(),journeyId,shop).run();
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface TierBreakdown { tier:SourceTier; label:string; meaning:string; orders:number; revenue:number }

/** Revenue split by evidence tier. The tiers are returned separately and never summed into a
 *  single "AI revenue" figure, because that would launder reported numbers into verified ones. */
export async function revenueByTier(env:Env,shop:string,fromMs:number,toMs:number):Promise<TierBreakdown[]>{
  const rows=await env.DB.prepare(`SELECT source_tier AS tier, COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE shop_domain=? AND processed_ms>=? AND processed_ms<? GROUP BY source_tier`)
    .bind(shop,fromMs,toMs).all();
  const found=new Map((rows.results as Array<any>).map(r=>[String(r.tier),r]));
  return TIERS.map(tier=>{
    const row=found.get(tier);
    return {tier,label:TIER_LABELS[tier],meaning:TIER_MEANING[tier],
      orders:Number(row?.orders||0),revenue:Number(row?.revenue||0)};
  });
}

export async function agenticOrders(env:Env,shop:string,fromMs:number,toMs:number){
  const rows=await env.DB.prepare(`SELECT source_agent AS agent, source_tier AS tier,
      COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE shop_domain=? AND processed_ms>=? AND processed_ms<?
    GROUP BY source_agent, source_tier ORDER BY revenue DESC`).bind(shop,fromMs,toMs).all();
  return rows.results as Array<{agent:string;tier:SourceTier;orders:number;revenue:number}>;
}

export const KNOWN_PROVIDER_IDS=PROVIDERS.map(p=>p.id);
