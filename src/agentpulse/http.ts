import type {PulseRun,PulseStep,PulseTarget} from "./types";

const TIMEOUT_MS=10_000;
const MAX_RESPONSE_BYTES=512_000;
type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;

function id(){return typeof crypto.randomUUID==="function"?crypto.randomUUID():`${Date.now()}-${Math.random()}`;}
function add(steps:PulseStep[],step:PulseStep["step"],status:PulseStep["status"],latencyMs:number,detail:string){
  steps.push({step,status,latencyMs,detail});
}
async function limited(res:Response){
  if(Number(res.headers.get("content-length")||0)>MAX_RESPONSE_BYTES)throw new Error("response_too_large");
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(bytes.byteLength>MAX_RESPONSE_BYTES)throw new Error("response_too_large");
  return new TextDecoder().decode(bytes);
}
function stableShape(value:unknown):unknown{
  if(Array.isArray(value))return value.slice(0,3).map(stableShape);
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>)
    .sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stableShape(v)]));
  return typeof value;
}
async function fingerprint(value:unknown){
  const bytes=new TextEncoder().encode(JSON.stringify(stableShape(value)));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function safeWebUrl(raw:unknown){
  if(typeof raw!=="string")return false;
  try{return new URL(raw).protocol==="https:";}catch{return false;}
}

/** A read-only HTTP journey. It performs one GET, refuses redirects, never submits a form and
 * validates only capability shape. The response body is discarded after the run. */
export async function runHttpSynthetic(target:PulseTarget,fetcher:Fetcher=fetch,clock=()=>Date.now()):Promise<PulseRun>{
  const startedMs=clock(),steps:PulseStep[]=[];
  let errorCategory:string|null=null,errorCode:string|null=null,shape:string|null=null;
  const finish=(status:PulseRun["status"],note:string):PulseRun=>{
    const completedMs=clock();
    add(steps,"evidence",status==="pass"?"pass":status==="unsupported"?"unsupported":status==="blocked"?"blocked":"fail",0,
      "Stored status, timings and a structural fingerprint only; the response body was discarded.");
    return {id:id(),targetId:target.id,shop:target.shop_domain,protocol:"http",journey:target.journey,
      status,era:null,protocolVersion:null,startedMs,completedMs,latencyMs:Math.max(0,completedMs-startedMs),
      errorCategory,errorCode,schemaFingerprint:shape,toolCount:null,
      evidence:{versionBasis:"unknown",toolsList:{paginated:false,ttlMs:null,cacheScope:null},
        advertisedExtensions:[],authorization:[],note},steps};
  };
  let url:URL;
  try{url=new URL(target.endpoint);}
  catch{errorCategory="configuration";errorCode="invalid_url";add(steps,"connect","fail",0,"The target URL is invalid.");
    add(steps,"discover","blocked",0,"No response was read.");add(steps,"authenticate","unknown",0,"Authentication was not reached.");
    add(steps,"invoke","blocked",0,"No request was made.");add(steps,"validate","blocked",0,"Nothing to validate.");
    return finish("fail","The journey configuration is invalid.");}
  if(url.protocol!=="https:"&&url.hostname!=="localhost"){
    errorCategory="safety";errorCode="https_required";add(steps,"connect","blocked",0,"Only HTTPS synthetic targets are allowed.");
    add(steps,"discover","blocked",0,"No response was read.");add(steps,"authenticate","unknown",0,"Authentication was not reached.");
    add(steps,"invoke","blocked",0,"No request was made.");add(steps,"validate","blocked",0,"Nothing to validate.");
    return finish("blocked","The read-only monitor refused an insecure endpoint.");
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS),started=clock();
  let res:Response,text="",body:any;
  try{
    res=await fetcher(url,{method:"GET",headers:{accept:"application/json"},redirect:"error",signal:controller.signal});
    add(steps,"connect",res.ok?"pass":res.status===401||res.status===403?"blocked":"fail",Math.max(0,clock()-started),`HTTP ${res.status}.`);
    if(res.status===401||res.status===403){errorCategory="authentication";errorCode=`http_${res.status}`;
      add(steps,"discover","blocked",0,"The endpoint requires authentication.");
      add(steps,"authenticate",target.auth_mode==="public"?"fail":"blocked",0,target.auth_mode==="public"?"A public target refused access.":"No credential is persisted for synthetic runs.");
      add(steps,"invoke","blocked",0,"No capability was read.");add(steps,"validate","blocked",0,"Nothing to validate.");
      return finish(target.auth_mode==="public"?"fail":"blocked","Authentication prevented this journey.");}
    if(!res.ok){errorCategory="http";errorCode=`http_${res.status}`;add(steps,"discover","fail",0,"The endpoint did not return a successful response.");
      add(steps,"authenticate","unknown",0,"No authentication conclusion was possible.");add(steps,"invoke","blocked",0,"No capability was read.");
      add(steps,"validate","blocked",0,"Nothing to validate.");return finish("fail","The endpoint was reachable but returned an error.");}
    text=await limited(res);body=JSON.parse(text);shape=await fingerprint(body);
  }catch(e){errorCategory=e instanceof DOMException&&e.name==="AbortError"?"timeout":"transport";
    errorCode=e instanceof Error?e.message:"fetch_failed";add(steps,"connect","fail",Math.max(0,clock()-started),"The safe GET did not complete.");
    add(steps,"discover","fail",0,"No valid JSON capability response was available.");add(steps,"authenticate","unknown",0,"Authentication was not established.");
    add(steps,"invoke","blocked",0,"No capability was read.");add(steps,"validate","blocked",0,"Nothing to validate.");
    return finish("fail","The response was unavailable or invalid JSON.");
  }finally{clearTimeout(timer);}
  add(steps,"discover","pass",0,"A JSON capability response was discovered.");
  add(steps,"authenticate","pass",0,"The configured public read completed without credentials.");
  add(steps,"invoke","pass",0,"One bounded, read-only GET was completed; no handoff was followed.");

  let supported=true,valid=true,detail="";
  if(target.journey==="discovery"){
    valid=!!body?.business&&typeof body?.schemaVersion==="string";detail="Business profile and schema version are present.";
  }else if(target.journey==="price_availability"){
    const items=Array.isArray(body?.items)?body.items:[];supported=items.length>0;
    valid=!supported||items.every((x:any)=>x&&typeof x.available==="boolean"&&x.price&&"min" in x.price);
    detail=supported?"Catalogue entries expose price and availability together.":"No catalogue is published for this business.";
  }else if(target.journey==="policies"){
    const policies=Array.isArray(body?.policies)?body.policies:[];supported=policies.length>0;
    valid=!supported||policies.every((x:any)=>typeof x.type==="string"&&typeof x.url==="string");
    detail=supported?"Published policies have type and source URL.":"No policies are published for this business.";
  }else{
    const actions=Array.isArray(body?.actions)?body.actions:[];
    const types=target.journey==="quote_contact"?["request_quote","contact_by_email","contact_by_phone"]:
      target.journey==="booking_handoff"?["book_appointment","reserve"]:["checkout_handoff","view_product","browse_catalog"];
    const action=actions.find((a:any)=>a?.supported===true&&types.includes(String(a.type)));
    supported=!!action;
    valid=!action||(target.journey==="quote_contact"?/^(https:|mailto:|tel:)/.test(String(action.url||"")):safeWebUrl(action.url));
    detail=action?`A supported ${action.type} handoff was validated without opening it.`:`This business does not advertise a ${target.journey.replace(/_/g," ")} capability.`;
  }
  if(!valid){errorCategory="validation";errorCode="invalid_capability_shape";add(steps,"validate","fail",0,detail);return finish("fail",detail);}
  if(!supported){errorCategory="capability";errorCode="not_advertised";add(steps,"validate","unsupported",0,detail);return finish("unsupported",detail);}
  add(steps,"validate","pass",0,detail);
  return finish("pass","This safe synthetic journey succeeded at the recorded time; it is observed evidence, not an SLA or a completed transaction.");
}
