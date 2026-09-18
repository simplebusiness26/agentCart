import {assessAuthorizationReadiness} from "../standards/authorization";
import {CURRENT_MCP_VERSION,LEGACY_MCP_VERSIONS} from "../standards/registry";
import type {PulseRun,PulseStep,PulseTarget} from "./types";

const TIMEOUT_MS=10_000;
const MAX_PAGES=10;
const MAX_RESPONSE_BYTES=512_000;

type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

const nowId=()=>typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random()}`;

function stable(value:unknown):string{
  if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function fingerprint(value:unknown){
  const bytes=new TextEncoder().encode(stable(value));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function modernMeta(){return {
  "io.modelcontextprotocol/protocolVersion":CURRENT_MCP_VERSION,
  "io.modelcontextprotocol/clientInfo":{name:"AgentPulse",version:"1.0.0"},
  "io.modelcontextprotocol/clientCapabilities":{}
};}

async function readLimited(res:Response){
  if(Number(res.headers.get("content-length")||0)>MAX_RESPONSE_BYTES)
    throw new Error("The MCP response exceeded the safety size limit.");
  if(!res.body)return "";
  const reader=res.body.getReader();
  const decoder=new TextDecoder();
  let total=0,text="";
  while(true){
    const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>MAX_RESPONSE_BYTES){await reader.cancel();throw new Error("The MCP response exceeded the safety size limit.");}
    text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
}

async function parseRpc(res:Response){
  const text=await readLimited(res);
  const type=(res.headers.get("content-type")||"").toLowerCase();
  if(type.includes("text/event-stream")){
    const messages=text.split(/\r?\n\r?\n/).flatMap(block=>block.split(/\r?\n/)
      .filter(line=>line.startsWith("data:"))).map(line=>line.slice(5).trim()).filter(Boolean);
    for(let i=messages.length-1;i>=0;i--){try{return {body:JSON.parse(messages[i]),type:"sse",text};}catch{/* next */}}
    throw new Error("The MCP server returned SSE without a JSON-RPC response.");
  }
  try{return {body:JSON.parse(text),type:"json",text};}
  catch{throw new Error("The MCP server did not return valid JSON-RPC.");}
}

async function rpc(fetcher:Fetcher,endpoint:string,body:Record<string,unknown>,modern:boolean,
  extraHeaders:Record<string,string>={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  const started=Date.now();
  try{
    const headers:Record<string,string>={"content-type":"application/json",
      accept:"application/json, text/event-stream",...extraHeaders};
    if(modern){
      headers["MCP-Protocol-Version"]=CURRENT_MCP_VERSION;
      headers["Mcp-Method"]=String(body.method||"");
      const name=(body as any)?.params?.name??(body as any)?.params?.uri;
      if(name!==undefined)headers["Mcp-Name"]=encodeHeaderValue(String(name));
    }
    const res=await fetcher(endpoint,{method:"POST",headers,body:JSON.stringify(body),
      signal:controller.signal,redirect:"error"});
    const latency=Date.now()-started;
    if(res.status===401)return {res,latency,body:null as any,type:"json",text:""};
    const parsed=await parseRpc(res);
    return {res,latency,...parsed};
  }finally{clearTimeout(timer);}
}

function encodeHeaderValue(value:string){
  const plain=/^[\x20-\x7e]+$/.test(value)&&value.trim()===value&&
    !(value.startsWith("=?base64?")&&value.endsWith("?="));
  if(plain)return value;
  const bytes=new TextEncoder().encode(value);
  let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
  return `=?base64?${btoa(binary)}?=`;
}

function toolParameterHeaders(schema:any,args:Record<string,unknown>){
  const headers:Record<string,string>={};
  const names=new Set<string>();
  let nodes=0;
  const walk=(node:any,value:any,reachable:boolean,depth:number)=>{
    if(!node||typeof node!=="object"||++nodes>1000||depth>20)throw new Error("Tool schema exceeds safety limits.");
    if("x-mcp-header" in node){
      const name=String(node["x-mcp-header"]||"");
      const key=name.toLowerCase();
      if(!reachable||!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)||names.has(key)||
        !["string","integer","boolean"].includes(String(node.type)))
        throw new Error("Tool schema contains an invalid x-mcp-header annotation.");
      names.add(key);
      if(value!==undefined&&value!==null)headers[`Mcp-Param-${name}`]=encodeHeaderValue(String(value));
    }
    for(const [childKey,child] of Object.entries(node)){
      if(childKey==="properties"&&child&&typeof child==="object")
        for(const [property,definition] of Object.entries(child as Record<string,unknown>))
          walk(definition,value&&typeof value==="object"?(value as any)[property]:undefined,reachable,depth+1);
      else if(child&&typeof child==="object"&&childKey!=="properties"){
        if(Array.isArray(child)){
          for(const entry of child)if(entry&&typeof entry==="object")walk(entry,undefined,false,depth+1);
        }else walk(child,undefined,false,depth+1);
      }
    }
  };
  walk(schema,args,true,0);
  return headers;
}

function req(id:number,method:string,params:Record<string,unknown>,modern:boolean){
  return {jsonrpc:"2.0",id,method,params:modern?{...params,_meta:modernMeta()}:params};
}

function validTool(t:any){
  return t&&typeof t.name==="string"&&t.name.length>0&&t.name.length<=128&&
    typeof t.description==="string"&&t.inputSchema&&typeof t.inputSchema==="object"&&!Array.isArray(t.inputSchema);
}

function safeDefaultTool(tools:any[]){
  return tools.find(t=>t?.annotations?.readOnlyHint===true&&
    (!Array.isArray(t?.inputSchema?.required)||t.inputSchema.required.length===0));
}

function step(steps:PulseStep[],name:PulseStep["step"],status:PulseStep["status"],latencyMs:number,detail:string){
  steps.push({step:name,status,latencyMs,detail});
}

export async function runMcpSynthetic(target:PulseTarget,fetcher:Fetcher=fetch,clock=()=>Date.now()):Promise<PulseRun>{
  const startedMs=clock();
  const steps:PulseStep[]=[];
  let era:PulseRun["era"]=null;
  let protocolVersion:string|null=null;
  let errorCategory:string|null=null;
  let errorCode:string|null=null;
  let schemaFingerprint:string|null=null;
  let toolCount:number|null=null;
  let tools:any[]=[];
  let paginated=false;
  let ttlMs:number|null=null;
  let cacheScope:string|null=null;
  let advertisedExtensions:string[]=[];
  let observedCapabilities:string[]=[];
  let observedText="";

  const finish=(status:PulseRun["status"]):PulseRun=>{
    const completedMs=clock();
    const authorization=assessAuthorizationReadiness({authMode:target.auth_mode,tools,
      observedText,credentialsSupplied:false});
    step(steps,"evidence",status==="pass"?"pass":status==="blocked"?"blocked":"fail",0,
      "Stored status, timings, error category and schema fingerprint only; no tool result, credential or customer data was retained.");
    return {id:nowId(),targetId:target.id,shop:target.shop_domain,protocol:"mcp",journey:target.journey,
      status,era,protocolVersion,startedMs,completedMs,latencyMs:Math.max(0,completedMs-startedMs),
      errorCategory,errorCode,schemaFingerprint,toolCount,
      evidence:{versionBasis:protocolVersion?"verified":"unknown",
        toolsList:{paginated,ttlMs,cacheScope},advertisedExtensions,capabilities:observedCapabilities,authorization,
        note:"A successful synthetic run proves this configured journey worked at this time. It is not an SLA and does not prove every client or tool works."},steps};
  };

  let discover;
  try{
    discover=await rpc(fetcher,target.endpoint,req(1,"server/discover",{},true),true);
    observedText+=discover.text;
  }catch(e){
    errorCategory=e instanceof DOMException&&e.name==="AbortError"?"timeout":"transport";
    errorCode=e instanceof Error?e.name:"fetch_failed";
    step(steps,"connect","fail",Math.max(0,clock()-startedMs),"Could not complete an HTTP exchange with the MCP endpoint.");
    step(steps,"discover","fail",0,"No protocol evidence was available.");
    step(steps,"authenticate","unknown",0,"Authentication was not reached.");
    step(steps,"invoke","blocked",0,"No tool was invoked.");
    step(steps,"validate","blocked",0,"No result was available to validate.");
    return finish("fail");
  }

  step(steps,"connect",discover.res.ok?"pass":discover.res.status===401?"blocked":"fail",discover.latency,
    `HTTP ${discover.res.status}; response transport ${discover.type}.`);
  if(discover.res.status===401){
    errorCategory="authentication";errorCode="http_401";
    step(steps,"discover","blocked",0,"The endpoint requires authorization before capabilities can be discovered.");
    step(steps,"authenticate",target.auth_mode==="public"?"fail":"blocked",0,
      target.auth_mode==="public"?"A target declared public returned 401.":"No credential is stored for this synthetic target.");
    step(steps,"invoke","blocked",0,"No tool was invoked.");
    step(steps,"validate","blocked",0,"No result was available to validate.");
    return finish(target.auth_mode==="public"?"fail":"blocked");
  }

  const modernError=discover.body?.error;
  if(discover.res.ok&&discover.body?.result?.supportedVersions){
    era="modern";
    const supported=discover.body.result.supportedVersions;
    protocolVersion=Array.isArray(supported)&&supported.includes(CURRENT_MCP_VERSION)?CURRENT_MCP_VERSION:null;
    advertisedExtensions=Object.keys(discover.body.result.capabilities?.extensions||{});
    if(!protocolVersion){
      errorCategory="protocol";errorCode="no_mutual_version";
      step(steps,"discover","fail",discover.latency,"The server did not advertise a mutually supported modern version.");
      step(steps,"authenticate","unknown",0,"Authentication was not established.");
      step(steps,"invoke","blocked",0,"No tool was invoked.");
      step(steps,"validate","blocked",0,"No result was available to validate.");
      return finish("fail");
    }
    step(steps,"discover","pass",discover.latency,
      `Modern server advertised ${supported.length} version(s) and ${advertisedExtensions.length} extension(s).`);
  }else if(modernError?.code===-32022&&Array.isArray(modernError?.data?.supported)){
    const mutual=modernError.data.supported.find((v:string)=>v===CURRENT_MCP_VERSION);
    if(mutual){era="modern";protocolVersion=mutual;step(steps,"discover","pass",discover.latency,"Modern version negotiated from an explicit version error.");}
    else{
      errorCategory="protocol";errorCode="no_mutual_version";
      step(steps,"discover","fail",discover.latency,"The server explicitly reported no mutually supported protocol version.");
      step(steps,"authenticate","unknown",0,"Authentication was not established.");
      step(steps,"invoke","blocked",0,"No tool was invoked.");step(steps,"validate","blocked",0,"No result was available to validate.");
      return finish("fail");
    }
  }else{
    // Non-modern error: try the most recent legacy initialize flow. This is an era fallback,
    // not a session assumption for modern servers.
    const init=await rpc(fetcher,target.endpoint,{jsonrpc:"2.0",id:2,method:"initialize",params:{
      protocolVersion:LEGACY_MCP_VERSIONS[0],capabilities:{},clientInfo:{name:"AgentPulse",version:"1.0.0"}}},false);
    observedText+=init.text;
    if(!init.res.ok||!init.body?.result?.protocolVersion){
      errorCategory="protocol";errorCode=String(init.body?.error?.code||`http_${init.res.status}`);
      step(steps,"discover","fail",discover.latency+init.latency,"Neither modern discovery nor legacy initialization succeeded.");
      step(steps,"authenticate","unknown",0,"Authentication was not established.");
      step(steps,"invoke","blocked",0,"No tool was invoked.");step(steps,"validate","blocked",0,"No result was available to validate.");
      return finish("fail");
    }
    era="legacy";protocolVersion=String(init.body.result.protocolVersion);
    advertisedExtensions=Object.keys(init.body.result.capabilities?.extensions||{});
    step(steps,"discover","pass",discover.latency+init.latency,`Legacy initialize flow negotiated ${protocolVersion}.`);
  }

  step(steps,"authenticate",target.auth_mode==="public"?"unsupported":"unknown",0,
    target.auth_mode==="public"?"This is an explicitly public read-only journey; no credential was needed."
      :"The endpoint responded, but this run supplied no stored credential.");

  const modern=era==="modern";
  let cursor:unknown=undefined;
  for(let page=0;page<MAX_PAGES;page++){
    const listed=await rpc(fetcher,target.endpoint,req(10+page,"tools/list",cursor?{cursor}:{},modern),modern);
    observedText+=listed.text;
    if(!listed.res.ok||listed.body?.error||!Array.isArray(listed.body?.result?.tools)){
      errorCategory="tool_discovery";errorCode=String(listed.body?.error?.code||`http_${listed.res.status}`);
      step(steps,"invoke","blocked",listed.latency,"tools/list failed, so no safe tool could be selected.");
      step(steps,"validate","fail",0,"Tool discovery response did not match the required shape.");
      return finish("fail");
    }
    const result=listed.body.result;
    if(result.ttlMs!==undefined)ttlMs=Number(result.ttlMs);
    if(result.cacheScope!==undefined)cacheScope=String(result.cacheScope);
    if(!result.tools.every(validTool)){
      errorCategory="schema";errorCode="invalid_tool_definition";
      tools.push(...result.tools.filter(validTool));
      step(steps,"invoke","blocked",listed.latency,"At least one advertised tool had an invalid name, description or input schema.");
      step(steps,"validate","fail",0,"Invalid tool definitions were rejected.");
      return finish("fail");
    }
    try{for(const tool of result.tools)toolParameterHeaders(tool.inputSchema,{});}
    catch{
      errorCategory="schema";errorCode="invalid_header_annotation";
      tools.push(...result.tools);
      step(steps,"invoke","blocked",listed.latency,"At least one advertised tool had an unsafe x-mcp-header annotation.");
      step(steps,"validate","fail",0,"Invalid tool header annotations were rejected before invocation.");
      return finish("fail");
    }
    tools.push(...result.tools);
    cursor=result.nextCursor;
    if(!cursor)break;
    paginated=true;
    if(page===MAX_PAGES-1){errorCategory="pagination";errorCode="page_limit";
      step(steps,"invoke","blocked",listed.latency,"Tool pagination exceeded the ten-page safety limit.");
      step(steps,"validate","fail",0,"Tool list could not be bounded safely.");return finish("fail");}
  }
  toolCount=tools.length;
  const capabilityText=tools.map(t=>`${t.name} ${t.description}`).join(" ").toLowerCase();
  observedCapabilities=[
    /search|query/.test(capabilityText)?"search":null,
    /facet|filter/.test(capabilityText)?"facets":null,
    /recommend|related|frequently/.test(capabilityText)?"recommendations":null
  ].filter((v):v is string=>!!v);
  schemaFingerprint=await fingerprint(tools.map(t=>({name:t.name,description:t.description,
    inputSchema:t.inputSchema,outputSchema:t.outputSchema,annotations:t.annotations})));

  const configured=target.tool_name?tools.find(t=>t.name===target.tool_name):safeDefaultTool(tools);
  if(!configured){
    errorCategory="safe_invocation";errorCode=target.tool_name?"configured_tool_missing":"no_safe_tool";
    step(steps,"invoke","blocked",0,target.tool_name?"The configured synthetic tool was not advertised."
      :"No explicitly read-only, zero-input tool was available for a safe synthetic call.");
    step(steps,"validate","blocked",0,"No tool result was available to validate.");
    return finish("blocked");
  }
  if(configured.annotations?.readOnlyHint!==true){
    errorCategory="safe_invocation";errorCode="tool_not_read_only";
    step(steps,"invoke","blocked",0,"The configured tool was not explicitly annotated read-only.");
    step(steps,"validate","blocked",0,"AgentPulse will not invoke a tool that may write.");
    return finish("blocked");
  }

  let args:Record<string,unknown>={};
  try{args=target.tool_arguments_json?JSON.parse(target.tool_arguments_json):{};}
  catch{errorCategory="configuration";errorCode="invalid_arguments_json";
    step(steps,"invoke","blocked",0,"Configured tool arguments are not valid JSON.");
    step(steps,"validate","blocked",0,"No tool result was available to validate.");return finish("blocked");}

  let parameterHeaders:Record<string,string>={};
  try{if(modern)parameterHeaders=toolParameterHeaders(configured.inputSchema,args);}
  catch{
    errorCategory="schema";errorCode="invalid_header_annotation";
    step(steps,"invoke","blocked",0,"The selected tool contains an unsafe HTTP header annotation.");
    step(steps,"validate","fail",0,"Invalid x-mcp-header schema annotation was rejected.");
    return finish("fail");
  }
  const called=await rpc(fetcher,target.endpoint,
    req(100,"tools/call",{name:configured.name,arguments:args},modern),modern,parameterHeaders);
  observedText+=called.text;
  const result=called.body?.result;
  const valid=result&&!called.body?.error&&Array.isArray(result.content)&&result.content.every((c:any)=>
    c&&typeof c.type==="string"&&(c.type!=="text"||typeof c.text==="string"));
  step(steps,"invoke",valid&&!result?.isError?"pass":"fail",called.latency,
    valid?`Safely invoked read-only tool ${configured.name}.`:`Tool ${configured.name} did not return a valid result.`);
  if(!valid||result?.isError){
    errorCategory="invocation";
    errorCode=called.body?.error?.code!==undefined?String(called.body.error.code)
      :result?.isError?"tool_error":"invalid_result";
    step(steps,"validate","fail",0,"The tool result failed structural validation.");
    return finish("fail");
  }
  if(modern&&result.resultType!=="complete"){
    errorCategory="response_validation";errorCode="missing_result_type";
    step(steps,"validate","fail",0,"Modern tool result did not declare resultType=complete.");
    return finish("fail");
  }
  step(steps,"validate","pass",0,`Validated ${toolCount} tool definition(s), the selected result shape and schema fingerprint.`);
  return finish("pass");
}
