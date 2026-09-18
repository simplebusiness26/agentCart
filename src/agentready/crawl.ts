import {DISCOVERY_PATHS} from "../providers/discovery";
import type {DiscoveryKind,FetchedFile} from "../providers/discovery";
import {assertScannableUrl} from "../scanner";
import {classifyPage,extractSignals} from "./extract";
import type {PageEvidence,PageType} from "./types";

export const MAX_PAGES=10;
export const MAX_PAGE_BYTES=512_000;
export const MAX_FILE_BYTES=50_000;
export const CRAWL_BUDGET_MS=9000;

// Paths worth trying directly when a site does not link them prominently. Cheap: each is
// only fetched if we still have page budget and time left.
const CANDIDATE_PATHS:Array<[PageType,string[]]>=[
  ["contact",["/contact","/contact-us","/pages/contact"]],
  ["shipping",["/shipping","/pages/shipping","/policies/shipping-policy"]],
  ["returns",["/returns","/pages/returns","/policies/refund-policy"]],
  ["faq",["/faq","/faqs","/pages/faq"]],
  ["about",["/about","/about-us","/pages/about"]]
];

// Wanted page types in priority order. The crawl stops early once it has one of each,
// so a large site does not consume the whole budget on near-duplicates.
const WANTED:PageType[]=["product","collection","contact","shipping","returns","about","faq","policy","booking"];

export type DiscoveryFiles=Partial<Record<DiscoveryKind,FetchedFile>>;

export interface CrawlResult { pages:PageEvidence[]; homeHtml:string; headers:Record<string,string>; robots?:string; llms?:string; sitemap:boolean; discovery:DiscoveryFiles }

function sameOrigin(a:URL,b:URL){return a.protocol===b.protocol&&a.host===b.host;}

export function extractLinks(html:string,base:URL){
  const out:URL[]=[];
  for(const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)){
    const raw=m[1].trim();
    if(!raw||raw.startsWith("#")||/^(mailto|tel|javascript|data):/i.test(raw))continue;
    try{
      const u=new URL(raw,base);
      u.hash="";
      if(sameOrigin(u,base))out.push(u);
    }catch{/* an unparseable href is not worth failing the crawl over */}
  }
  return out;
}

// Picks a small, representative set rather than crawling the whole site: one page of each
// wanted type, preferring shallower URLs so we land on a category rather than a deep leaf.
export function selectTargets(links:URL[],limit:number){
  const seen=new Set<string>();
  const byType=new Map<PageType,URL>();
  const sorted=[...links].sort((a,b)=>a.pathname.split("/").length-b.pathname.split("/").length||a.pathname.length-b.pathname.length);
  for(const link of sorted){
    const key=link.toString();
    if(seen.has(key))continue;
    seen.add(key);
    const type=classifyPage(key);
    if(type==="home"||type==="other")continue;
    if(!byType.has(type))byType.set(type,link);
  }
  const ordered:URL[]=[];
  for(const want of WANTED){const u=byType.get(want);if(u)ordered.push(u);}
  return ordered.slice(0,limit);
}

async function fetchPage(url:URL,signal:AbortSignal,headers:Record<string,string>){
  const res=await fetch(url.toString(),{signal,headers,redirect:"follow"});
  const html=res.ok?(await res.text()).slice(0,MAX_PAGE_BYTES):"";
  return {res,html};
}

async function fetchFile(url:URL,signal:AbortSignal,headers:Record<string,string>):Promise<FetchedFile>{
  const res=await fetch(url.toString(),{signal,headers,redirect:"follow"});
  // None of the discovery paths is ever HTML. Many sites answer every unknown path with a
  // 200 catch-all page, which would otherwise be read as "the file is published but broken".
  const html=(res.headers.get("content-type")||"").toLowerCase().includes("text/html");
  if(!res.ok||html)return {ok:false,status:res.ok?404:res.status,body:""};
  return {ok:true,status:res.status,body:(await res.text()).slice(0,MAX_FILE_BYTES)};
}

export async function crawlSite(input:string,now=()=>Date.now()):Promise<CrawlResult>{
  const root=assertScannableUrl(input);
  const controller=new AbortController();
  const started=now();
  const timer=setTimeout(()=>controller.abort(),CRAWL_BUDGET_MS);
  const ua={"User-Agent":"AgentCartReadinessScanner/2.0 (+https://github.com/simplebusiness26/agentCart)"};
  const timeLeft=()=>CRAWL_BUDGET_MS-(now()-started)>500;
  const pages:PageEvidence[]=[];

  const record=(url:string,status:number,html:string,isRoot=false)=>{
    const signals=extractSignals(html);
    pages.push({url,pageType:classifyPage(url,isRoot),status,title:signals.title,signals});
  };

  try{
    const kinds=Object.keys(DISCOVERY_PATHS) as DiscoveryKind[];
    const [core,found]=await Promise.all([
      Promise.allSettled([
        fetchPage(root,controller.signal,ua),
        fetch(new URL("/robots.txt",root.origin),{signal:controller.signal,headers:ua})
      ]),
      Promise.allSettled(kinds.map(k=>fetchFile(new URL(DISCOVERY_PATHS[k],root.origin),controller.signal,ua)))
    ]);
    const [home,robots]=core;
    const discovery:DiscoveryFiles={};
    kinds.forEach((k,i)=>{const r=found[i];if(r.status==="fulfilled")discovery[k]=r.value;});
    if(home.status!=="fulfilled"||!home.value.res.ok)throw new Error("We could not load that website.");
    const homeHtml=home.value.html;
    const headers:Record<string,string>={};
    home.value.res.headers.forEach((v,k)=>{headers[k.toLowerCase()]=v;});
    record(root.toString(),home.value.res.status,homeHtml,true);

    const linked=selectTargets(extractLinks(homeHtml,root),MAX_PAGES-1);
    const attempted=new Set<string>([root.toString()]);
    for(const target of linked){
      if(pages.length>=MAX_PAGES||!timeLeft())break;
      if(attempted.has(target.toString()))continue;
      attempted.add(target.toString());
      try{
        const {res,html}=await fetchPage(target,controller.signal,ua);
        if(res.ok)record(target.toString(),res.status,html);
      }catch{/* one unreachable page must not fail the whole assessment */}
    }

    // Fill gaps with well-known paths for types the site did not link from the homepage.
    const have=new Set(pages.map(p=>p.pageType));
    for(const [type,paths] of CANDIDATE_PATHS){
      if(pages.length>=MAX_PAGES||!timeLeft())break;
      if(have.has(type))continue;
      for(const path of paths){
        if(!timeLeft())break;
        const candidate=new URL(path,root.origin);
        if(attempted.has(candidate.toString()))continue;
        attempted.add(candidate.toString());
        try{
          const {res,html}=await fetchPage(candidate,controller.signal,ua);
          if(res.ok&&html){record(candidate.toString(),res.status,html);have.add(type);break;}
        }catch{/* candidate paths are best effort by definition */}
      }
    }

    return {
      pages,homeHtml,headers,discovery,
      robots:robots.status==="fulfilled"&&robots.value.ok?(await robots.value.text()).slice(0,MAX_FILE_BYTES):undefined,
      llms:discovery.llms_txt?.ok?discovery.llms_txt.body:undefined,
      sitemap:!!discovery.sitemap?.ok
    };
  }finally{clearTimeout(timer);}
}
