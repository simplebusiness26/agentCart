import {assertScannableUrl} from "../scanner";

export type ProbeState="pass"|"fail"|"unknown"|"not_applicable";
export interface EmergingProbe {key:string;label:string;state:ProbeState;url?:string;status?:number;detail:string;evidence:string;}

const JSON_PROBES=[
  ["api_catalog","API Catalog","/.well-known/api-catalog"],
  ["openid_configuration","OpenID Connect metadata","/.well-known/openid-configuration"],
  ["oauth_authorization_server","OAuth authorization metadata","/.well-known/oauth-authorization-server"],
  ["oauth_protected_resource","OAuth Protected Resource Metadata","/.well-known/oauth-protected-resource"],
  ["mcp_server_card","MCP Server Card","/.well-known/mcp.json"],
  ["a2a_agent_card","A2A Agent Card","/.well-known/agent-card.json"],
  ["agent_skills","Agent Skills index","/.well-known/skills.json"],
  ["acp","ACP discovery","/.well-known/acp"],
  ["ap2","AP2 discovery","/.well-known/ap2"],
  ["x402","x402 discovery","/.well-known/x402"],
  ["mpp","MPP discovery","/.well-known/mpp"]
] as const;

const TEXT_PROBES=[
  ["auth_md","Auth.md","/auth.md"],
  ["content_signals","Content Signals","/.well-known/content-signals"],
  ["web_bot_auth","Web Bot Auth/JWKS","/.well-known/web-bot-auth"]
] as const;

async function boundedFetch(url:string,init:RequestInit,timeoutMs=2500){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  // Redirects are deliberately not followed: a public site must not be able to turn this
  // authenticated scanner route into a second request to a private or link-local target.
  try{return await fetch(url,{...init,signal:controller.signal,redirect:"manual"});}
  finally{clearTimeout(timer);}
}
function result(key:string,label:string,url:string,res:Response,valid:boolean,detail:string):EmergingProbe{
  return {key,label,url,status:res.status,state:res.ok&&valid?"pass":res.ok?"fail":"unknown",detail,evidence:`HTTP ${res.status}; ${res.headers.get("content-type")||"unknown content type"}`};
}

export async function probeEmergingStandards(input:string):Promise<EmergingProbe[]>{
  const root=assertScannableUrl(input),ua={"User-Agent":"AgentCartReadinessScanner/3.0"},out:EmergingProbe[]=[];
  const jsonResults=await Promise.all(JSON_PROBES.map(async ([key,label,path])=>{
    const url=new URL(path,root.origin).toString();
    try{const res=await boundedFetch(url,{headers:ua});const type=(res.headers.get("content-type")||"").toLowerCase();const body=res.ok?(await res.text()).slice(0,50000):"";let valid=false;
      if(res.ok&&!type.includes("text/html")){try{const parsed=JSON.parse(body);valid=!!parsed&&typeof parsed==="object";}catch{valid=false;}}
      return result(key,label,url,res,valid,valid?"A machine-readable declaration was found.":res.ok?"The path responded but did not contain valid JSON.":"No usable declaration was found.");
    }catch(e){return {key,label,url,state:"unknown",detail:e instanceof Error?e.message:"Probe failed.",evidence:"No response"} as EmergingProbe;}
  }));
  const textResults=await Promise.all(TEXT_PROBES.map(async ([key,label,path])=>{
    const url=new URL(path,root.origin).toString();
    try{const res=await boundedFetch(url,{headers:ua});const type=(res.headers.get("content-type")||"").toLowerCase();const body=res.ok?(await res.text()).slice(0,50000):"";const valid=res.ok&&!type.includes("text/html")&&body.trim().length>20;
      return result(key,label,url,res,valid,valid?"A non-HTML declaration was found.":"No valid declaration was found.");
    }catch(e){return {key,label,url,state:"unknown",detail:e instanceof Error?e.message:"Probe failed.",evidence:"No response"} as EmergingProbe;}
  }));
  out.push(...jsonResults,...textResults);
  try{
    const res=await boundedFetch(root.toString(),{headers:{...ua,Accept:"text/markdown"}});const type=(res.headers.get("content-type")||"").toLowerCase();const body=res.ok?(await res.text()).slice(0,50000):"";
    out.push(result("markdown_negotiation","Markdown content negotiation",root.toString(),res,type.includes("markdown")&&body.trim().length>20,
      type.includes("markdown")?"The canonical page returned Markdown.":"The canonical page did not negotiate Markdown."));
    const links=res.headers.get("link")||"";
    out.push({key:"link_headers",label:"Useful Link headers",url:root.toString(),status:res.status,state:links?"pass":"fail",detail:links?"One or more Link relations were advertised.":"No Link relations were advertised.",evidence:links.slice(0,1000)||"No Link header"});
  }catch(e){out.push({key:"markdown_negotiation",label:"Markdown content negotiation",state:"unknown",detail:"The canonical page could not be tested.",evidence:e instanceof Error?e.message:"Probe failed."});}
  out.push({key:"webmcp_runtime",label:"WebMCP runtime",state:"unknown",detail:"A static Worker fetch cannot prove the browser document.modelContext WebMCP runtime. Run a compatible browser adapter to determine this capability.",evidence:"Runtime evidence required"});
  out.push({key:"dns_aid",label:"DNS-AID",state:"unknown",detail:"DNS-AID remains version-gated until an authoritative current registry entry is configured.",evidence:"Versioned DNS adapter required"});
  return out;
}
