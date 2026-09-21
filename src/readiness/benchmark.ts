import type {AgentReadyReport,Check} from "../agentready/types";

export type BenchmarkState="stronger"|"covered"|"planned"|"unsupported_by_provider"|"intentionally_not_applicable"|"unverifiable";
export interface BenchmarkCapability {benchmark:string;key:string;label:string;state:BenchmarkState;equivalent:string;rationale:string;phase:number;evidenceUrl:string;verifiedOn:string;}

const verifiedOn="2026-09-21";
const entry=(benchmark:string,key:string,label:string,state:BenchmarkState,equivalent:string,rationale:string,phase:number,evidenceUrl:string):BenchmarkCapability=>
  ({benchmark,key,label,state,equivalent,rationale,phase,evidenceUrl,verifiedOn});

export const BENCHMARK_CAPABILITIES:BenchmarkCapability[]=[
  entry("Auspia","robots","robots.txt and AI crawler rules","stronger","provider-specific crawler-purpose model","Separates discovery, user fetch and training semantics.",13,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","sitemap","XML sitemap","covered","core readiness crawler","Fetched and reported separately.",1,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","api_catalog","API Catalog discovery","covered","emerging discovery probes","Bounded well-known probe and validation.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","oauth_oidc","OAuth/OIDC discovery","covered","emerging discovery probes","Discovers issuer and protected-resource metadata without testing credentials.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","mcp_card","MCP Server Card","stronger","discovery probe + AgentPulse","Declaration is kept separate from safe runtime verification.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","a2a","A2A Agent Card","covered","emerging discovery probes","Discovers and validates JSON shape.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","agent_skills","Agent Skills index","covered","emerging discovery probes","Discovers the index and reports malformed content.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","markdown","Markdown negotiation","covered","content-negotiation probe","Checks a representative page with Accept: text/markdown.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","link_headers","RFC 8288 Link headers","covered","header relation audit","Parses relations without treating presence as runtime proof.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","auth_md","Auth.md discovery","covered","emerging discovery probes","Discovers non-HTML authorization guidance and reports malformed content.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","content_signals","Content Signals","covered","emerging discovery probes","Content-usage declarations remain separate from crawler access.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","web_bot_auth","Web Bot Auth/JWKS","covered","emerging discovery probes","Discovers the declaration without claiming authentication succeeded.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","dns_aid","DNS-AID","covered","version-gated DNS state","Returns unknown until the standards registry has an authoritative current adapter.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","webmcp","WebMCP runtime","covered","browser/runtime declaration state","Static scans report unknown; runtime evidence is required for pass.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Auspia","commerce_protocols","UCP/ACP/AP2/x402/MPP","stronger","protocol registry + applicability","Optional protocols never penalise an irrelevant business.",22,"https://auspia.ai/solutions/agent-readiness"),
  entry("Peec","visibility","Visibility / mention frequency","covered","visibility analytics v2","Atomic prompt-run metrics with provenance.",25,"https://peec.ai/"),
  entry("Peec","position_sov","Position and share of voice","stronger","all-entity visibility metrics","All recognised brands are used, not only configured competitors.",25,"https://peec.ai/"),
  entry("Peec","sentiment","Sentiment and perception","stronger","evidence-span perception model","Evaluated sentiment stays distinct from verified business facts.",27,"https://peec.ai/"),
  entry("Peec","sources_citations","Source/citation intelligence","covered","URL/domain source analytics","Owned, competitor and third-party source gaps are separated.",26,"https://peec.ai/"),
  entry("Peec","fanouts","Query fanouts","stronger","observed vs synthetic fanouts","Synthetic planning queries can never masquerade as provider traces.",26,"https://peec.ai/"),
  entry("Peec","crawl_logs","Observed AI bot crawls","covered","signed crawl observation adapters","Crawlability and actual visits remain separate.",27,"https://peec.ai/"),
  entry("Peec","shopping","AI shopping analytics","stronger","SKU analytics + Business Brain price check","Price mismatches route into a fix/retest action.",28,"https://peec.ai/"),
  entry("Peec","referrals","Referrals, conversions and revenue","stronger","signed journeys + evidence tiers","Verified, reported and assisted revenue are never summed as equal proof.",29,"https://peec.ai/"),
  entry("Peec","actions","Prioritised actions","stronger","analytics action router","Every recommendation names an owner, execution route and verification.",29,"https://peec.ai/")
  ,entry("Peec","prompt_tracking","Daily custom-prompt tracking","covered","atomic prompt-run store","Every observation retains provider, model, location, method and time.",25,"https://peec.ai/")
  ,entry("Peec","prompt_suggestions","Suggested prompts","stronger","buyer-intent query and opportunity engine","Suggestions share the same intent model as Sales Agent tests and growth work.",22,"https://peec.ai/")
  ,entry("Peec","citation_urls","URL-level citation analytics","covered","visibility_citations","Citation URL, domain, position and evidence span are retained.",25,"https://peec.ai/")
  ,entry("Peec","source_domains","Source-domain analytics","covered","visibility_sources","Accessed sources and cited sources remain distinct.",26,"https://peec.ai/")
  ,entry("Peec","source_gap","Source-gap analysis","stronger","source gap to executable action","Gaps route to owned content, legitimate outreach, directory correction or feed work.",26,"https://peec.ai/")
  ,entry("Peec","chat_features","Chat feature detection","covered","visibility_chat_features","Web search, shopping, comparisons, maps, ads and citations are nullable observations.",25,"https://peec.ai/")
  ,entry("Peec","brand_perception","Brand perception","covered","perception + Business Brain conflict detection","Observed language, evaluated theme and verified fact are separate, but newer attribute-association and market-prominence views are tracked separately.",27,"https://peec.ai/")
  ,entry("Peec","cross_model","Cross-model comparison","covered","prompt-run model dimension","Atomic runs store model and provider for comparable filters.",25,"https://peec.ai/")
  ,entry("Peec","geography","Geography comparison","covered","prompt-run country/locale dimensions","Unknown geography remains null rather than inferred.",25,"https://peec.ai/")
  ,entry("Peec","topic","Topic comparison","covered","query/fanout topic dimensions","Topics connect prompt, fanout and growth opportunity evidence.",26,"https://peec.ai/")
  ,entry("Peec","competitors","Competitor comparison","stronger","all-entity + configured competitor views","A limited competitor list cannot improve the all-brand position artificially.",25,"https://peec.ai/")
  ,entry("Peec","crawlability","40+ bot crawlability","stronger","provider-purpose robots model","Allowed preference is separate from an observed visit.",13,"https://peec.ai/")
  ,entry("Peec","observed_bot_crawls","Observed bot crawl analytics","covered","crawler_observations","Authorised first-party adapters record path, status, latency, bytes and errors.",27,"https://peec.ai/")
  ,entry("Peec","shopping_visibility","SKU shopping visibility","covered","shopping_observations","Visibility is stored per item and prompt.",28,"https://peec.ai/")
  ,entry("Peec","product_win_rate","Product win rate","covered","shopping aggregation","Wins and prompt counts stay sample-size visible.",28,"https://peec.ai/")
  ,entry("Peec","quoted_price","Quoted vs canonical price","stronger","Business Brain price validator","Mismatches create a fix and retest route.",28,"https://peec.ai/")
  ,entry("Peec","product_cooccurrence","Co-featured competitors","covered","shopping competitor evidence","Competitors are stored per SKU observation.",28,"https://peec.ai/")
  ,entry("Peec","shopping_fanouts","Shopping query fanouts","stronger","provenance-labelled fanout engine","Observed and synthetic shopping fanouts cannot be mixed.",26,"https://peec.ai/")
  ,entry("Peec","conversion_revenue","Conversion and revenue analytics","stronger","signed journeys + evidence tiers","Verified, reported, assisted and unknown outcomes stay separate.",29,"https://peec.ai/")
  ,entry("Peec","api_mcp","API and MCP access","stronger","authenticated analytics API + read-only MCP","Private merchant analytics are not leaked through the public MCP.",29,"https://peec.ai/")
  ,entry("Peec","export","Export-ready analytics","covered","stable evidence CSV","Atomic prompt evidence exports with fixed columns.",29,"https://peec.ai/")
  ,entry("Cloudflare","agent_readiness","Agent readiness diagnostics","covered","scanner superset + provider/readiness evidence","AgentReady already separates business readiness, technical standards and provider evidence.",22,"https://blog.cloudflare.com/aeo/")
  ,entry("Cloudflare","citation_rate","AEO citation rate","covered","citation analytics","Atomic prompt runs retain cited state and citation URLs.",25,"https://blog.cloudflare.com/aeo/")
  ,entry("Cloudflare","mention_rate","AEO mention rate","covered","visibility analytics","Mention frequency is retained per prompt run.",25,"https://blog.cloudflare.com/aeo/")
  ,entry("Cloudflare","share_of_voice","AEO share of voice","covered","all-entity share of voice","Share of voice is computed from atomic observations with sample-size visibility.",25,"https://blog.cloudflare.com/aeo/")
  ,entry("Cloudflare","prominence","AEO prominence","covered","answer-span prominence analytics","Answer-level evidence spans calculate early position and attributed coverage with provider, country, window and sample-size context.",31,"https://blog.cloudflare.com/aeo/")
  ,entry("Cloudflare","industry_fit","AEO industry fit","covered","category benchmark corpus","Reusable 30-day category panels retain sample size and brand co-occurrence rather than inventing a fit score from one prompt.",31,"https://blog.cloudflare.com/aeo/")
  ,entry("Peec","brand_attribute_association","Brand attribute association","covered","attribute evidence corpus","Brand-to-attribute association is calculated only over stored evidence spans and exposes corpus sufficiency.",31,"https://peec.ai/blog/introducing-brand-perception")
  ,entry("Peec","attribute_market_prominence","Attribute market prominence","covered","competitor attribute benchmark","Attribute prominence is compared across the same observed competitive corpus and remains distinct from factual truth.",31,"https://peec.ai/blog/introducing-brand-perception")
  ,entry("Peec","ga4_referral_dimensions","Authorised GA referral dimensions","stronger","GA4 OAuth evidence adapter + signed journeys","GA4 sessions, engagement, landing page, country, device, conversion and revenue are imported as a separate external evidence tier and never double-counted with verified orders.",31,"https://peec.ai/blog/introducing-ai-referrals")
  ,entry("Shopify","native_ucp","Native UCP 2026-08-25 discovery","covered","versioned native UCP observation","The live well-known profile, transports and capabilities are observed per store; cart and checkout are never exercised by an ordinary scan.",30,"https://shopify.dev/docs/agents/get-started/profile")
  ,entry("OpenAI","commerce_feed","OpenAI commerce feed readiness","covered","canonical catalogue feed preview","All nine core fields, freshness, availability and variant grouping are validated without uploading provider data.",30,"https://developers.openai.com/commerce/specs/file-upload/products")
  ,entry("Algolia","agentic_retrieval","Authorised Algolia MCP retrieval","covered","optional Algolia detection and read-only audit","Existing Algolia merchants can reuse their retrieval layer with ephemeral search credentials; Algolia is never a scoring requirement.",30,"https://www.algolia.com/about/news/algolia-launches-production-grade-mcp-for-agentic-commerce")
  ,entry("Google","agentic_browsing","Lighthouse Agentic Browsing evidence","covered","Lighthouse evidence adapter","Individual WebMCP, accessibility, layout and llms.txt audits are retained separately from AgentReady's business score.",30,"https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring")
  ,entry("Auspia","agent_security","Agent-interaction security","stronger","applicability-gated tool security","Metadata and output injection, identity, scope, approval, idempotency, rollback and verification are assessed independently; brochure sites are not penalised.",32,"https://auspia.ai/blog/agentic-ai-security-website-readiness-model")
  ,entry("Azoma","ai_shelf_recommendation_share","Cross-agent recommendation share","covered","AI Shelf recommendation share","Recommendation share is calculated per provider, surface and category from atomic prompt evidence, with sample-size stability labels.",33,"https://www.azoma.ai/insights/azoma-receives-investment-from-dunnhumby-ventures-to-accelerate-its-agentic-commerce-optimization-platform")
  ,entry("Azoma","source_mix","Agent-specific citation source mix","covered","AI Shelf source-mix analytics","Observed citations are classified as brand-owned, retailer, earned media, UGC/social, reference or other and kept provider/surface specific.",33,"https://www.azoma.ai/insights/agentic-commerce-optimisation-azoma-on-what-ai-shopping-agents-check-before-recommending-a-brand")
  ,entry("Azoma","sku_recommendation","SKU-level recommendation evidence","covered","shopping observations + prompt evidence","SKU visibility, position, competitors, attributes, price correctness and source URLs are retained for evidence-backed optimisation.",33,"https://www.azoma.ai/insights/azoma-receives-investment-from-dunnhumby-ventures-to-accelerate-its-agentic-commerce-optimization-platform")
  ,entry("Google","merchant_ai_performance","Merchant Center AI performance insights","planned","authorised Merchant Center evidence import","Google now exposes organic AI share of voice, shopping-stage performance, top terms, popular attributes and products showing. Import requires an authorised Merchant Center connection and must preserve Google's geography/availability limits.",34,"https://support.google.com/merchants/answer/17200695")
  ,entry("Google","conversational_attributes","Merchant Center conversational attributes","planned","conversational product-data readiness","Question/answer, document link, related product, item-group title and variant-option fields should be audited and generated from verified catalogue facts before any authorised Merchant Center write.",34,"https://support.google.com/merchants/answer/17085370")
  ,entry("Shopify","meta_agentic_channel","Meta agentic storefront channel readiness","planned","Shopify Agentic Storefront channel observation","Eligible Shopify merchants can expose products and direct checkout to Meta. AgentReady should observe the merchant's channel state and keep server-to-server checkout measurement distinct because custom/browser pixels do not fire in Meta direct checkout.",34,"https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/meta")
  ,entry("WebMCP","action_mapper","Business-specific AI action mapping","planned","Fix My Site action planner","AgentReady should map verified business capabilities to only the WebMCP/API actions that actually apply, rather than exposing a generic tool bundle.",35,"https://developer.chrome.com/docs/ai/webmcp/imperative-api")
  ,entry("WebMCP","installer","WebMCP site installer/bridge","planned","WordPress/WooCommerce + generic Fix My Site adapter","AgentReady needs an authorised install path that registers structured site tools without taking over payment credentials or inventing merchant state.",35,"https://developer.chrome.com/docs/ai/webmcp/imperative-api")
  ,entry("WebMCP","runtime_monitoring","Real browser WebMCP journey verification","planned","AgentPulse browser-runtime adapter","Tool presence, schema, safe execution, source-of-truth output, latency and drift must be exercised in a compatible runtime rather than inferred from static HTML.",35,"https://developer.chrome.com/docs/ai/webmcp/secure-tools")
  ,entry("PayPal","webmcp_reuse","PayPal Store Sync/WebMCP reuse path","planned","provider-aware implementation router","Eligible PayPal Store Sync merchants should reuse PayPal's shopping.* tools and secure checkout handoff instead of receiving a duplicate AgentReady checkout stack.",35,"https://webmcp-store.paypal.com/")
];

