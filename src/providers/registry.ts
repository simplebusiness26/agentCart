// Provider facts, in one place. Phase 10 requires provider rules to be updatable centrally
// rather than scattered through the app, and forbids claiming readiness without evidence.
//
// Every entry carries `verifiedOn`. These capabilities are new and move quickly, so a stale
// registry should be visible rather than silent -- see docs/PROVIDER_RESEARCH.md for sources.

export const REGISTRY_VERIFIED_ON="2026-09-10";

// Five distinct answers. They are never collapsed: "we could not tell" and "the merchant failed"
// and "this is not offered in their country" are different facts with different remedies.
export type ReadinessState="pass"|"fail"|"unsupported"|"unknown"|"not_available_in_region";

// What a crawler is FOR. Training is a legitimate merchant choice and must never, on its own,
// reduce an Agent Ready score -- so it is modelled separately from discovery and agentic access.
export type CrawlerPurpose="discovery"|"agentic_fetch"|"training"|"advertising"|"link_preview";

export interface CrawlerAgent {
  /** Token as it appears in a robots.txt User-agent line, lowercased. */
  token:string;
  label:string;
  purpose:CrawlerPurpose;
  /** Documented to honour robots.txt. When false, a Disallow states merchant preference but does
   *  not prove the agent will not fetch -- so AgentCart must not report it as "blocked". */
  respectsRobots:boolean;
  note:string;
  source:string;
}

export interface ProviderRegion {
  /** ISO-3166-1 alpha-2 codes where the consumer product is documented as available. */
  available:string[];
  note:string;
}

export interface ProviderDefinition {
  id:string;
  label:string;
  /** Consumer-facing agent this provider represents, if any. */
  agentProduct?:string;
  crawlers:CrawlerAgent[];
  region?:ProviderRegion;
  /** Protocols the provider is documented to participate in. */
  protocols:string[];
  verifiedOn:string;
  sources:string[];
}

const META_SOURCE="https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers";

