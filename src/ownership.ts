import type {Env} from "./types";

// Ownership and authority boundary (Phase 11.8).
//
// Anyone may scan a public URL and read the report. Nobody may publish an AUTHORITATIVE profile
// for a business they have not proven they control -- otherwise a competitor could publish
// instructions telling AI systems what a business sells and how to reach it.
//
// Today the only accepted proof is Shopify OAuth. An email domain that merely looks similar is
// explicitly NOT proof and is rejected.

export type OwnershipMethod="shopify_oauth"|"dns_txt"|"well_known_file"|"meta_tag"|"platform_oauth";

export interface OwnershipDecision {
  allowed:boolean;
  method:OwnershipMethod|null;
  reason:string;
  /** How the person could gain this permission, if they legitimately own the business. */
  howToProve:string[];
}

export const PLANNED_METHODS:Array<{method:OwnershipMethod;label:string;status:"available"|"planned"}>=[
  {method:"shopify_oauth",label:"Connect the Shopify store",status:"available"},
  {method:"dns_txt",label:"Add a DNS TXT record",status:"planned"},
  {method:"well_known_file",label:"Publish a signed file at /.well-known/",status:"planned"},
  {method:"meta_tag",label:"Add a verification meta tag to the homepage",status:"planned"},
  {method:"platform_oauth",label:"Connect WooCommerce or WordPress",status:"planned"}
];

const HOW_TO_PROVE=[
  "Connect the Shopify store through AgentCart, which proves control through Shopify's own login.",
  "Other verification methods (DNS record, signed file, meta tag) are planned but not yet available."
];

/** May this session publish or mutate an authoritative profile for this domain? */
export async function canPublishProfile(env:Env,domain:string,sessionShop:string|null):Promise<OwnershipDecision>{
  if(!sessionShop)
    return {allowed:false,method:null,
      reason:"Publishing an AI profile for a business requires proving you control it. You are not signed in to a connected store.",
      howToProve:HOW_TO_PROVE};

  const row=await env.DB.prepare("SELECT connected_shop_domain FROM businesses WHERE domain=?")
    .bind(domain.toLowerCase()).first<{connected_shop_domain:string|null}>();

  // The session's own store always controls its own myshopify domain.
  if(sessionShop.toLowerCase()===domain.toLowerCase())
    return {allowed:true,method:"shopify_oauth",
      reason:"You are signed in to this store through Shopify.",howToProve:[]};

  if(row?.connected_shop_domain&&row.connected_shop_domain.toLowerCase()===sessionShop.toLowerCase())
    return {allowed:true,method:"shopify_oauth",
      reason:"This website is linked to the Shopify store you are signed in to.",howToProve:[]};

  // Deliberately no fuzzy matching. A similar name or a matching email domain is not proof.
  return {allowed:false,method:null,
    reason:`You are signed in to ${sessionShop}, which is not linked to ${domain}. AgentCart will not publish an AI profile for a business you have not proven you control.`,
    howToProve:HOW_TO_PROVE};
}

/** Public scanning is always allowed; that is the top of the funnel and reveals nothing private. */
export function canScan(){return {allowed:true,method:null,reason:"Public pages may be scanned by anyone.",howToProve:[]} as OwnershipDecision;}
