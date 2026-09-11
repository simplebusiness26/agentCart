import {decryptToken} from "../shopify";
import {getShop,rateLimit} from "../db";
import type {Env} from "../types";
import {publishAiLayer} from "./hosted";
import {productAiMetafield,productSeoDescription} from "./shopify";
import type {FixContext,FixDefinition,FixPreview,FixStatus} from "./types";

export * from "./types";
export const REGISTRY:FixDefinition[]=[publishAiLayer,productAiMetafield,productSeoDescription];

export function fixByKey(key:string){return REGISTRY.find(f=>f.key===key)||null;}
export function fixesForPlatform(platform:string){
  return REGISTRY.filter(f=>f.platform===platform||f.platform==="any");
}

function fixId(nowMs:number){
  const rand=new Uint8Array(6);crypto.getRandomValues(rand);
  return `fix_${nowMs.toString(36)}_${Array.from(rand,b=>b.toString(16).padStart(2,"0")).join("")}`;
}

export async function contextFor(env:Env,shop:string):Promise<FixContext>{
  const row=await getShop(env,shop);
  if(!row)throw new Error("That store is not connected.");
  return {env,shop,token:await decryptToken(row.encrypted_access_token,env.TOKEN_ENCRYPTION_KEY),
    grantedScopes:(row.granted_scopes||"").split(",").map(s=>s.trim()).filter(Boolean)};
}

export function missingScopes(def:FixDefinition,granted:string[]){
  return def.requiredScopes.filter(s=>!granted.includes(s));
}

async function setStatus(env:Env,id:string,status:FixStatus,fields:Record<string,unknown>={}){
  const cols=Object.keys(fields);
  const sql=`UPDATE fixes SET status=?${cols.length?","+cols.map(c=>`${c}=?`).join(","):""} WHERE id=?`;
  await env.DB.prepare(sql).bind(status,...cols.map(c=>fields[c]),id).run();
}

export async function proposeFixes(env:Env,shop:string,platform:string,nowMs=Date.now()){
  const ctx=await contextFor(env,shop);
  const proposed:Array<Record<string,unknown>>=[];
  for(const def of fixesForPlatform(platform)){
    // Withheld, not attempted. Offering a fix the connection cannot perform produces a failure
    // whose only remedy -- reconnect -- asks for the very scopes that are already missing.
    const missing=missingScopes(def,ctx.grantedScopes);
    if(missing.length){
      proposed.push({id:null,key:def.key,title:def.title,fixType:"unavailable",risk:def.risk,
        summary:`AgentCart cannot offer this yet. Your Shopify connection does not grant ${missing.join(", ")}.`,
        needsReauthorization:true});
      continue;
    }
    let previews:FixPreview[]=[];
    try{previews=await def.preview(ctx);}
    catch(e){console.error(`preview failed for ${def.key}`,e);continue;}
    for(const preview of previews){
      const id=fixId(nowMs);
      await env.DB.prepare(`INSERT INTO fixes(id,shop_domain,finding_key,target_id,platform,fix_type,status,risk,
          summary,proposed_change_json,before_json,created_ms)
        VALUES(?,?,?,?,?,?,'proposed',?,?,?,?,?)`)
        .bind(id,shop,def.findingKey,preview.targetId,def.platform,def.fixType,def.risk,
          preview.summary,JSON.stringify({key:def.key,preview}),JSON.stringify(preview.before),nowMs).run();
      proposed.push({id,key:def.key,title:def.title,fixType:def.fixType,risk:def.risk,
        targetTitle:preview.targetTitle,summary:preview.summary,before:preview.before,after:preview.after});
    }
  }
  return proposed;
}

export async function getFix(env:Env,shop:string,id:string){
  return env.DB.prepare("SELECT * FROM fixes WHERE id=? AND shop_domain=?").bind(id,shop)
    .first<Record<string,unknown>>();
}

export async function listFixes(env:Env,shop:string){
  const rows=await env.DB.prepare("SELECT * FROM fixes WHERE shop_domain=? ORDER BY created_ms DESC LIMIT 200")
    .bind(shop).all();
  return rows.results as Array<Record<string,unknown>>;
}

export async function approveFix(env:Env,shop:string,id:string,nowMs=Date.now()){
  const row=await getFix(env,shop,id);
  if(!row)return null;
  if(row.status!=="proposed")return row;
  await setStatus(env,id,"approved",{approved_ms:nowMs});
  return await getFix(env,shop,id);
}

export class ApprovalRequiredError extends Error {
  constructor(){super("This change alters content your customers see, so it needs your approval first.");}
}