export const PROVIDERS:ProviderDefinition[]=[
  {
    id:"meta",
    label:"Meta",
    agentProduct:"Muse",
    crawlers:[
      {token:"meta-externalfetcher",label:"Meta agentic fetcher",purpose:"agentic_fetch",
       respectsRobots:false,
       note:"Fetches individual links at a user's request and supports agentic AI capabilities. Documented as possibly bypassing robots.txt because the fetch is user-initiated.",
       source:META_SOURCE},
      {token:"meta-webindexer",label:"Meta AI search indexer",purpose:"discovery",
       respectsRobots:true,
       note:"Improves Meta AI search result quality. Honours robots.txt, so a block here genuinely reduces discoverability.",
       source:META_SOURCE},
      {token:"meta-externalagent",label:"Meta AI training crawler",purpose:"training",
       respectsRobots:false,
       note:"Trains foundation models and indexes content. Blocking this is a legitimate choice about AI training and is not a readiness failure.",
       source:META_SOURCE},
      {token:"meta-externalads",label:"Meta advertising crawler",purpose:"advertising",
       respectsRobots:true,note:"Advertising and business products.",source:META_SOURCE},
      {token:"facebookexternalhit",label:"Meta link preview",purpose:"link_preview",
       respectsRobots:true,
       note:"Builds link previews for shared content. May bypass robots.txt for security or integrity checks.",
       source:META_SOURCE}
    ],
    region:{available:["US"],
      note:"Muse launched in the United States only. A merchant outside the US is not failing because Muse is unavailable in their market."},
    protocols:["web"],
    verifiedOn:REGISTRY_VERIFIED_ON,
    sources:[META_SOURCE,"https://techcrunch.com/2026/09/08/meta-debuts-its-muse-ai-agent-will-consumers-trust-it/"]
  },
  {
    id:"openai",
    label:"OpenAI",
    agentProduct:"ChatGPT",
    crawlers:[
      {token:"oai-searchbot",label:"OpenAI search crawler",purpose:"discovery",respectsRobots:true,
       note:"Surfaces sites in ChatGPT search results.",source:"https://platform.openai.com/docs/bots"},
      {token:"chatgpt-user",label:"ChatGPT user-initiated fetch",purpose:"agentic_fetch",respectsRobots:true,
       note:"Fetches a page because a user asked ChatGPT to.",source:"https://platform.openai.com/docs/bots"},
      {token:"gptbot",label:"OpenAI training crawler",purpose:"training",respectsRobots:true,
       note:"Model training. Blocking is a legitimate choice and is not a readiness failure.",
       source:"https://platform.openai.com/docs/bots"}
    ],
    protocols:["web","acp"],
    verifiedOn:REGISTRY_VERIFIED_ON,
    sources:["https://platform.openai.com/docs/bots","https://docs.stripe.com/agentic-commerce/acp"]
  },
  {
    id:"anthropic",
    label:"Anthropic",
    agentProduct:"Claude",
    crawlers:[
      {token:"claudebot",label:"Anthropic training crawler",purpose:"training",respectsRobots:true,
       note:"Model training. Blocking is a legitimate choice and is not a readiness failure.",
       source:"https://support.anthropic.com/en/articles/8896518"},
      {token:"claude-user",label:"Claude user-initiated fetch",purpose:"agentic_fetch",respectsRobots:true,
       note:"Fetches a page because a user asked Claude to.",
       source:"https://support.anthropic.com/en/articles/8896518"},
      {token:"claude-searchbot",label:"Claude search crawler",purpose:"discovery",respectsRobots:true,
       note:"Supports search results in Claude.",source:"https://support.anthropic.com/en/articles/8896518"}
    ],
    protocols:["web","mcp"],
    verifiedOn:REGISTRY_VERIFIED_ON,
    sources:["https://support.anthropic.com/en/articles/8896518"]
  },
  {
    id:"google",
    label:"Google",
    agentProduct:"Gemini",
    crawlers:[
      {token:"google-extended",label:"Google AI training control",purpose:"training",respectsRobots:true,
       note:"Controls use of content for Gemini training and grounding. Blocking is a legitimate choice.",
       source:"https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers"},
      {token:"googlebot",label:"Googlebot",purpose:"discovery",respectsRobots:true,
       note:"Search discovery, which also feeds AI surfaces.",
       source:"https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers"}
    ],
    protocols:["web","ucp"],
    verifiedOn:REGISTRY_VERIFIED_ON,
    sources:["https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers","https://ucp.dev/"]
  },
  {
    id:"perplexity",
    label:"Perplexity",
    agentProduct:"Perplexity",
    crawlers:[
      {token:"perplexitybot",label:"Perplexity search crawler",purpose:"discovery",respectsRobots:true,
       note:"Indexes pages for citation in answers.",source:"https://docs.perplexity.ai/guides/bots"},
      {token:"perplexity-user",label:"Perplexity user-initiated fetch",purpose:"agentic_fetch",respectsRobots:true,
       note:"Fetches a page because a user asked.",source:"https://docs.perplexity.ai/guides/bots"}
    ],
    protocols:["web"],
    verifiedOn:REGISTRY_VERIFIED_ON,
    sources:["https://docs.perplexity.ai/guides/bots"]
  }
];

export function providerById(id:string){return PROVIDERS.find(p=>p.id===id)||null;}

export function crawlersByPurpose(purpose:CrawlerPurpose){
  return PROVIDERS.flatMap(p=>p.crawlers.filter(c=>c.purpose===purpose).map(c=>({provider:p.id,...c})));
}

/** Purposes whose blocking legitimately reduces an agent's ability to find or use a business.
 *  Training and advertising are deliberately excluded. */
export const SCORED_PURPOSES:CrawlerPurpose[]=["discovery","agentic_fetch"];

export function isScoredPurpose(purpose:CrawlerPurpose){return SCORED_PURPOSES.includes(purpose);}

/** Whether a provider's consumer agent is documented as available in a market.
 *  Absence of region data means "no restriction recorded", not "unavailable". */
export function regionAvailability(provider:ProviderDefinition,countryCode?:string):ReadinessState{
  if(!provider.region)return "pass";
  if(!countryCode)return "unknown";
  return provider.region.available.includes(countryCode.toUpperCase())?"pass":"not_available_in_region";
}
