import {beforeEach,describe,expect,it,vi,afterEach} from 'vitest';
import worker from '../src/index';
import {rateLimit} from '../src/db';
import {fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});
afterEach(()=>vi.useRealTimers());

describe('rateLimit',()=>{
  it('allows up to the limit and rejects beyond it',async()=>{
    for(let i=1;i<=3;i++){
      const r=await rateLimit(env,'scan','1.2.3.4',3,60000);
      expect(r.ok,`call ${i}`).toBe(true);
      expect(r.count).toBe(i);
    }
    expect((await rateLimit(env,'scan','1.2.3.4',3,60000)).ok).toBe(false);
  });
  it('counts each key separately',async()=>{
    await rateLimit(env,'scan','a',1,60000);
    expect((await rateLimit(env,'scan','a',1,60000)).ok).toBe(false);
    expect((await rateLimit(env,'scan','b',1,60000)).ok).toBe(true);
  });
  it('counts each kind separately',async()=>{
    await rateLimit(env,'scan','a',1,60000);
    expect((await rateLimit(env,'events','a',1,60000)).ok).toBe(true);
  });
  it('resets in the next window',async()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'));
    await rateLimit(env,'scan','ip',1,60000);
    expect((await rateLimit(env,'scan','ip',1,60000)).ok).toBe(false);
    vi.setSystemTime(new Date('2026-01-01T00:01:30Z'));
    expect((await rateLimit(env,'scan','ip',1,60000)).ok).toBe(true);
  });
  it('reports a retry-after within the window length',async()=>{
    const r=await rateLimit(env,'scan','ip',1,60000);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });
  it('sweeps expired buckets',async()=>{
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await rateLimit(env,'scan','old',5,60000);
    vi.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    await rateLimit(env,'scan','new',5,60000);
    const buckets=sqlite.prepare('select bucket from rate_buckets').all().map((r:any)=>r.bucket);
    expect(buckets.some((b:string)=>b.includes(':old:'))).toBe(false);
  });
});

describe('/api/scan gating',()=>{
  const post=(url:string,ip='9.9.9.9')=>worker.fetch(new Request('https://agentcart.example/api/scan',{
    method:'POST',body:JSON.stringify({url}),headers:{'content-type':'application/json','cf-connecting-ip':ip}}),env);

  it('rejects a private-network target without fetching',async()=>{
    const res=await post('http://127.0.0.1/');
    expect(res.status).toBe(400);
    expect((await res.json() as any).error).toMatch(/IP addresses/);
  });
  it('rejects a non-http scheme',async()=>{
    expect((await post('file:///etc/passwd')).status).toBe(400);
  });
  it('returns 429 with retry-after once the limit is passed',async()=>{
    for(let i=0;i<10;i++)await post('http://127.0.0.1/');
    const res=await post('http://127.0.0.1/');
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
  it('limits per IP, not globally',async()=>{
    for(let i=0;i<11;i++)await post('http://127.0.0.1/','1.1.1.1');
    expect((await post('http://127.0.0.1/','2.2.2.2')).status).toBe(400);
  });
});

describe('/scan gating',()=>{
  it('renders an HTML error page rather than JSON',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/scan?url=http://127.0.0.1/',{
      headers:{'cf-connecting-ip':'5.5.5.5'}}),env);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body=await res.text();
    expect(body).toContain('AgentCart');
    expect(body).not.toContain('{"error"');
  });
  it('escapes the error message into the page',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/scan?url='+encodeURIComponent('javascript:alert(1)'),{
      headers:{'cf-connecting-ip':'6.6.6.6'}}),env);
    const body=await res.text();
    expect(body).not.toContain('<script>alert');
  });
});