export interface RemediationPath {
  findingKey:string;currentState:"fail"|"partial"|"unknown"|"blocked";targetState:"pass";scoreRecoverable:number;
  owner:"agentready"|"merchant"|"developer"|"platform"|"provider";
  mode:"automatic"|"approval_required"|"guided"|"developer_instructions"|"manual"|"provider_dependency";
  canAgentReadyApply:boolean;canVerify:boolean;previewAvailable:boolean;undoAvailable:boolean;
  requirements:string[];steps:string[];verification:string[];officialDocs:string[];
}

function remediation(check:Check):RemediationPath{
  const automatic=check.fixType==="automatic"||check.fixType==="hosted_layer";
  const approval=check.fixType==="approval_required";
  const unavailable=check.fixType==="unavailable";
  const mode:RemediationPath["mode"]=automatic?"automatic":approval?"approval_required":unavailable?"provider_dependency":"guided";
  const owner:RemediationPath["owner"]=automatic||approval?"agentready":unavailable?"provider":"merchant";
  return {findingKey:check.key,currentState:check.status==="partial"?"partial":"fail",targetState:"pass",scoreRecoverable:check.estimatedGain,
    owner,mode,canAgentReadyApply:automatic||approval,canVerify:true,previewAvailable:approval||automatic,
    undoAvailable:automatic||approval,requirements:unavailable?["Wait for or enable the external capability."]:[],
    steps:[check.recommendedFix||"Complete the missing requirement, then ask AgentReady to rescan."],
    verification:[`Rerun ${check.plainTitle} and confirm it passes on the live public site.`],officialDocs:[]};
}

