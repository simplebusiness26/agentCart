// Shaped from Shopify's published GraphQL Admin responses. Includes fields AgentCart
// must NOT persist, so the leak tests have something real to catch.
export const SHOP_RESPONSE={data:{shop:{
  name:"Northbound Outfitters",
  description:"<p>Cold weather hiking gear, made in Yorkshire.</p>",
  contactEmail:"hello@northbound.example",
  url:"https://northbound-outfitters.myshopify.com",
  currencyCode:"GBP",
  billingAddress:{address1:"14 Kirkgate",address2:"",city:"Leeds",province:"West Yorkshire",
    zip:"LS1 6BY",country:"United Kingdom",phone:"+441134960100"}
}}};

export const POLICY_RESPONSE={data:{shop:{shopPolicies:[
  {type:"REFUND_POLICY",title:"Refund policy",url:"https://x/policies/refund-policy",
   body:"<p>Return anything unused within 30 days.</p>"},
  {type:"SHIPPING_POLICY",title:"Shipping policy",url:"https://x/policies/shipping-policy",
   body:"<p>Ships worldwide in two working days.</p>"}
]}}};

export const productNode=(i:number,over:Record<string,unknown>={})=>({
  id:`gid://shopify/Product/${i}`,handle:`item-${i}`,title:`Item ${i}`,
  descriptionHtml:`<p>Description for item ${i} with <b>markup</b>.</p>`,
  productType:"Base layers",vendor:"Northbound",status:"ACTIVE",
  onlineStoreUrl:`https://northbound.example/products/item-${i}`,
  seo:{title:`Item ${i} SEO`,description:`SEO description ${i}`},
  featuredImage:{url:`https://cdn.example/${i}.jpg`,altText:`Item ${i} photo`},
  priceRangeV2:{minVariantPrice:{amount:"29.00",currencyCode:"GBP"},
                maxVariantPrice:{amount:"49.00",currencyCode:"GBP"}},
  variants:{nodes:[
    {id:`gid://shopify/ProductVariant/${i}1`,title:"Small",sku:`NB-${i}-S`,barcode:`50123456789${i}`,availableForSale:true,price:"29.00"},
    {id:`gid://shopify/ProductVariant/${i}2`,title:"Large",sku:`NB-${i}-L`,barcode:`50123456780${i}`,availableForSale:false,price:"49.00"}
  ]},
  ...over
});

export const productsResponse=(nodes:unknown[],hasNextPage=false,endCursor="cursor-1")=>
  ({data:{products:{pageInfo:{hasNextPage,endCursor},nodes}}});

export const ACCESS_DENIED={errors:[{message:"Access denied for products field.",
  extensions:{code:"ACCESS_DENIED",requiredAccess:"read_products"}}]};
