import type {ReadinessState} from "./registry";

// Agent discovery files. Each is recorded separately -- presence of one says nothing about the
// others -- and no single file gets an outsized share of the score. Presence is useful; it is not
// proof of actionability or transaction readiness.

export type DiscoveryKind="agents_md"|"llms_txt"|"llms_full_txt"|"sitemap"|"ucp_manifest";

export const DISCOVERY_PATHS:Record<DiscoveryKind,string>={
  agents_md:"/agents.md",
  llms_txt:"/llms.txt",
  llms_full_txt:"/llms-full.txt",
  sitemap:"/sitemap.xml",
  ucp_manifest:"/.well-known/ucp"
};

export interface DiscoveryFinding {
  kind:DiscoveryKind;
  path:string;
  state:ReadinessState;
  /** True when the platform supplies this natively, so we must not tell a merchant to create it. */
  platformProvided:boolean;
  bytes:number;
  detail:string;
  evidence:string;
}

// ---------------------------------------------------------------------------
// UCP manifest
// ---------------------------------------------------------------------------

// Shape verified against https://ucp.dev/documentation/core-concepts/ on 2026-09-10.
// Services and capabilities use reverse-domain keys, so nothing here assumes a fixed key list.
export interface UcpSummary {
  valid:boolean;
  version:string|null;
  services:Array<{key:string;transport:string;endpoint:string}>;
  capabilities:string[];
  paymentHandlers:string[];
  hasKeys:boolean;
  problems:string[];
}

export function parseUcpManifest(text:string):UcpSummary{
  const empty:UcpSummary={valid:false,version:null,services:[],capabilities:[],paymentHandlers:[],
    hasKeys:false,problems:[]};
  let doc:any;
  try{doc=JSON.parse(text);}
  catch{return {...empty,problems:["The manifest is not valid JSON."]};}
  if(!doc||typeof doc!=="object")return {...empty,problems:["The manifest is not a JSON object."]};

  const ucp=doc.ucp;
  if(!ucp||typeof ucp!=="object")
    return {...empty,problems:["The manifest has no top-level \"ucp\" object."]};

  const problems:string[]=[];
  const version=typeof ucp.version==="string"?ucp.version:null;
  if(!version)problems.push("\"ucp.version\" is required and is missing.");

  const services=Object.entries(ucp.services&&typeof ucp.services==="object"?ucp.services:{})
    .map(([key,v]:[string,any])=>({key,
      transport:typeof v?.transport==="string"?v.transport:"",
      endpoint:typeof v?.endpoint==="string"?v.endpoint:""}));

  const capabilities=Object.keys(ucp.capabilities&&typeof ucp.capabilities==="object"?ucp.capabilities:{});
  if(!capabilities.length)problems.push("\"ucp.capabilities\" is required and is empty or missing.");
  if(capabilities.length&&!services.length)
    problems.push("Capabilities are declared but \"ucp.services\" is missing, so an agent cannot reach them.");

  const paymentHandlers=Object.keys(ucp.payment_handlers&&typeof ucp.payment_handlers==="object"?ucp.payment_handlers:{});
  const hasKeys=Array.isArray(doc.keys)&&doc.keys.length>0;

  for(const s of services)
    if(s.transport&&!["rest","mcp","a2a","embedded"].includes(s.transport))
      problems.push(`Service "${s.key}" declares an unrecognised transport "${s.transport}".`);

  return {valid:!!version&&capabilities.length>0,version,services,capabilities,paymentHandlers,hasKeys,problems};
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export interface FetchedFile { ok:boolean; body:string; status:number }

/** Platforms that publish some discovery files themselves. AgentCart must recognise these rather
 *  than telling a merchant to hand-create something their platform already supplies -- and must
 *  not claim a platform provides one when that is unverified. */
export const PLATFORM_NATIVE:Record<string,DiscoveryKind[]>={
  shopify:["sitemap"],
  woocommerce:["sitemap"],
  wordpress:["sitemap"]
};

export function assessDiscovery(kind:DiscoveryKind,file:FetchedFile|undefined,platform="other"):DiscoveryFinding{
  const path=DISCOVERY_PATHS[kind];
  const platformProvided=(PLATFORM_NATIVE[platform]||[]).includes(kind);
  const base={kind,path,platformProvided};

  if(!file)
    return {...base,state:"unknown",bytes:0,
      detail:"This file was not checked.",evidence:"no request made"};

  if(!file.ok)
    return {...base,
      // Absent is a real, actionable answer for a discovery file -- but never a hard failure,
      // because none of these files is required for a business to work with an agent.
      state:"unsupported",bytes:0,
      detail:platformProvided
        ? `Not found at ${path}. Your platform normally provides this, so check platform settings rather than creating one by hand.`
        : `No file at ${path}. This is optional, but it gives agents a clearer starting point.`,
      evidence:`HTTP ${file.status} for ${path}`};

  const bytes=file.body.length;
  if(!bytes)
    return {...base,state:"fail",bytes:0,
      detail:`${path} exists but is empty, which tells an agent nothing.`,
      evidence:`HTTP 200, 0 bytes`};

  if(kind==="ucp_manifest"){
    const summary=parseUcpManifest(file.body);
    if(!summary.valid)
      return {...base,state:"fail",bytes,
        detail:`A UCP manifest is published but is not usable: ${summary.problems.join(" ")}`,
        evidence:`HTTP 200, ${bytes} bytes, ${summary.problems.length} problem(s)`};
    return {...base,state:"pass",bytes,
      detail:`UCP ${summary.version} published with ${summary.capabilities.length} capability group(s)`
        +`${summary.paymentHandlers.length?` and ${summary.paymentHandlers.length} payment handler(s)`:""}.`,
      evidence:`capabilities: ${summary.capabilities.slice(0,4).join(", ")||"none"}`};
  }

  return {...base,state:"pass",bytes,
    detail:`${path} is published (${bytes} bytes).`,
    evidence:`HTTP 200, ${bytes} bytes`};
}

export function discoveryScoreContribution(findings:DiscoveryFinding[]){
  // Deliberately small and flat. No single discovery file may dominate: publishing agents.md
  // proves an intention, not that an agent can actually transact with the business.
  const scored=findings.filter(f=>f.kind!=="sitemap");
  if(!scored.length)return {points:0,maxPoints:0};
  const passing=scored.filter(f=>f.state==="pass").length;
  return {points:Math.min(3,passing),maxPoints:3};
}
