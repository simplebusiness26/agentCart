import {afterEach,describe,expect,it,vi} from 'vitest';
import {assessSite} from '../src/agentready';
import {crawlSite} from '../src/agentready/crawl';
import {callPublicTool} from '../src/public/tools';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';

// Phases 10 and 12 built readiness assessors that the real scan path never called: assessSite
// only crawled and scored, and the one caller fed them empty strings. These pin the wiring, so
// a scan that reports nothing about discovery, safety, payment or interaction fails here.

function mockNet(routes:Record<string,{body?:string;status?:number;headers?:Record<string,string>}>){
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
    const url=new URL(String(input));
    calls.push(url.pathname);
    const r=routes[url.pathname];
    if(!r)return new Response('',{status:404});
    return new Response(r.body??'',{status:r.status??200,headers:r.headers??{}});
  }));
  return calls;
}
afterEach(()=>vi.unstubAllGlobals());

const UCP=JSON.stringify({ucp:{version:'2026-03-01',
  services:{'dev.ucp.catalog':{transport:'rest',endpoint:'https://shop.example/api'}},
  capabilities:{'dev.ucp.catalog.browse':{}}}});

const SITE={
  '/':{body:F.RICH_HOME},
  '/robots.txt':{body:'User-agent: *\nAllow: /'},
  '/sitemap.xml':{body:'<urlset/>'},
  '/agents.md':{body:'# Northbound\nWe sell outdoor gear.'},
  '/llms.txt':{body:'# Northbound'},
  '/llms-full.txt':{body:'# Northbound\nFull text.'},
  '/.well-known/ucp':{body:UCP},
  '/products/merino-base-layer':{body:F.RICH_PRODUCT},
  '/pages/contact':{body:F.CONTACT_PAGE}
};

describe('the crawl fetches every discovery file',()=>{
  it('requests agents.md, llms-full.txt and the UCP manifest',async()=>{
    const calls=mockNet(SITE);
    await crawlSite('https://shop.example');
    for(const p of ['/agents.md','/llms-full.txt','/.well-known/ucp'])
      expect(calls).toContain(p);
  });

  it('parses a published UCP manifest from the live site',async()=>{
    mockNet(SITE);
    const crawl=await crawlSite('https://shop.example');
    expect(crawl.discovery.ucp_manifest?.ok).toBe(true);
    expect(crawl.discovery.ucp_manifest?.body).toContain('dev.ucp.catalog');
  });

  it('does not read an HTML catch-all page as a published file',async()=>{
    // Many sites answer every unknown path with a 200 marketing page. Treating that as a
    // published manifest would report "published but broken" about a file that does not exist.
    mockNet({...SITE,'/.well-known/ucp':{body:'<!doctype html><h1>Page not found</h1>',
      headers:{'content-type':'text/html; charset=utf-8'}}});
    const crawl=await crawlSite('https://shop.example');
    expect(crawl.discovery.ucp_manifest?.ok).toBe(false);
  });
});

describe('a real scan runs the readiness layers',()=>{
  it('reports discovery findings for every known file',async()=>{
    mockNet(SITE);
    const report=await assessSite('https://shop.example');
    const paths=report.readiness.discovery.map(d=>d.path);
    expect(paths).toEqual(expect.arrayContaining(
      ['/agents.md','/llms.txt','/llms-full.txt','/sitemap.xml','/.well-known/ucp']));
    // Nothing may sit at "unknown", which is the state meaning "not checked".
    expect(report.readiness.discovery.every(d=>d.state!=='unknown')).toBe(true);
    expect(report.readiness.discovery.find(d=>d.kind==='agents_md')!.state).toBe('pass');
  });

  it('assesses safety, payment and interaction against the real page, not an empty string',async()=>{
    mockNet(SITE);
    const report=await assessSite('https://shop.example');
    expect(report.readiness.interaction.length).toBeGreaterThan(0);
    expect(report.readiness.payment.stages.length).toBeGreaterThan(0);
    expect(report.readiness.safety).toBeTruthy();
    // Evidence strings are drawn from the page, so an empty input would leave them all blank.
    expect(report.readiness.interaction.some(s=>s.evidence.length>0)).toBe(true);
  });

  it('reads provider access from the site own robots.txt',async()=>{
    mockNet({...SITE,'/robots.txt':{body:'User-agent: OAI-SearchBot\nDisallow: /'}});
    const report=await assessSite('https://shop.example');
    expect(report.readiness.providers.length).toBeGreaterThan(0);
    const blocked=report.readiness.providers.filter(p=>p.discovery==='fail');
    expect(blocked.length).toBeGreaterThan(0);
  });
});

describe('the public MCP surface returns real answers',()=>{
  const env={} as Env;

  it('scan_site reports standards computed from the scanned site',async()=>{
    mockNet(SITE);
    const out:any=await callPublicTool(env,'scan_site',{url:'https://shop.example'});
    expect(out.error).toBeUndefined();
    expect(out.agentStandards.applicable).toBeGreaterThan(0);
    expect(out.discovery.some((d:any)=>d.path==='/agents.md'&&d.state==='pass')).toBe(true);
  });

  it('get_agent_standards never returns an empty check list',async()=>{
    const out:any=await callPublicTool(env,'get_agent_standards',{});
    // The old shape ended in .slice(0,0) and shipped checks:[] to every caller.
    expect(out.checks).toBeUndefined();
    expect(Object.keys(out.discoveryPaths).length).toBeGreaterThan(0);
    expect(out.standardsGroups.length).toBeGreaterThan(0);
  });
});
