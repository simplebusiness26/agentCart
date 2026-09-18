export type WorkOwner="agentcart"|"developer"|"merchant_platform"|"legal"|"third_party";
export interface PlatformCapability {
  platform:string;label:string;detectedBy:string;connection:"implemented"|"planned"|"not_required";
  automaticWrites:boolean;owners:WorkOwner[];note:string;officialDocs:string;
}

/** A platform being detectable is not a claim that AgentCart can write to it. The registry makes
 * that boundary explicit so a generic site is never offered a Shopify mutation. */
export const PLATFORM_REGISTRY:PlatformCapability[]=[
  {platform:"shopify",label:"Shopify",detectedBy:"public markup plus merchant OAuth",connection:"implemented",
    automaticWrites:true,owners:["agentcart","merchant_platform","legal","third_party"],
    note:"Catalogue sync and narrow, previewed product fixes are implemented.",officialDocs:"https://shopify.dev/docs"},
  {platform:"woocommerce",label:"WooCommerce",detectedBy:"public WooCommerce/WordPress signals",connection:"planned",
    automaticWrites:false,owners:["developer","merchant_platform","legal","third_party"],
    note:"Detection and developer guidance are available; no write credential is requested.",officialDocs:"https://woocommerce.github.io/woocommerce-rest-api-docs/"},
  {platform:"wordpress",label:"WordPress",detectedBy:"public WordPress signals",connection:"planned",
    automaticWrites:false,owners:["developer","merchant_platform","legal","third_party"],
    note:"Detection and developer guidance are available; no automatic write is claimed.",officialDocs:"https://developer.wordpress.org/rest-api/"},
  {platform:"wix",label:"Wix",detectedBy:"merchant declaration",connection:"planned",automaticWrites:false,
    owners:["developer","merchant_platform","legal","third_party"],note:"Use evidence-backed developer instructions until an authorised adapter exists.",officialDocs:"https://dev.wix.com/docs/rest"},
  {platform:"squarespace",label:"Squarespace",detectedBy:"merchant declaration",connection:"planned",automaticWrites:false,
    owners:["developer","merchant_platform","legal","third_party"],note:"Use evidence-backed developer instructions until an authorised adapter exists.",officialDocs:"https://developers.squarespace.com/"},
  {platform:"other",label:"Custom or other site",detectedBy:"fallback after bounded detection",connection:"not_required",
    automaticWrites:false,owners:["developer","legal","third_party"],note:"AgentCart can scan and host an AI layer, but does not write to an unknown site.",officialDocs:"https://schema.org/"}
];

export function platformCapability(platform:string){return PLATFORM_REGISTRY.find(p=>p.platform===platform)||PLATFORM_REGISTRY.at(-1)!;}

export function classifyWork(input:{legal?:boolean;thirdParty?:boolean;automatic?:boolean;platformConnected?:boolean}):WorkOwner{
  if(input.legal)return "legal";if(input.thirdParty)return "third_party";
  if(input.automatic)return "agentcart";return input.platformConnected?"merchant_platform":"developer";
}
