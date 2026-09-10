import type {Env} from "../types";

// Agents retry. A lost response must never become a second cart, order or applied fix.
//
// The stored request hash matters as much as the key: replaying a key with a DIFFERENT body is a
// client bug (or an attack) and is rejected rather than silently returning someone else's result.

const encoder=new TextEncoder();

export async function hashRequest(body:unknown){
  const digest=await crypto.subtle.digest("SHA-256",encoder.encode(JSON.stringify(body??null)));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}

export type IdempotencyOutcome=
  |{status:"fresh"}
  |{status:"replayed";response:unknown}
  |{status:"in_progress"}
  |{status:"conflict";detail:string};

export const IDEMPOTENCY_TTL_MS=24*60*60*1000;

export async function beginIdempotent(env:Env,shop:string,scope:string,key:string,body:unknown,nowMs=Date.now()):Promise<IdempotencyOutcome>{
  const requestHash=await hashRequest(body);
  const existing=await env.DB.prepare("SELECT * FROM idempotency_keys WHERE key=? AND shop_domain=?")
    .bind(key,shop).first<Record<string,unknown>>();

  if(existing&&Number(existing.expires_ms)>nowMs){
    if(String(existing.request_hash)!==requestHash)
      return {status:"conflict",
        detail:"This idempotency key was already used with a different request body."};
    if(String(existing.status)==="complete")
      return {status:"replayed",response:JSON.parse(String(existing.response_json||"null"))};
    return {status:"in_progress"};
  }

  await env.DB.prepare(`INSERT INTO idempotency_keys(key,shop_domain,scope,request_hash,status,created_ms,expires_ms)
    VALUES(?,?,?,?,'in_progress',?,?)
    ON CONFLICT(key) DO UPDATE SET request_hash=excluded.request_hash,scope=excluded.scope,
      status='in_progress',response_json=NULL,created_ms=excluded.created_ms,expires_ms=excluded.expires_ms`)
    .bind(key,shop,scope,requestHash,nowMs,nowMs+IDEMPOTENCY_TTL_MS).run();
  await env.DB.prepare("DELETE FROM idempotency_keys WHERE expires_ms<?").bind(nowMs).run().catch(()=>{});
  return {status:"fresh"};
}

export async function completeIdempotent(env:Env,shop:string,key:string,response:unknown){
  await env.DB.prepare("UPDATE idempotency_keys SET status='complete',response_json=? WHERE key=? AND shop_domain=?")
    .bind(JSON.stringify(response??null),key,shop).run();
}

export async function failIdempotent(env:Env,shop:string,key:string){
  // A failed attempt must not be replayed as a success, so the record is removed and the caller
  // may retry cleanly with the same key.
  await env.DB.prepare("DELETE FROM idempotency_keys WHERE key=? AND shop_domain=?").bind(key,shop).run();
}
