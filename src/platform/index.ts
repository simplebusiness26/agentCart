import {decryptToken} from "../shopify";
import {getShop} from "../db";
import type {Env} from "../types";
import {ShopifyAdapter,ShopifyScopeError} from "./shopify";
import {recordSyncRun,saveBusinessProfile,saveCatalog} from "./store";
import type {PlatformAdapter} from "./types";

export {ShopifyScopeError} from "./shopify";
export * from "./store";
export * from "./types";

export function adapterFor(env:Env,platform:string):PlatformAdapter|null{
  return platform==="shopify"?new ShopifyAdapter(env):null;
}

// Pulls authoritative business and catalogue data for a connected store. The access
// token is decrypted here and never leaves this layer -- nothing it returns contains it.
export async function syncConnectedStore(env:Env,shop:string,nowMs=Date.now()){
  const row=await getShop(env,shop);
  if(!row)throw new Error("That store is not connected.");
  const adapter=adapterFor(env,"shopify")!;
  const token=await decryptToken(row.encrypted_access_token,env.TOKEN_ENCRYPTION_KEY);
  try{
    const business=await adapter.syncBusiness(shop,token);
    await saveBusinessProfile(env,shop,business,nowMs);
    const items=await adapter.syncCatalog(shop,token);
    const count=await saveCatalog(env,shop,items,nowMs);
    await recordSyncRun(env,shop,"full","complete",count,null,nowMs);
    return {business,items:count};
  }catch(e){
    const scope=e instanceof ShopifyScopeError;
    await recordSyncRun(env,shop,"full",scope?"needs_reauthorization":"failed",0,
      e instanceof Error?e.message:"Sync failed",nowMs);
    throw e;
  }
}