// The lifecycle: proposed -> (approved) -> applying -> applied -> verified, or failed
// with a reason. Nothing reaches "verified" on the strength of a successful mutation
// call; verify() independently re-reads the platform.
export async function applyFix(env:Env,shop:string,id:string,nowMs=Date.now()){
  const row=await getFix(env,shop,id);
  if(!row)throw new Error("No such fix.");
  const parsed=JSON.parse(String(row.proposed_change_json||"{}")) as {key:string;preview:FixPreview};
  const def=fixByKey(parsed.key);
  if(!def)throw new Error("That fix is no longer available.");

  if(row.status==="verified"||row.status==="applied")return await getFix(env,shop,id);
  // A change to customer-facing content must be approved explicitly, every time.
  if(def.fixType==="approval_required"&&row.status!=="approved")throw new ApprovalRequiredError();
  if(row.status!=="approved"&&row.status!=="proposed"&&row.status!=="failed")
    throw new Error(`A fix in state ${row.status} cannot be applied.`);

  try{await assertWriteAllowed(env,shop,def,parsed.preview);}
  catch(e){
    if(e instanceof WriteGuardError){
      await setStatus(env,id,"failed",{error:e.message.slice(0,500)});
      return await getFix(env,shop,id);
    }
    throw e;
  }

  await setStatus(env,id,"applying");
  const ctx=await contextFor(env,shop);
  let applied:Record<string,unknown>;
  try{applied=await def.apply(ctx,parsed.preview);}
  catch(e){
    await setStatus(env,id,"failed",{error:(e instanceof Error?e.message:"Apply failed").slice(0,500)});
    return await getFix(env,shop,id);
  }
  await setStatus(env,id,"applied",{applied_ms:nowMs,applied_change_json:JSON.stringify(applied)});

  let check:{verified:boolean;detail:string};
  try{check=await def.verify(ctx,parsed.preview);}
  catch(e){check={verified:false,detail:e instanceof Error?e.message:"Verification failed."};}
  if(check.verified)await setStatus(env,id,"verified",{verified_ms:nowMs,after_json:JSON.stringify(applied),error:null});
  else await setStatus(env,id,"failed",{error:`Applied, but could not be confirmed: ${check.detail}`.slice(0,500)});
  return await getFix(env,shop,id);
}

export class WriteGuardError extends Error {
  constructor(reason:string){super(reason);}
}

// Merchant-write hardening (Phase 11.5). Every write to a merchant's store passes these gates.
// They are cheap; the cost of skipping them is a merchant's live content.
export async function assertWriteAllowed(env:Env,shop:string,def:FixDefinition,preview:FixPreview){
  // 1. The write must target a field the fix declared it would change. A preview that says one
  //    thing and an apply that does another is exactly what approval is supposed to prevent.
  const declared=Object.keys(preview.after||{});
  if(!declared.length)throw new WriteGuardError("This fix declares no change, so there is nothing to apply.");

  // 2. Never overwrite existing merchant content. Fixes fill blanks; they do not replace copy.
  for(const key of declared){
    const before=(preview.before||{})[key];
    if(before!==undefined&&before!==null&&String(before).trim()!==""&&def.fixType!=="hosted_layer")
      throw new WriteGuardError(`This would overwrite content you already wrote in "${key}". AgentCart only fills blanks.`);
  }

  // 3. Writes are rate limited per shop, so a loop cannot rewrite a whole catalogue at speed.
  const gate=await rateLimit(env,"merchant_write",shop,60,60000).catch(()=>({ok:true}));
  if(!gate.ok)throw new WriteGuardError("Too many changes in a short time. AgentCart paused writing to protect your store.");
}

export async function undoFix(env:Env,shop:string,id:string,nowMs=Date.now()){
  const row=await getFix(env,shop,id);
  if(!row)throw new Error("No such fix.");
  if(row.status!=="verified"&&row.status!=="applied")
    throw new Error(`A fix in state ${row.status} has nothing to undo.`);
  const parsed=JSON.parse(String(row.proposed_change_json||"{}")) as {key:string;preview:FixPreview};
  const def=fixByKey(parsed.key);
  if(!def)throw new Error("That fix is no longer available.");
  if(!def.undo)throw new Error(`"${def.title}" cannot be undone automatically. ${def.undoNote||""}`.trim());

  const ctx=await contextFor(env,shop);

  // Undo writes a stored "before" value back. If what is on the platform now is no longer what
  // AgentCart wrote, someone has changed it since, and restoring would silently discard that.
  const current=await def.verify(ctx,parsed.preview);
  if(!current.verified)
    throw new WriteGuardError(`AgentCart cannot confirm its change is still in place, so it will not `
      +`restore an older value over whatever is there now. ${current.detail}`);

  await def.undo(ctx,parsed.preview);

  // A mutation returning success is not proof, for a rollback either.
  const after=await def.verify(ctx,parsed.preview);
  if(after.verified)
    throw new Error(`AgentCart could not confirm the change was reverted, so it has not been marked `
      +`undone. ${after.detail}`);

  await env.DB.prepare("UPDATE fixes SET status='undone',undone_ms=?,undo_json=? WHERE id=? AND shop_domain=?")
    .bind(nowMs,JSON.stringify(parsed.preview.before),id,shop).run();
  return await getFix(env,shop,id);
}

export async function applyAllAutomatic(env:Env,shop:string,nowMs=Date.now()){
  const rows=await listFixes(env,shop);
  const results:Array<Record<string,unknown>>=[];
  for(const row of rows){
    if(row.status!=="proposed")continue;
    if(row.fix_type==="approval_required")continue;
    results.push((await applyFix(env,shop,String(row.id),nowMs))||{});
  }
  return results;
}

// Only fixes that actually reached "verified" may be counted as improvements.
export async function verifiedCount(env:Env,shop:string){
  const row=await env.DB.prepare("SELECT COUNT(*) AS c FROM fixes WHERE shop_domain=? AND status='verified'")
    .bind(shop).first<{c:number}>();
  return Number(row?.c||0);
}
