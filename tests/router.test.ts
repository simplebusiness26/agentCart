import {beforeEach,describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import worker,{aiSource} from '../src/index';
import {saveShop} from '../src/db';
import {sessionCookie} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});

const get=(path:string,headers:Record<string,string>={})=>
  worker.fetch(new Request(`https://agentcart.example${path}`,{headers}),env);
const post=(path:string,body:unknown,headers:Record<string,string>={})=>
  worker.fetch(new Request(`https://agentcart.example${path}`,{method:'POST',body:typeof body==='string'?body:JSON.stringify(body),headers:{'content-type':'application/json',...headers}}),env);

describe('aiSource',()=>{
  it('classifies each known AI surface',()=>{
    const cases:[string,string][]=[
      ['https://chatgpt.com/c/1','ChatGPT'],
      ['https://chat.openai.com/','ChatGPT'],
      ['https://claude.ai/chat/x','Claude'],
      ['https://www.perplexity.ai/search','Perplexity'],
      ['https://gemini.google.com/app','Gemini'],
      ['https://copilot.microsoft.com/','Microsoft Copilot'],
      ['https://meta.ai/','Meta AI']
    ];
    for(const [ref,agent] of cases) expect(aiSource(ref).agent,ref).toBe(agent);
  });
  it('matches subdomains but not lookalike suffixes',()=>{
    expect(aiSource('https://sub.claude.ai/x').agent).toBe('Claude');
    expect(aiSource('https://claude.ai.evil.com/x').agent).toBe('Other referral');
  });
  it('does not guess unknown referrers',()=>{
    expect(aiSource('https://google.com/search').agent).toBe('Other referral');
  });
  it('reports direct when there is no referrer',()=>{
    expect(aiSource(undefined).agent).toBe('Direct / unknown');
    expect(aiSource('').agent).toBe('Direct / unknown');
  });
  it('does not throw on a malformed referrer',()=>{
    expect(aiSource('not a url').agent).toBe('Direct / unknown');
  });
});

describe('public routes',()=>{
  it('serves the marketing pages as HTML',async()=>{
    for(const p of ['/','/privacy','/terms','/setup']){
      const res=await get(p);
      expect(res.status,p).toBe(200);
      expect(res.headers.get('content-type'),p).toContain('text/html');
    }
  });
  it('sets defensive headers on HTML responses',async()=>{
    const res=await get('/');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
  it('reports health',async()=>{
    const res=await get('/health');
    expect(res.status).toBe(200);
    expect((await res.json() as any).ok).toBe(true);
  });
  it('404s an unknown path',async()=>{
    expect((await get('/nope')).status).toBe(404);
  });
});

describe('/api/dashboard',()=>{
  it('serves demo data without a session',async()=>{
    const res=await get('/api/dashboard?demo=1');
    expect(res.status).toBe(200);
    const body:any=await res.json();
    expect(body.summary.orders).toBeGreaterThan(0);
    expect(Array.isArray(body.sources)).toBe(true);
  });
  it('401s without a session',async()=>{
    expect((await get('/api/dashboard')).status).toBe(401);
  });
  it('serves live data with a valid session cookie',async()=>{
    await saveShop(env,SHOP,'tok');
    const cookie=(await sessionCookie(TEST_SECRET,SHOP)).split(';')[0];
    const res=await get('/api/dashboard',{cookie});
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('summary');
  });
});

describe('/api/events',()=>{
  it('answers the CORS preflight',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/events',{method:'OPTIONS'}),env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
  it('rejects an event for an unknown shop',async()=>{
    const res=await post('/api/events',{shop:SHOP,eventId:'e',eventType:'page_viewed',occurredAt:new Date().toISOString()});
    expect(res.status).toBe(404);
  });
  it('rejects an invalid shop domain',async()=>{
    const res=await post('/api/events',{shop:'evil.com',eventId:'e',eventType:'page_viewed',occurredAt:new Date().toISOString()});
    expect(res.status).toBe(400);
  });
  it('rejects a payload missing required fields',async()=>{
    const res=await post('/api/events',{shop:SHOP});
    expect(res.status).toBe(400);
  });
  it('accepts and stores a valid event for an installed shop',async()=>{
    await saveShop(env,SHOP,'tok');
    const res=await post('/api/events',{shop:SHOP,eventId:'ok1',eventType:'page_viewed',occurredAt:new Date().toISOString(),referrer:'https://chatgpt.com/'});
    expect(res.status).toBe(202);
    expect(sqlite.prepare('select source_agent from events where event_id=?').get('ok1').source_agent).toBe('ChatGPT');
  });
  it('rejects malformed JSON',async()=>{
    const res=await post('/api/events','{not json');
    expect(res.status).toBe(400);
  });
});

describe('/connect',()=>{
  it('rejects an invalid shop domain',async()=>{
    expect((await get('/connect?shop=evil.com')).status).toBe(400);
  });
  it('503s when Shopify credentials are unset',async()=>{
    const f=fakeEnv({SHOPIFY_API_KEY:'',SHOPIFY_API_SECRET:''});
    const res=await worker.fetch(new Request('https://agentcart.example/connect?shop=demo.myshopify.com'),f.env);
    expect(res.status).toBe(503);
  });
});

describe('/api/shopify/webhooks',()=>{
  const sign=(body:string)=>createHmac('sha256',TEST_SECRET).update(body).digest('base64');
  it('rejects an unsigned webhook',async()=>{
    const res=await post('/api/shopify/webhooks',{},{'x-shopify-topic':'app/uninstalled'});
    expect(res.status).toBe(401);
  });
  it('rejects a bad signature',async()=>{
    const res=await post('/api/shopify/webhooks',{},{'x-shopify-hmac-sha256':'bad','x-shopify-topic':'app/uninstalled'});
    expect(res.status).toBe(401);
  });
  it('uninstall removes the shop',async()=>{
    await saveShop(env,SHOP,'tok');
    const body=JSON.stringify({shop_domain:SHOP});
    const res=await worker.fetch(new Request('https://agentcart.example/api/shopify/webhooks',{
      method:'POST',body,
      headers:{'content-type':'application/json','x-shopify-hmac-sha256':sign(body),'x-shopify-topic':'app/uninstalled','x-shopify-shop-domain':SHOP}
    }),env);
    expect(res.status).toBe(200);
    expect(sqlite.prepare('select count(*) c from shops where shop_domain=?').get(SHOP).c).toBe(0);
  });
});
