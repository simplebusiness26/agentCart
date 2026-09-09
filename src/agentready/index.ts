import {crawlSite} from "./crawl";
import {detectPlatform} from "./platform";
import {SCORING_VERSION,scoreReport} from "./score";
import type {AgentReadyReport} from "./types";

export {SCORING_VERSION,scoreReport} from "./score";
export {detectPlatform} from "./platform";
export {crawlSite,extractLinks,selectTargets} from "./crawl";
export {classifyPage,extractSignals} from "./extract";
export * from "./types";

export async function assessSite(input:string):Promise<AgentReadyReport>{
  const crawl=await crawlSite(input);
  const platform=detectPlatform(crawl.homeHtml,crawl.headers,crawl.pages[0]?.url||input);
  return scoreReport({url:crawl.pages[0].url,pages:crawl.pages,platform,
    robots:crawl.robots,llms:crawl.llms,sitemap:crawl.sitemap});
}
