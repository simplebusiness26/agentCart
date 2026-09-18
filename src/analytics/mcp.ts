import type {Env} from "../types";
import {discoverResult,legacyInitialize,listResult,protocolError,READ_ONLY_ANNOTATIONS,requestEra,toolResult,type McpRequestContext} from "../mcp/compat";
import {analyticsReport} from "./index";
import {listGrowthOpportunities} from "../growth";

const TOOLS=[
  {name:"get_ai_analytics",description:"Get the authenticated merchant's evidence-labelled AI visibility, fanout, source, crawler, shopping and action analytics.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS},
  {name:"get_growth_opportunities",description:"Get the authenticated merchant's ranked SEO/GEO, prompt, fanout and customer-question opportunities.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:READ_ONLY_ANNOTATIONS}
] as const;
const identity={name:"agentcart-merchant-analytics",version:"1.0.0",instructions:"Authenticated, read-only merchant analytics. Evidence classes remain separate."};
const ok=(id:unknown,result:unknown)=>({jsonrpc:"2.0",id,result});
const err=(id:unknown,code:number,message:string)=>({jsonrpc:"2.0",id,error:{code,message}});

export async function handleAnalyticsMcp(env:Env,shop:string,body:any,ctx:McpRequestContext={}){
  const id=body?.id??null;if(body?.jsonrpc!=="2.0")return err(id,-32600,"Expected a JSON-RPC 2.0 request.");
  const versionError=protocolError(id,body,ctx);if(versionError)return versionError;
  const method=String(body?.method||""),era=requestEra(body);
  if(method==="server/discover")return ok(id,discoverResult(identity));
  if(method==="initialize")return ok(id,legacyInitialize(body,identity));
  if(method==="notifications/initialized")return null;
  if(method==="ping")return ok(id,{});
  if(method==="tools/list")return ok(id,listResult(TOOLS,era));
  if(method==="tools/call"){
    const name=String(body?.params?.name||"");
    if(name==="get_ai_analytics")return ok(id,toolResult(await analyticsReport(env,shop),era));
    if(name==="get_growth_opportunities")return ok(id,toolResult({opportunities:await listGrowthOpportunities(env,shop)},era));
    return err(id,-32602,`Unknown tool: ${name}`);
  }
  return err(id,-32601,`Unsupported method: ${method}`);
}
