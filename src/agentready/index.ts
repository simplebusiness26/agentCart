import {assessInteraction} from "./interaction";
import {assessPayment} from "./payment";
import {assessSafety} from "./safety";
import {DISCOVERY_PATHS,assessDiscovery} from "../providers/discovery";
import type {DiscoveryKind} from "../providers/discovery";
import {providerAccess} from "../providers/robots";
import {crawlSite} from "./crawl";
import type {CrawlResult} from "./crawl";
import {detectPlatform} from "./platform";
import {SCORING_VERSION,detectShape,scoreReport} from "./score";
import type {AgentReadyReport,AssessedSite,PlatformResult,ReadinessLayers} from "./types";

export {SCORING_VERSION,scoreReport} from "./score";
export {detectPlatform} from "./platform";
export {crawlSite,extractLinks,selectTargets} from "./crawl";
export {classifyPage,extractSignals} from "./extract";
export * from "./types";

// The Phase 10 readiness layers. Pure: everything it needs was already fetched by the crawl,
// so a scan pays no extra network cost for them.
export function assessReadiness(crawl:CrawlResult,platform:PlatformResult):ReadinessLayers{
  const kinds=Object.keys(DISCOVERY_PATHS) as DiscoveryKind[];
  const {sellsProducts,offersBooking}=detectShape(crawl.pages);
  const ucp=crawl.discovery.ucp_manifest;
  return {
    discovery:kinds.map(k=>assessDiscovery(k,crawl.discovery[k],platform.platform)),
    providers:providerAccess(crawl.robots),
    safety:assessSafety(crawl.homeHtml),
    payment:assessPayment(crawl.pages,crawl.homeHtml,
      {sellsProducts,ucpManifest:ucp?.ok?ucp.body:undefined}),
    interaction:assessInteraction(crawl.homeHtml,{sellsProducts,offersBooking})
  };
}

export async function assessSite(input:string):Promise<AssessedSite>{
  const crawl=await crawlSite(input);
  const platform=detectPlatform(crawl.homeHtml,crawl.headers,crawl.pages[0]?.url||input);
  const report:AgentReadyReport=scoreReport({url:crawl.pages[0].url,pages:crawl.pages,platform,
    robots:crawl.robots,llms:crawl.llms,sitemap:crawl.sitemap});
  return {...report,readiness:assessReadiness(crawl,platform)};
}
