import type {Env} from "../types";
import {PROVIDERS} from "../providers/registry";

// Standards and provider claims change independently from application releases. This registry
// is the single inventory of facts AgentCart is currently prepared to rely on. A fact becoming
// stale never becomes a merchant failure: its effective evidence becomes unknown and it is
// queued for a human to re-check against the named source.

export const STANDARDS_REGISTRY_VERSION="2026-09-17.1";
export const CURRENT_MCP_VERSION="2026-07-28";
export const LEGACY_MCP_VERSIONS=["2025-11-25","2025-06-18","2025-03-26","2024-11-05"] as const;

export type EvidenceBasis="verified"|"inferred"|"declared"|"unknown";
export type RegistryConfidence="high"|"medium"|"low";
export type RegistryLifecycle="active"|"deprecated";

export interface RegistryFact {
  key:string;
  family:"standard"|"provider"|"client_profile";
  title:string;
  source:string;
  verifiedOn:string;
  version:string;
  basis:EvidenceBasis;
  confidence:RegistryConfidence;
  lifecycle:RegistryLifecycle;
  staleAfterDays:number;
  detail:string;
}

const MCP_BASE=`https://modelcontextprotocol.io/specification/${CURRENT_MCP_VERSION}`;

export const STANDARD_FACTS:RegistryFact[]=[
  {key:"mcp.core",family:"standard",title:"MCP core protocol",source:`${MCP_BASE}/basic/versioning`,
   verifiedOn:"2026-09-17",version:CURRENT_MCP_VERSION,basis:"verified",confidence:"high",
   lifecycle:"active",staleAfterDays:90,
   detail:"Modern MCP is stateless. Version, client identity and capabilities travel on every request; legacy revisions use initialize."},
  {key:"mcp.streamable_http",family:"standard",title:"MCP Streamable HTTP transport",
   source:`${MCP_BASE}/basic/transports/streamable-http`,verifiedOn:"2026-09-17",
   version:CURRENT_MCP_VERSION,basis:"verified",confidence:"high",lifecycle:"active",staleAfterDays:90,
   detail:"Each message is an HTTP POST. Modern requests carry matching body and header protocol metadata and accept JSON or SSE."},
  {key:"mcp.tools",family:"standard",title:"MCP tools",source:`${MCP_BASE}/server/tools`,
   verifiedOn:"2026-09-17",version:CURRENT_MCP_VERSION,basis:"verified",confidence:"high",
   lifecycle:"active",staleAfterDays:90,
   detail:"Tools are discovered with tools/list, may be paginated and cached, and results and declared schemas require validation."},
  {key:"mcp.authorization",family:"standard",title:"MCP HTTP authorization",
   source:`${MCP_BASE}/basic/authorization`,verifiedOn:"2026-09-17",version:CURRENT_MCP_VERSION,
   basis:"verified",confidence:"high",lifecycle:"active",staleAfterDays:90,
   detail:"Authorization is optional. Protected servers use protected-resource metadata, issuer discovery, audience-bound tokens and least privilege."},
  {key:"mcp.extensions",family:"standard",title:"MCP extensions",source:`${MCP_BASE}/basic/versioning`,
   verifiedOn:"2026-09-17",version:CURRENT_MCP_VERSION,basis:"verified",confidence:"high",
   lifecycle:"active",staleAfterDays:90,
   detail:"Extensions, including Tasks, apply only when advertised in capabilities."},
  ...PROVIDERS.map((p):RegistryFact=>({
    key:`provider.${p.id}`,family:"provider",title:`${p.label} provider facts`,source:p.sources[0],
    verifiedOn:p.verifiedOn,version:p.verifiedOn,basis:"verified",confidence:"high",
    lifecycle:"active",staleAfterDays:30,
    detail:`Crawler, region and protocol claims for ${p.label}.`
  })),
  {key:"client.generic_modern_http",family:"client_profile",title:"Generic modern MCP HTTP client",
   source:`${MCP_BASE}/basic/versioning`,verifiedOn:"2026-09-17",version:CURRENT_MCP_VERSION,
   basis:"verified",confidence:"high",lifecycle:"active",staleAfterDays:90,
   detail:"Evidence-backed standards profile only. It does not claim product-specific behaviour for ChatGPT, Claude or another client."},
  {key:"client.generic_legacy_http",family:"client_profile",title:"Generic legacy MCP HTTP client",
   source:`${MCP_BASE}/basic/versioning`,verifiedOn:"2026-09-17",version:"2025-11-25-and-earlier",
   basis:"verified",confidence:"high",lifecycle:"deprecated",staleAfterDays:90,
   detail:"Compatibility profile for initialize-based clients. Kept separate from current MCP compliance."}
];

function dateMs(iso:string){const ms=Date.parse(`${iso}T00:00:00Z`);return Number.isFinite(ms)?ms:0;}

export interface EffectiveRegistryFact extends RegistryFact {
  registryVersion:string;
  stale:boolean;
  reviewRequired:boolean;
  effectiveBasis:EvidenceBasis;
}

export function registrySnapshot(nowMs=Date.now()):EffectiveRegistryFact[]{
  return STANDARD_FACTS.map(f=>{
    const stale=!dateMs(f.verifiedOn)||nowMs-dateMs(f.verifiedOn)>f.staleAfterDays*86400000;
    return {...f,registryVersion:STANDARDS_REGISTRY_VERSION,stale,
      reviewRequired:stale,effectiveBasis:stale?"unknown":f.basis};
  });
}

/** Queue stale facts for trusted-source review. This never changes the registry itself. */
export async function queueStaleRegistryFacts(env:Env,nowMs=Date.now()){
  const stale=registrySnapshot(nowMs).filter(f=>f.reviewRequired);
  for(const fact of stale){
    await env.DB.prepare(`INSERT INTO standards_review_queue
      (registry_key,source_url,reason,observed_version,status,queued_ms)
      VALUES(?,?,?,?, 'queued', ?)
      ON CONFLICT(registry_key) DO UPDATE SET source_url=excluded.source_url,
      reason=excluded.reason,observed_version=excluded.observed_version,
      queued_ms=CASE WHEN standards_review_queue.status='resolved' THEN excluded.queued_ms ELSE standards_review_queue.queued_ms END,
      status=CASE WHEN standards_review_queue.status='resolved' THEN 'queued' ELSE standards_review_queue.status END`)
      .bind(fact.key,fact.source,"Verification date exceeded the registry freshness window.",fact.version,nowMs).run();
  }
  return stale.map(f=>f.key);
}

export function factByKey(key:string,nowMs=Date.now()){
  return registrySnapshot(nowMs).find(f=>f.key===key)||null;
}
