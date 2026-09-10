import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {PUBLIC_TOOLS,agentCartAgentsMd,callPublicTool} from '../src/public/tools';
import {buildOutcome,LAYER_NOTE} from '../src/outcome';
import {ensureProfile} from '../src/ailayer/service';
import {saveBusinessProfile,saveCatalog} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {encryptToken,sessionCookie} from '../src/shopify';
import {insertEvent,saveOrder,saveShop,setIngestToken} from '../src/db';
import {TEST_KEY,TEST_SECRET,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,await encryptToken('shpat_secret',TEST_KEY));});
afterEach(()=>vi.unstubAllGlobals());

const rpc=(body:unknown)=>worker.fetch(new Request('https://agentcart.example/api/mcp',{method:'POST',
  body:JSON.stringify(body),headers:{'content-type':'application/json'}}),env);

function mockSite(routes:Record<string,string>){
  vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
    const p=new URL(String(input)).pathname;
    return p in routes?new Response(routes[p],{status:200}):new Response('',{status:404});
  }));
}

describe('every public tool is read-only',()=>{
  it('no tool name implies mutation',()=>{
    for(const t of PUBLIC_TOOLS)expect(t.name,t.name).toMatch(/^(scan|get|list|search)_/);
  });
  it('there is no async scan tool pretending a background job exists',()=>{
    const names:string[]=PUBLIC_TOOLS.map(t=>t.name);
    expect(names).not.toContain('get_scan_result');
    expect(PUBLIC_TOOLS.find(t=>t.name==='scan_site')!.description).toContain('Synchronous');
  });
  it('public tools cannot reach a merchant mutation',async()=>{
    for(const t of PUBLIC_TOOLS){
      const result:any=await callPublicTool(env,t.name,{url:'https://example.com',slug:'x'}).catch(e=>({error:String(e)}));
      const text=JSON.stringify(result||{});
      expect(text,t.name).not.toContain('shpat_secret');
    }
  });
});

describe('scan_site',()=>{
  it('returns a usable readiness summary',async()=>{
    mockSite({'/':F.RICH_HOME,'/robots.txt':'User-agent: *\nAllow: /','/sitemap.xml':'<urlset/>',
      '/products/merino-base-layer':F.RICH_PRODUCT,'/pages/contact':F.CONTACT_PAGE});
    const r:any=await callPublicTool(env,'scan_site',{url:'https://example.com'});
    expect(r.score).toBeGreaterThan(0);
    expect(r.grade).toBeTruthy();
    expect(r.categories.length).toBe(5);
    expect(r.topFixes.length).toBeGreaterThan(0);
    expect(r.caveat).toContain('does not prove');
  });
  it('refuses private-network targets',async()=>{
    mockSite({});
    await expect(callPublicTool(env,'scan_site',{url:'http://127.0.0.1/'})).rejects.toThrow(/IP addresses/);
  });
  it('requires a url',async()=>{
    expect((await callPublicTool(env,'scan_site',{}) as any).error).toBeTruthy();
  });
});