export function buildPathTo100(report:AgentReadyReport){
  const paths=report.checks.filter(c=>c.status!=="pass"&&c.status!=="na").map(remediation);
  const grouped={automatic:0,approval_required:0,guided:0,developer_instructions:0,manual:0,provider_dependency:0};
  for(const p of paths)grouped[p.mode]+=p.scoreRecoverable;
  const recoverable=paths.reduce((n,p)=>n+p.scoreRecoverable,0);
  return {currentScore:report.score,pointsRecoverable:recoverable,potentialScore:Math.min(100,report.score+recoverable),grouped,paths,
    rule:"100 means every applicable, merchant-controllable scored requirement passes. Optional or provider-blocked capabilities remain neutral."};
}

export function benchmarkSummary(maxPhase=Number.POSITIVE_INFINITY){
  const capabilities=BENCHMARK_CAPABILITIES.filter(c=>c.phase<=maxPhase);
  const releaseBlockers=capabilities.filter(c=>c.state==="planned");
  const peecFloor=new Set(capabilities.filter(c=>c.benchmark==="Peec").map(c=>c.key));
  return {verifiedOn,total:capabilities.length,peecCapabilities:peecFloor.size,releaseBlockers:releaseBlockers.length,capabilities,
    milestoneReady:releaseBlockers.length===0,
    scope:maxPhase===Number.POSITIVE_INFINITY?"current_market":"through_phase_"+maxPhase,
    note:"Covered means an end-to-end AgentReady capability exists; it does not claim that every external provider exposes data for every merchant. Phase-scoped summaries preserve historical milestone truth when the market adds new capabilities."};
}
