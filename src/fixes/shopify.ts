import {adminGraphql} from "../platform/shopify";
import {getCatalog} from "../platform";
import type {FixContext,FixDefinition,FixPreview} from "./types";

// Shopify fixes. Each one is narrow, previewable and independently verifiable.
//
// Deliberately NOT here, and not to be added without an explicit feature and merchant
// approval: price, inventory, variants, checkout configuration, legal policy text, or
// any customer-facing claim. Overwriting good merchant copy is also out -- every fix
// below only fills something that is genuinely absent.

const PRODUCT_SEO=`query P($id:ID!){ product(id:$id){ id title seo{ title description } descriptionHtml } }`;
const SEO_UPDATE=`mutation U($input:ProductInput!){ productUpdate(input:$input){
  product{ id seo{ title description } } userErrors{ field message } } }`;
const METAFIELD_SET=`mutation M($metafields:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$metafields){
  metafields{ key namespace value } userErrors{ field message } } }`;
const METAFIELD_READ=`query MF($id:ID!){ product(id:$id){ id
  metafield(namespace:"agentcart",key:"ai_summary"){ value } } }`;

const clean=(v:string)=>String(v||"").replace(/\s+/g," ").trim();

function seoDescriptionFor(row:Record<string,unknown>){
  // Built only from facts already published by the merchant. No invented claims.
  const title=clean(String(row.title||""));
  const type=clean(String(row.product_type||""));
  const vendor=clean(String(row.vendor||""));
  const price=row.price_min==null?"":`${row.currency||""} ${row.price_min}`.trim();
  const body=clean(String(row.description||"")).slice(0,110);
  const parts=[title,type&&type!==title?type:"",vendor?`by ${vendor}`:"",price?`from ${price}`:""].filter(Boolean);
  const lead=parts.join(" · ");
  const out=body?`${lead}. ${body}`:lead;
  return out.slice(0,320);
}

function aiSummaryFor(row:Record<string,unknown>){
  const variants=(()=>{try{return JSON.parse(String(row.variants_json||"[]"));}catch{return [];}})();
  return JSON.stringify({
    title:row.title,category:row.product_type,brand:row.vendor,
    price:{min:row.price_min,max:row.price_max,currency:row.currency},
    available:!!Number(row.available||0),
    options:variants.map((v:any)=>({title:v.title,price:v.price,available:v.available,sku:v.sku})),
    url:row.url,source:"AgentCart, generated from the merchant's own catalogue data."
  });
}

async function candidates(ctx:FixContext,limit:number,pick:(row:Record<string,unknown>)=>boolean){
  return (await getCatalog(ctx.env,ctx.shop,200,0)).filter(pick).slice(0,limit);
}

export const productSeoDescription:FixDefinition={
  key:"shopify.product.seo_description",
  findingKey:"business-description",
  platform:"shopify",
  title:"Add missing product search descriptions",
  description:"Writes an SEO description for products that have none, built only from the product's own title, type, brand and price.",
  fixType:"approval_required",
  risk:"low",
  requiredScopes:["write_products"],

  async preview(ctx,limit=25){
    // Only products with NO seo description are touched, so merchant copy is never
    // overwritten. The catalogue cache does not hold seo fields, so read them live.
    const rows=await candidates(ctx,limit,()=>true);
    const out:FixPreview[]=[];
    for(const row of rows){
      const id=String(row.item_id||"");
      if(!id)continue;
      const data=await adminGraphql(ctx.env,ctx.shop,ctx.token,PRODUCT_SEO,{id});
      const existing=clean(String(data?.product?.seo?.description||""));
      if(existing)continue;
      const after=seoDescriptionFor(row);
      if(!after)continue;
      out.push({targetId:id,targetTitle:String(row.title||id),
        summary:`Add a search description to “${row.title}”.`,
        before:{seoDescription:""},after:{seoDescription:after}});
      if(out.length>=limit)break;
    }
    return out;
  },

  async apply(ctx,preview){
    const res=await adminGraphql(ctx.env,ctx.shop,ctx.token,SEO_UPDATE,
      {input:{id:preview.targetId,seo:{description:String(preview.after.seoDescription||"")}}});
    const errors=res?.productUpdate?.userErrors||[];
    if(errors.length)throw new Error(errors.map((e:any)=>e.message).join("; "));
    return {seoDescription:res?.productUpdate?.product?.seo?.description||null};
  },

  async verify(ctx,preview){
    // Re-read from Shopify rather than trusting the mutation response.
    const data=await adminGraphql(ctx.env,ctx.shop,ctx.token,PRODUCT_SEO,{id:preview.targetId});
    const now=clean(String(data?.product?.seo?.description||""));
    const want=clean(String(preview.after.seoDescription||""));
    return now===want
      ? {verified:true,detail:"Shopify now returns the new description."}
      : {verified:false,detail:now?`Shopify returned a different description than the one applied.`:"Shopify still returns no description."};
  }
};

export const productAiMetafield:FixDefinition={
  key:"shopify.product.ai_metafield",
  findingKey:"catalog-schema",
  platform:"shopify",
  title:"Publish machine-readable product data",
  description:"Writes an AgentCart metafield holding structured product facts, so assistants and theme extensions can read them without parsing the page.",
  fixType:"automatic",
  risk:"low",
  requiredScopes:["write_products"],

  async preview(ctx,limit=50){
    const rows=await candidates(ctx,limit,r=>!!r.title);
    return rows.map(row=>({
      targetId:String(row.item_id||""),targetTitle:String(row.title||""),
      summary:`Publish structured data for “${row.title}”.`,
      before:{metafield:null},after:{metafield:aiSummaryFor(row)}
    })).filter(p=>p.targetId);
  },

  async apply(ctx,preview){
    const res=await adminGraphql(ctx.env,ctx.shop,ctx.token,METAFIELD_SET,{metafields:[{
      ownerId:preview.targetId,namespace:"agentcart",key:"ai_summary",
      type:"json",value:String(preview.after.metafield||"{}")}]});
    const errors=res?.metafieldsSet?.userErrors||[];
    if(errors.length)throw new Error(errors.map((e:any)=>e.message).join("; "));
    return {metafield:res?.metafieldsSet?.metafields?.[0]?.value||null};
  },

  async verify(ctx,preview){
    const data=await adminGraphql(ctx.env,ctx.shop,ctx.token,METAFIELD_READ,{id:preview.targetId});
    const value=String(data?.product?.metafield?.value||"");
    return value?{verified:true,detail:"Shopify returns the AgentCart metafield."}
                :{verified:false,detail:"Shopify does not return the metafield yet."};
  }
};