describe('public MCP surface',()=>{
  it('lists tools and initializes',async()=>{
    const init:any=await (await rpc({jsonrpc:'2.0',id:1,method:'initialize'})).json();
    expect(init.result.serverInfo.name).toBe('agentcart');
    const list:any=await (await rpc({jsonrpc:'2.0',id:2,method:'tools/list'})).json();
    expect(list.result.tools.length).toBe(PUBLIC_TOOLS.length);
  });
  it('rejects an unknown tool and a bad envelope',async()=>{
    expect(((await (await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'delete_store'}})).json()) as any).error.code).toBe(-32602);
    expect(((await (await rpc({method:'tools/list'})).json()) as any).error.code).toBe(-32600);
  });
  it('is rate limited',async()=>{
    let last=200;
    for(let i=0;i<32;i++)last=(await rpc({jsonrpc:'2.0',id:i,method:'ping'})).status;
    expect(last).toBe(429);
  });
  it('describes protocols honestly',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:9,method:'tools/call',
      params:{name:'get_supported_protocols',arguments:{}}})).json();
    const out=JSON.parse(r.result.content[0].text);
    expect(out.note).toContain('does not process payments');
    expect(out.protocols.every((p:any)=>p.notSupported.length>0)).toBe(true);
  });
  it('explains what each state means',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:10,method:'tools/call',
      params:{name:'get_agent_standards',arguments:{}}})).json();
    const out=JSON.parse(r.result.content[0].text);
    expect(out.stateMeanings.not_available_in_region).toContain('Not a merchant failing');
  });
  it('serves a published profile but not private data',async()=>{
    await setIngestToken(env,SHOP,'ingest-secret');
    await saveBusinessProfile(env,SHOP,{name:'N',description:'',contactEmail:'a@b.example',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://n.example',policies:[]},1000);
    await saveCatalog(env,SHOP,[normalizeProduct(S.productNode(1),SHOP)],1000);
    const slug=await ensureProfile(env,SHOP);
    const r:any=await (await rpc({jsonrpc:'2.0',id:11,method:'tools/call',
      params:{name:'get_public_ai_profile',arguments:{slug}}})).json();
    const text=r.result.content[0].text;
    expect(text).toContain('N');
    for(const secret of ['shpat_secret','ingest-secret',SHOP])
      expect(text,`leaked ${secret}`).not.toContain(secret);
  });
});

describe('AgentCart publishes its own agents.md',()=>{
  it('is served at the well-known paths',async()=>{
    for(const p of ['/agents.md','/.well-known/agents.md']){
      const res=await worker.fetch(new Request(`https://agentcart.example${p}`),env);
      expect(res.status,p).toBe(200);
      expect(res.headers.get('content-type'),p).toContain('text/markdown');
    }
  });
  it('states what an agent cannot do here',()=>{
    const md=agentCartAgentsMd('https://agentcart.example');
    expect(md).toContain('What you cannot do here');
    expect(md).toContain('read-only');
    expect(md).toContain('never transacts');
  });
  it('lists every public tool',()=>{
    const md=agentCartAgentsMd('https://agentcart.example');
    for(const t of PUBLIC_TOOLS)expect(md,t.name).toContain(t.name);
  });
});

describe('outcome view',()=>{
  it('keeps the five layers separate',async()=>{
    const o=await buildOutcome(env,SHOP,null);
    expect(o.note).toBe(LAYER_NOTE);
    expect(LAYER_NOTE).toContain('never merged into a single number');
    expect(o).toHaveProperty('readiness');
    expect(o).toHaveProperty('visibility');
    expect(o).toHaveProperty('customers');
  });

  it('separates verified from reported revenue and keeps unknown honest',async()=>{
    const now=Date.now();
    await saveOrder(env,SHOP,'1','1',100,'GBP',now);
    await saveOrder(env,SHOP,'2','2',40,'GBP',now);
    sqlite.prepare("update orders set source_tier='verified' where order_id='1'").run();
    sqlite.prepare("update orders set source_tier='unknown' where order_id='2'").run();
    const o=await buildOutcome(env,SHOP,null);
    expect(o.northStar.verifiedRevenue).toBe(100);
    expect(o.northStar.unattributed).toBe(40);
    expect(o.customers.tiers.length).toBeGreaterThan(3);
  });

  it('says plainly when there is no verified revenue yet',async()=>{
    const o=await buildOutcome(env,SHOP,null);
    expect(o.northStar.verifiedRevenue).toBe(0);
    expect(o.northStar.note).toContain('No verified AI revenue yet');
    expect(o.northStar.note).toContain('browser can be made to say anything');
  });

  it('names the north star as customers and verified revenue, not the score',async()=>{
    const o=await buildOutcome(env,SHOP,null);
    expect(o.northStar.label).toContain('verified AI-attributed revenue');
  });

  it('is served over an authenticated route',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/outcome'),env)).status).toBe(401);
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    expect((await worker.fetch(new Request('https://agentcart.example/api/outcome',{headers:{cookie}}),env)).status).toBe(200);
  });
});
