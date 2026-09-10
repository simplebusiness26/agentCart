import {ensureProfile,getProfileMeta,setProfileActive} from "../ailayer/service";
import {getCatalog} from "../platform";
import type {FixDefinition} from "./types";

// The hosted-layer fix mutates nothing on the merchant's store, which is exactly why it
// is safe to apply automatically: the worst case is a public profile the merchant can
// switch off again.
export const publishAiLayer:FixDefinition={
  key:"hosted.ai_layer",
  findingKey:"access-content",
  platform:"any",
  title:"Publish an AgentCart AI profile",
  description:"Publishes a clean, machine-readable profile of the business that AI systems can read directly, without changing anything on the merchant's own website.",
  fixType:"hosted_layer",
  risk:"low",
  requiredScopes:[],

  async preview(ctx){
    const meta=await getProfileMeta(ctx.env,ctx.shop);
    const items=await getCatalog(ctx.env,ctx.shop,1,0);
    if(meta&&Number(meta.active))return [];
    return [{targetId:ctx.shop,targetTitle:"AgentCart AI profile",
      summary:items.length
        ? "Publish a public AI profile covering this business and its catalogue."
        : "Publish a public AI profile. No catalogue has been synced yet, so it will cover business details only.",
      before:{active:false},after:{active:true}}];
  },

  async apply(ctx){
    const slug=await ensureProfile(ctx.env,ctx.shop);
    await setProfileActive(ctx.env,ctx.shop,true);
    return {slug,publicUrl:`${ctx.env.APP_URL}/ai/${slug}`};
  },

  async verify(ctx){
    const meta=await getProfileMeta(ctx.env,ctx.shop);
    return meta&&Number(meta.active)
      ? {verified:true,detail:`The AI profile is live at /ai/${meta.slug}.`}
      : {verified:false,detail:"The AI profile is not active."};
  }
};
