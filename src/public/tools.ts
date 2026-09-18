import type {Env} from "../types";
import {assessSite} from "../agentready";
import {buildStandards} from "../standards";
import {DISCOVERY_PATHS} from "../providers/discovery";
import {PROTOCOLS} from "../protocol";
import {resolveSlug,buildProfile} from "../ailayer/service";
import {discoverResult,legacyInitialize,listResult,protocolError,READ_ONLY_ANNOTATIONS,requestEra,toolResult,type McpRequestContext} from "../mcp/compat";
import {registrySnapshot,STANDARDS_REGISTRY_VERSION} from "../standards/registry";

// AgentCart as a capability an agent can call (Phase 12.8).
//
// SAFETY BOUNDARY, enforced by construction: everything here is READ-ONLY and public. No tool
// here can mutate a merchant's store, read private merchant data, or reach a merchant-scoped
// route. Mutating actions stay behind an authenticated session in a separate part of the router.
//
// Scanning stays synchronous. There is no background scan and no get_scan_result, because
// pretending an async job exists when it does not would make an agent poll forever.

export const PUBLIC_TOOLS=[
  {name:"scan_site",description:"Scan any public business website and return an Agent Ready assessment: score, categories, what AI can and cannot understand and do, and prioritised fixes. Synchronous.",
   inputSchema:{type:"object",properties:{url:{type:"string",description:"Public website address."}},
     required:["url"],additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS},
  {name:"get_agent_standards",description:"List the agent standards and checks AgentCart currently evaluates, and what each means.",
   inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS},
  {name:"get_public_ai_profile",description:"Get the published AI profile for a business that has connected and published one.",
   inputSchema:{type:"object",properties:{slug:{type:"string"}},required:["slug"],additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS},
  {name:"get_supported_protocols",description:"List the agent commerce protocols AgentCart supports, and what it deliberately does not implement.",
   inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS}
] as const;

export type PublicToolName=typeof PUBLIC_TOOLS[number]["name"];

export async function callPublicTool(env:Env,name:string,args:Record<string,unknown>){
  switch(name){
    case "scan_site":{
      const url=String(args.url||"").trim();
      if(!url)return {error:"A public website address is required."};
      // assessSite applies the SSRF guard, byte caps and time budget already.
      const report=await assessSite(url);
      const standards=buildStandards({report,...report.readiness});
      return {
        domain:report.domain,score:report.score,grade:report.grade,
        scoringVersion:report.scoringVersion,platform:report.platform,
        categories:report.categories,capabilities:report.capabilities,
        pointsRecoverable:report.pointsRecoverable,
        businessType:standards.profile.type,
        agentStandards:{score:standards.score,applicable:standards.applicable,
          passing:standards.passing,summary:standards.summary,note:standards.note},
        discovery:report.readiness.discovery.map(d=>({path:d.path,state:d.state,detail:d.detail})),
        topFixes:report.checks.filter(c=>c.status!=="pass"&&c.status!=="na")
          .sort((a,b)=>b.estimatedGain-a.estimatedGain).slice(0,5)
          .map(c=>({title:c.plainTitle,whyItMatters:c.whyItMatters,fix:c.recommendedFix,pointsRecoverable:c.estimatedGain})),
        caveat:"This is a static assessment of published signals. It does not prove a full purchase or booking journey completes."
      };
    }
    case "get_agent_standards":
      return {registryVersion:STANDARDS_REGISTRY_VERSION,
        facts:registrySnapshot().map(f=>({key:f.key,family:f.family,title:f.title,version:f.version,
          source:f.source,verifiedOn:f.verifiedOn,evidence:f.effectiveBasis,confidence:f.confidence,
          stale:f.stale,lifecycle:f.lifecycle})),
        // These are site-facing checks. AgentCart's own deployment launch gate is intentionally
        // separate and cannot be inferred from a public standards response.
        discoveryPaths:DISCOVERY_PATHS,
        note:"AgentCart evaluates business readiness across five categories and agent standards across discovery, content, interaction, payment and catalogue protocols.",
        categories:["business","catalog","policies","access","actions"],
        standardsGroups:["discovery","content","interaction","payment","catalog_protocol"],
        states:["pass","fail","unsupported","unknown","not_available_in_region"],
        stateMeanings:{
          pass:"The check succeeded.",fail:"The check failed and is actionable.",
          unsupported:"Either optional and absent, or not applicable to this kind of business.",
          unknown:"Could not be determined; deliberately not guessed.",
          not_available_in_region:"The capability is not offered in this market. Not a merchant failing."}};
    case "get_public_ai_profile":{
      const slug=String(args.slug||"").toLowerCase();
      const profile=await resolveSlug(env,slug);
      if(!profile)return {error:"No active AgentCart AI profile for that identifier."};
      return await buildProfile(env,profile.shop_domain,slug)
        ||{error:"That business has not synced a profile yet."};
    }
    case "get_supported_protocols":
      return {protocols:PROTOCOLS.map(p=>({id:p.id,label:p.label,supported:p.supported,
        notSupported:p.notSupported})),
        note:"AgentCart implements discovery and read access. It does not process payments or own orders under any protocol."};
    default:return null;
  }
}

const ok=(id:unknown,result:unknown)=>({jsonrpc:"2.0",id,result});
const err=(id:unknown,code:number,message:string)=>({jsonrpc:"2.0",id,error:{code,message}});

const PUBLIC_IDENTITY={name:"agentcart",version:"1.1.0",
  instructions:"Read-only Agent Ready scanning, standards, protocol and public business-profile tools."};

export async function handlePublicMcp(env:Env,body:any,ctx:McpRequestContext={}){
  const id=body?.id??null;
  if(body?.jsonrpc!=="2.0")return err(id,-32600,"Expected a JSON-RPC 2.0 request.");
  const method=String(body?.method||"");
  const era=requestEra(body);
  const versionError=protocolError(id,body,ctx);
  if(versionError)return versionError;
  if(method==="server/discover")return ok(id,discoverResult(PUBLIC_IDENTITY));
  if(method==="initialize")return ok(id,legacyInitialize(body,PUBLIC_IDENTITY));
  if(method==="notifications/initialized")return null;
  if(method==="ping")return ok(id,{});
  if(method==="tools/list")return ok(id,listResult(PUBLIC_TOOLS,era));
  if(method==="tools/call"){
    const name=String(body?.params?.name||"");
    if(!PUBLIC_TOOLS.some(t=>t.name===name))return err(id,-32602,`Unknown tool: ${name}`);
    try{
      const result=await callPublicTool(env,name,(body?.params?.arguments||{}) as Record<string,unknown>);
      return ok(id,toolResult(result,era));
    }catch(e){
      return ok(id,toolResult({error:e instanceof Error?e.message:"Tool failed."},era,true));
    }
  }
  return err(id,-32601,`Unsupported method: ${method}`);
}

/** AgentCart's own agents.md, so it is an example of the thing it asks merchants to be. */
export function agentCartAgentsMd(appUrl:string){
  const base=appUrl.replace(/\/$/,"");
  return [
    "# AgentCart","",
    "AgentCart checks whether AI assistants can understand and act with a business, helps fix what is in the way,",
    "and reports whether AI produced customers.","",
    "## What you can do here","",
    `- Scan any public business website: POST ${base}/api/scan with {\"url\":\"example.com\"}`,
    `- Call AgentCart as an MCP server (read-only): POST ${base}/api/mcp`,
    `- Read a connected merchant's published profile: GET ${base}/api/ai/{slug}/profile`,
    `- List supported protocols: GET ${base}/api/protocols`,"",
    "## Tools","",
    ...PUBLIC_TOOLS.map(t=>`- \`${t.name}\` — ${t.description}`),"",
    "## What you cannot do here","",
    "- Change anything on a merchant's store. Public tools are read-only.",
    "- Read private merchant data. Only published profiles are public.",
    "- Complete a purchase. AgentCart never transacts on a customer's behalf.","",
    "## Limits","",
    "- Scanning is rate limited per client and refuses private-network addresses.",
    "- Scans are synchronous. There is no background job to poll.",""
  ].join("\n");
}
