import type {Env} from "../types";
import type {NormalizedBusiness,NormalizedItem,PlatformAdapter} from "./types";

// Shopify GraphQL Admin client. Errors are surfaced with enough detail to act on --
// notably a missing scope, which must be distinguishable from a transport failure so
// the UI can prompt a reauthorization rather than showing a generic error.
export class ShopifyScopeError extends Error {
  constructor(public scope:string){super(`AgentCart needs the ${scope} permission for this. Reconnect the store to grant it.`);}
}

export async function adminGraphql<T=any>(env:Env,shop:string,token:string,query:string,variables:Record<string,unknown>={}):Promise<T>{
  const res=await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/graphql.json`,{
    method:"POST",headers:{"content-type":"application/json","x-shopify-access-token":token},
    body:JSON.stringify({query,variables})});
  if(res.status===401||res.status===403)throw new ShopifyScopeError("required");
  if(!res.ok)throw new Error(`Shopify API error (${res.status}).`);
  const body=await res.json<any>();
  if(body?.errors?.length){
    const message=body.errors.map((e:any)=>e.message).join("; ");
    // Shopify reports a missing scope as an ACCESS_DENIED extension rather than a 403.
    if(body.errors.some((e:any)=>e?.extensions?.code==="ACCESS_DENIED"||/access denied|not approved|required access/i.test(String(e?.message))))
      throw new ShopifyScopeError(String(body.errors[0]?.extensions?.requiredAccess||"required"));
    throw new Error(message);
  }
  return body.data as T;
}

const SHOP_QUERY=`query Shop{ shop{
  name description contactEmail url currencyCode
  billingAddress{ address1 address2 city province zip country phone }
}}`;

const POLICY_QUERY=`query Policies{ shop{ shopPolicies{ type title url body } } }`;

const PRODUCTS_QUERY=`query Products($cursor:String){
  products(first:50, after:$cursor, query:"status:active"){
    pageInfo{ hasNextPage endCursor }
    nodes{
      id handle title descriptionHtml productType vendor status onlineStoreUrl
      seo{ title description }
      featuredImage{ url altText }
      priceRangeV2{ minVariantPrice{ amount currencyCode } maxVariantPrice{ amount currencyCode } }
      variants(first:20){ nodes{ id title sku barcode availableForSale price } }
    }
  }
}`;

const stripHtml=(v:string)=>String(v||"").replace(/<[^<>]{0,4000}>/g," ").replace(/\s+/g," ").trim();
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:null;};

export function normalizeProduct(node:any,shop:string):NormalizedItem{
  const variants=(node?.variants?.nodes||[]).map((v:any)=>({
    id:String(v?.id||""),title:String(v?.title||""),price:num(v?.price),
    available:!!v?.availableForSale,sku:String(v?.sku||"")}));
  const min=node?.priceRangeV2?.minVariantPrice,max=node?.priceRangeV2?.maxVariantPrice;
  return {
    id:String(node?.id||""),handle:String(node?.handle||""),title:String(node?.title||""),
    description:stripHtml(node?.descriptionHtml).slice(0,4000),
    productType:String(node?.productType||""),vendor:String(node?.vendor||""),
    url:String(node?.onlineStoreUrl||(node?.handle?`https://${shop}/products/${node.handle}`:"")),
    imageUrl:String(node?.featuredImage?.url||""),imageAlt:String(node?.featuredImage?.altText||""),
    priceMin:num(min?.amount),priceMax:num(max?.amount),
    currency:String(min?.currencyCode||max?.currencyCode||""),
    available:variants.some((v:any)=>v.available),
    variants,
    seoTitle:String(node?.seo?.title||""),seoDescription:String(node?.seo?.description||""),
    identifiers:{sku:String(node?.variants?.nodes?.[0]?.sku||""),barcode:String(node?.variants?.nodes?.[0]?.barcode||"")},
    status:String(node?.status||"")
  };
}

export class ShopifyAdapter implements PlatformAdapter {
  readonly platform="shopify";
  constructor(private env:Env){}

  async syncBusiness(shop:string,token:string):Promise<NormalizedBusiness>{
    const data=await adminGraphql(this.env,shop,token,SHOP_QUERY);
    const s=data?.shop||{};
    const a=s.billingAddress||{};
    // Policies are a separate query so a store without them still yields a profile.
    let policies:NormalizedBusiness["policies"]=[];
    try{
      const p=await adminGraphql(this.env,shop,token,POLICY_QUERY);
      policies=(p?.shop?.shopPolicies||[]).map((x:any)=>({
        type:String(x?.type||""),title:String(x?.title||""),url:String(x?.url||""),
        body:stripHtml(x?.body).slice(0,8000)}));
    }catch{/* policies are optional; a profile without them is still useful */}
    return {
      name:String(s.name||""),description:stripHtml(s.description).slice(0,2000),
      contactEmail:String(s.contactEmail||""),contactPhone:String(a.phone||""),
      address:{address1:String(a.address1||""),address2:String(a.address2||""),city:String(a.city||""),
        province:String(a.province||""),zip:String(a.zip||""),country:String(a.country||"")},
      currency:String(s.currencyCode||""),primaryUrl:String(s.url||`https://${shop}`),
      policies
    };
  }

  async syncCatalog(shop:string,token:string,limit=250):Promise<NormalizedItem[]>{
    const items:NormalizedItem[]=[];
    let cursor:string|null=null;
    // Bounded pagination: a very large catalogue must not run the Worker out of time.
    for(let page=0;page<10&&items.length<limit;page++){
      const data:any=await adminGraphql(this.env,shop,token,PRODUCTS_QUERY,{cursor});
      const conn=data?.products;
      for(const node of conn?.nodes||[]){
        items.push(normalizeProduct(node,shop));
        if(items.length>=limit)break;
      }
      if(!conn?.pageInfo?.hasNextPage)break;
      cursor=conn.pageInfo.endCursor;
    }
    return items;
  }
}
