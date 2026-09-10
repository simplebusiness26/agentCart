import type {Env} from "../types";
import {getActions,getBusiness,getCatalogView,getItemView,getPolicies,searchCatalogView} from "../ailayer/service";

// Protocol compatibility (Phase 11.1). Ordinary web, UCP and ACP are three ways of asking the
// same questions, so they are three thin adapters over one service layer -- the same one the JSON
// endpoints, MCP surface and agents.md already use.
//
// AgentCart implements the DISCOVERY and READ side. It does not implement checkout for either
// protocol: the merchant's platform owns checkout and payment, and claiming otherwise would
// advertise a capability that does not exist.

export type ProtocolId="web"|"ucp"|"acp"|"mcp";

export interface ProtocolDescriptor {
  id:ProtocolId;
  label:string;
  supported:string[];
  notSupported:Array<{capability:string;reason:string}>;
  spec:string;
}

export const PROTOCOLS:ProtocolDescriptor[]=[
  {id:"web",label:"Ordinary web",
   supported:["Machine-readable business profile","Catalogue and item detail","Policies","Supported actions","agents.md"],
   notSupported:[{capability:"Checkout",reason:"Checkout happens on the merchant's own site."}],
   spec:"https://schema.org/Organization"},
  {id:"mcp",label:"Model Context Protocol",
   supported:["tools/list","tools/call for read-only business, catalogue, policy and action queries"],
   notSupported:[{capability:"Mutating tools",reason:"Every exposed tool is read-only by design."}],
   spec:"https://modelcontextprotocol.io"},
  {id:"ucp",label:"Universal Commerce Protocol",
   supported:["Discovery manifest, served by AgentCart for the business at /api/ai/<slug>/ucp","Shopping service descriptor","Capability advertisement"],
   notSupported:[
     {capability:"dev.ucp.shopping.checkout",reason:"AgentCart does not process payments. Checkout stays with the merchant's platform."},
     {capability:"Signed message verification",reason:"No signing keys are published, because AgentCart does not sign commerce messages on a merchant's behalf."}],
   spec:"https://ucp.dev"},
  {id:"acp",label:"Agentic Commerce Protocol",
   supported:["Product feed compatible read access","Capability description"],
   notSupported:[
     {capability:"Delegated payment / Shared Payment Token",reason:"AgentCart never holds or forwards payment credentials."},
     {capability:"Order lifecycle",reason:"Orders are owned by the merchant's platform."}],
   spec:"https://github.com/agentic-commerce-protocol/agentic-commerce-protocol"}
];

/** The UCP discovery manifest AgentCart publishes for a connected business.
 *  Shape follows ucp.dev core concepts, verified 2026-09-10. */
export async function buildUcpManifest(env:Env,shop:string,slug:string,appUrl:string){
  const business=await getBusiness(env,shop,slug);
  if(!business)return null;
  const base=`${appUrl.replace(/\/$/,"")}/api/ai/${slug}`;
  return {
    ucp:{
      version:"draft",
      services:{
        "dev.ucp.shopping":{version:"draft",transport:"rest",endpoint:base,spec:"https://ucp.dev"}
      },
      capabilities:{
        // Only what is genuinely implemented. Checkout is deliberately absent.
        "dev.ucp.shopping.catalog":[{version:"draft",spec:"https://ucp.dev"}]
      }
      // payment_handlers is omitted entirely: AgentCart accepts no payments.
    },
    agentcart:{
      note:"AgentCart publishes discovery and read access for this business. Checkout and payment remain with the merchant's own platform.",
      endpoints:{profile:`${base}/profile`,catalog:`${base}/catalog`,search:`${base}/search`,
        policies:`${base}/policies`,actions:`${base}/actions`,mcp:`${base}/mcp`,agentsMd:`${base}/agents.md`},
      lastUpdated:business.lastUpdated
    }
  };
}

/** One normalized answer, whatever protocol asked. */
export async function protocolQuery(env:Env,shop:string,slug:string,query:{kind:string;id?:string;q?:string;limit?:number}){
  switch(query.kind){
    case "business":return await getBusiness(env,shop,slug);
    case "catalog":return {items:await getCatalogView(env,shop,query.limit||50)};
    case "item":return await getItemView(env,shop,String(query.id||""));
    case "search":return {results:await searchCatalogView(env,shop,String(query.q||""),query.limit||20)};
    case "policies":return {policies:await getPolicies(env,shop)};
    case "actions":return {actions:await getActions(env,shop)};
    default:return null;
  }
}

export function protocolSupport(){
  return PROTOCOLS.map(p=>({...p,
    // Stated plainly so nobody reads "supports UCP" as "can take an agent's money".
    summary:`${p.label}: discovery and read access. ${p.notSupported.map(n=>n.capability).join(", ")} not implemented.`}));
}
