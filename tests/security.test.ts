import {beforeEach,describe,expect,it} from 'vitest';
import worker from '../src/index';
import {saveShop,setIngestToken} from '../src/db';
import {fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

let env:Env;
beforeEach(()=>{env=fakeEnv().env;});
const get=(p:string,h:Record<string,string>={})=>worker.fetch(new Request(`https://agentcart.example${p}`,{headers:h}),env);

describe('CORS preflight matches what the pixel actually sends',()=>{
  it('allows the ingest token header',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/events',{method:'OPTIONS'}),env);
    const allowed=(res.headers.get('access-control-allow-headers')||'').toLowerCase();
    // Without this the browser blocks every pixel request before it is sent, because a
    // custom request header triggers a preflight.
    expect(allowed).toContain('x-agentcart-token');
    expect(allowed).toContain('content-type');
  });
  it('allows POST',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/events',{method:'OPTIONS'}),env);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
  it('an event with the token header is accepted end to end',async()=>{
    await saveShop(env,'demo.myshopify.com','tok');
    await setIngestToken(env,'demo.myshopify.com','tk');
    const res=await worker.fetch(new Request('https://agentcart.example/api/events',{method:'POST',
      headers:{'content-type':'application/json','x-agentcart-token':'tk'},
      body:JSON.stringify({shop:'demo.myshopify.com',eventId:'x',eventType:'page_viewed',occurredAt:new Date().toISOString()})}),env);
    expect(res.status).toBe(202);
  });
});

describe('response headers',()=>{
  it('HTML pages carry a content security policy and framing protection',async()=>{
    const res=await get('/');
    const csp=res.headers.get('content-security-policy')||'';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
  it('JSON responses are not cached',async()=>{
    expect((await get('/health')).headers.get('cache-control')).toBe('no-store');
  });
});

describe('authenticated routes reject anonymous callers',()=>{
  it.each([
    ['/api/dashboard','GET'],['/api/sync','POST'],['/api/sync/status','GET'],
    ['/api/ai-layer','GET'],['/api/fixes','GET'],['/api/fixes/propose','POST'],
    ['/api/fixes/abc/apply','POST'],['/api/monitoring','GET']
  ])('%s %s returns 401',async(path,method)=>{
    const res=await worker.fetch(new Request(`https://agentcart.example${path}`,{method}),env);
    expect(res.status).toBe(401);
  });
});

describe('public read routes are rate limited',()=>{
  it('caps report lookups per client',async()=>{
    let last=200;
    for(let i=0;i<62;i++)last=(await get('/api/report/example.com',{'cf-connecting-ip':'7.7.7.7'})).status;
    expect(last).toBe(429);
  });
  it('caps history lookups per client',async()=>{
    let last=200;
    for(let i=0;i<62;i++)last=(await get('/api/history/example.com',{'cf-connecting-ip':'8.8.8.8'})).status;
    expect(last).toBe(429);
  });
});

describe('unknown routes',()=>{
  it('404 rather than falling through to anything',async()=>{
    for(const p of ['/admin','/api','/api/','/ai','/api/ai','/../etc/passwd','/api/fixes/'])
      expect((await get(p)).status,p).toBeGreaterThanOrEqual(400);
  });
});
