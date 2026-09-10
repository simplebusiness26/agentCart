import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {fakeEnv} from './helpers/env';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';

let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});
afterEach(()=>vi.unstubAllGlobals());

function mockSite(routes:Record<string,string>){
  vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
    const p=new URL(String(input)).pathname;
    return p in routes?new Response(routes[p],{status:200}):new Response('',{status:404});
  }));
}
const SITE={
  '/':F.RICH_HOME,'/robots.txt':'User-agent: *\nAllow: /','/sitemap.xml':'<urlset/>',
  '/products/merino-base-layer':F.RICH_PRODUCT,'/collections/base-layers':F.RICH_HOME,
  '/pages/contact':F.CONTACT_PAGE,
  '/policies/shipping-policy':F.POLICY_PAGE('Delivery','Ships in two working days.'),
  '/policies/refund-policy':F.POLICY_PAGE('Returns','Thirty day returns.'),
  '/policies/privacy-policy':F.POLICY_PAGE('Privacy','What we store.'),
  '/pages/faq':F.POLICY_PAGE('FAQ','Sizing questions.')
};

const scan=(url:string,ip='1.2.3.4')=>worker.fetch(new Request('https://agentcart.example/api/scan',{
  method:'POST',body:JSON.stringify({url}),headers:{'content-type':'application/json','cf-connecting-ip':ip}}),env);
const get=(path:string)=>worker.fetch(new Request(`https://agentcart.example${path}`),env);

describe('POST /api/scan',()=>{
  it('returns a full Agent Ready report',async()=>{
    mockSite(SITE);
    const res=await scan('https://example.com');
    expect(res.status).toBe(200);
    const body:any=await res.json();
    expect(body.score).toBeGreaterThan(0);
    expect(body.scoringVersion).toBeTruthy();
    expect(body.categories.length).toBe(5);
    expect(body.capabilities.canUnderstand.length).toBeGreaterThan(0);
    expect(body.pages.length).toBeGreaterThan(3);
    expect(body.runId).toBeTruthy();
  });

  it('persists the run so it can be fetched again',async()=>{
    mockSite(SITE);
    await scan('https://example.com');
    const res=await get('/api/report/example.com');
    expect(res.status).toBe(200);
    const body:any=await res.json();
    expect(body.comparison.latest.score).toBeGreaterThan(0);
    expect(body.findings.length).toBeGreaterThan(10);
  });

  it('reports a delta on the second scan of the same site',async()=>{
    mockSite(SITE);
    await scan('https://example.com');
    await scan('https://example.com');
    const body:any=await (await get('/api/report/example.com')).json();
    expect(body.comparison.previous).toBeTruthy();
    expect(body.comparison.comparable).toBe(true);
    expect(typeof body.comparison.delta).toBe('number');
  });

  it('refuses a private-network target and records the failure',async()=>{
    mockSite(SITE);
    const res=await scan('http://127.0.0.1/');
    expect(res.status).toBe(400);
    expect(sqlite.prepare("select count(*) c from scan_runs where status='failed'").get().c).toBe(1);
  });

  it('records a failure when the site cannot be reached',async()=>{
    mockSite({});
    const res=await scan('https://example.com');
    expect(res.status).toBe(400);
    const row=sqlite.prepare("select domain,error from scan_runs where status='failed'").get();
    expect(row.domain).toBe('example.com');
    expect(row.error).toBeTruthy();
  });

  it('is rate limited',async()=>{
    mockSite(SITE);
    for(let i=0;i<10;i++)await scan('https://example.com','9.9.9.9');
    expect((await scan('https://example.com','9.9.9.9')).status).toBe(429);
  });
});

describe('GET /api/report and /api/history',()=>{
  it('404s a domain that has never been scanned',async()=>{
    expect((await get('/api/report/never-scanned.example')).status).toBe(404);
  });
  it('returns an empty history rather than an error for an unknown domain',async()=>{
    const body:any=await (await get('/api/history/never-scanned.example')).json();
    expect(body.history).toEqual([]);
  });
  it('returns history newest first',async()=>{
    mockSite(SITE);
    await scan('https://example.com');
    await scan('https://example.com');
    const body:any=await (await get('/api/history/example.com')).json();
    expect(body.history.length).toBe(2);
    expect(Number(body.history[0].started_ms)).toBeGreaterThanOrEqual(Number(body.history[1].started_ms));
  });
});

describe('GET /scan renders the report page',()=>{
  it('returns an HTML Agent Ready report',async()=>{
    mockSite(SITE);
    const res=await worker.fetch(new Request('https://agentcart.example/scan?url=example.com',{
      headers:{'cf-connecting-ip':'4.4.4.4'}}),env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body=await res.text();
    expect(body).toContain('Agent Ready score');
    expect(body).toContain('What AI can and cannot understand');
    expect(body).toContain('Score breakdown');
  });

  it('shows the delta on a repeat scan',async()=>{
    mockSite(SITE);
    const req=()=>worker.fetch(new Request('https://agentcart.example/scan?url=example.com',{
      headers:{'cf-connecting-ip':'4.4.4.5'}}),env);
    await req();
    expect(await (await req()).text()).toContain('since your last scan');
  });

  it('renders an error page for an unreachable site',async()=>{
    mockSite({});
    const res=await worker.fetch(new Request('https://agentcart.example/scan?url=example.com',{
      headers:{'cf-connecting-ip':'4.4.4.6'}}),env);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('home page reflects the Agent Ready product',()=>{
  it('leads with the readiness question, not attribution',async()=>{
    const body=await (await worker.fetch(new Request('https://agentcart.example/'),env)).text();
    expect(body).toContain('Can AI customers understand your business?');
    expect(body).toContain('Check my website');
  });
  it('still offers the attribution dashboard as a secondary benefit',async()=>{
    const body=await (await worker.fetch(new Request('https://agentcart.example/'),env)).text();
    expect(body).toContain('demo dashboard');
    expect(body).toContain('rather than guessing');
  });
});
