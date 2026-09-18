import {CURRENT_MCP_VERSION,LEGACY_MCP_VERSIONS} from "../standards/registry";

export type McpEra="modern"|"legacy";

export interface McpRequestContext {
  headerVersion?:string|null;
  methodHeader?:string|null;
  nameHeader?:string|null;
}

export interface McpServerIdentity {
  name:string;
  version:string;
  instructions:string;
}

const metaOf=(body:any)=>body?.params?._meta as Record<string,unknown>|undefined;

export function requestedProtocolVersion(body:any){
  return String(metaOf(body)?.["io.modelcontextprotocol/protocolVersion"]||"");
}

export function requestEra(body:any):McpEra{
  return requestedProtocolVersion(body)||body?.method==="server/discover"?"modern":"legacy";
}

export function protocolError(id:unknown,body:any,ctx:McpRequestContext={}){
  const requested=requestedProtocolVersion(body);
  const header=String(ctx.headerVersion||"");
  const modern=!!requested||!!header||body?.method==="server/discover";
  if(modern&&(!requested||!header||requested!==header))
    return {jsonrpc:"2.0",id,error:{code:-32020,message:"Header mismatch: MCP-Protocol-Version must match request metadata."}};
  if(modern&&String(ctx.methodHeader||"")!==String(body?.method||""))
    return {jsonrpc:"2.0",id,error:{code:-32020,message:"Header mismatch: Mcp-Method must match the JSON-RPC method."}};
  if(modern&&body?.method==="tools/call"&&String(ctx.nameHeader||"")!==String(body?.params?.name||""))
    return {jsonrpc:"2.0",id,error:{code:-32020,message:"Header mismatch: Mcp-Name must match the tool name."}};
  if(requested&&requested!==CURRENT_MCP_VERSION)
    return {jsonrpc:"2.0",id,error:{code:-32022,message:"Unsupported protocol version",
      data:{supported:[CURRENT_MCP_VERSION,...LEGACY_MCP_VERSIONS],requested}}};
  return null;
}

export function mcpHttpStatus(result:any,modern=true){
  if(!modern)return 200;
  const code=Number(result?.error?.code);
  if(code===-32020||code===-32022)return 400;
  if(code===-32601)return 404;
  return 200;
}

export function discoverResult(identity:McpServerIdentity){
  return {
    resultType:"complete",
    supportedVersions:[CURRENT_MCP_VERSION,...LEGACY_MCP_VERSIONS],
    capabilities:{tools:{listChanged:false},extensions:{}},
    _meta:{"io.modelcontextprotocol/serverInfo":{name:identity.name,version:identity.version}},
    instructions:identity.instructions,
    ttlMs:3600000,
    cacheScope:"public"
  };
}

export function legacyInitialize(body:any,identity:McpServerIdentity){
  const requested=String(body?.params?.protocolVersion||"");
  const protocolVersion=(LEGACY_MCP_VERSIONS as readonly string[]).includes(requested)
    ?requested:LEGACY_MCP_VERSIONS[0];
  return {protocolVersion,capabilities:{tools:{listChanged:false}},
    serverInfo:{name:identity.name,version:identity.version},instructions:identity.instructions};
}

export const READ_ONLY_ANNOTATIONS={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} as const;

export function listResult<T>(tools:readonly T[],era:McpEra){
  return era==="modern"
    ?{resultType:"complete",tools,ttlMs:300000,cacheScope:"public"}
    :{tools};
}

export function toolResult(data:unknown,era:McpEra,isError=false){
  return {content:[{type:"text",text:JSON.stringify(data,null,2)}],
    ...(era==="modern"?{resultType:"complete"}:{}),...(isError?{isError:true}:{})};
}
