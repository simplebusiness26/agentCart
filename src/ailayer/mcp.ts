import type {Env} from "../types";
import {getActions,getBusiness,getItemView,getPolicies,searchCatalogView} from "./service";

// A read-only MCP surface over the same service functions the JSON endpoints use.
// There is no second source of truth here by design: every tool below delegates.
//
// Transport is JSON-RPC 2.0 over HTTP POST, which is what a streamable-HTTP MCP client
// speaks. No tool mutates anything, and none of them can claim an action the service
// layer reports as unsupported.

export const TOOLS=[
  {name:"get_business",description:"Get the business identity, contact details and location.",
   inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"search_catalog",description:"Search the merchant's catalogue by keyword.",
   inputSchema:{type:"object",properties:{query:{type:"string",description:"Keywords to search for."},
     limit:{type:"integer",minimum:1,maximum:50}},required:["query"],additionalProperties:false}},
  {name:"get_item",description:"Get full detail for one catalogue item by id or handle.",
   inputSchema:{type:"object",properties:{id:{type:"string"}},required:["id"],additionalProperties:false}},
  {name:"get_policies",description:"Get the merchant's shipping, returns and other published policies.",
   inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"get_supported_actions",description:"List what can and cannot be done for a customer, with limitations.",
   inputSchema:{type:"object",properties:{},additionalProperties:false}}
] as const;

const ok=(id:unknown,result:unknown)=>({jsonrpc:"2.0",id,result});
const err=(id:unknown,code:number,message:string)=>({jsonrpc:"2.0",id,error:{code,message}});
const content=(data:unknown)=>({content:[{type:"text",text:JSON.stringify(data,null,2)}]});

export async function callTool(env:Env,shop:string,slug:string,name:string,args:Record<string,unknown>){
  switch(name){
    case "get_business":return await getBusiness(env,shop,slug);
    case "search_catalog":{
      const query=String(args.query??"").trim();
      if(!query)return {results:[],note:"No query supplied, so no results were returned."};
      const results=await searchCatalogView(env,shop,query,Number(args.limit)||20);
      return {query,results,note:results.length?undefined:"Nothing in this merchant's catalogue matched."};
    }
    case "get_item":{
      const item=await getItemView(env,shop,String(args.id??""));
      return item||{error:"No item with that id or handle exists in this merchant's catalogue."};
    }
    case "get_policies":{
      const policies=await getPolicies(env,shop);
      return policies.length?policies:{policies:[],note:"This merchant has not published policies through AgentCart."};
    }
    case "get_supported_actions":return await getActions(env,shop);
    default:return null;
  }
}

export async function handleMcp(env:Env,shop:string,slug:string,body:any){
  const id=body?.id??null;
  if(body?.jsonrpc!=="2.0")return err(id,-32600,"Expected a JSON-RPC 2.0 request.");
  const method=String(body?.method||"");

  if(method==="initialize")
    return ok(id,{protocolVersion:"2024-11-05",capabilities:{tools:{}},
      serverInfo:{name:`agentcart-${slug}`,version:"1.0.0"}});
  if(method==="notifications/initialized")return null;
  if(method==="ping")return ok(id,{});
  if(method==="tools/list")return ok(id,{tools:TOOLS});
  if(method==="tools/call"){
    const name=String(body?.params?.name||"");
    const args=(body?.params?.arguments||{}) as Record<string,unknown>;
    if(!TOOLS.some(t=>t.name===name))return err(id,-32602,`Unknown tool: ${name}`);
    try{
      const result=await callTool(env,shop,slug,name,args);
      return ok(id,content(result));
    }catch(e){
      return ok(id,{...content({error:e instanceof Error?e.message:"Tool failed."}),isError:true});
    }
  }
  return err(id,-32601,`Unsupported method: ${method}`);
}
