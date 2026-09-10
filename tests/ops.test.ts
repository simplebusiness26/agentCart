import {beforeEach,describe,expect,it,vi,afterEach} from 'vitest';
import worker from '../src/index';
import {connectionHealth,recentOps,recordOps} from '../src/ops';
import {PROTOCOLS,buildUcpManifest,protocolSupport} from '../src/protocol';
import {parseUcpManifest} from '../src/providers/discovery';
import {ensureProfile} from '../src/ailayer/service';
import {saveBusinessProfile,saveCatalog,recordSyncRun} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {insertEvent,saveShop,updatePixelId} from '../src/db';
import {sessionCookie} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,'tok');});
afterEach(()=>vi.unstubAllGlobals());

describe('protocol compatibility',()=>{
  it('describes web, MCP, UCP and ACP',()=>{
    expect(PROTOCOLS.map(p=>p.id).sort()).toEqual(['acp','mcp','ucp','web']);
  });
  it('is explicit about not implementing checkout or payment',()=>{
    const ucp=PROTOCOLS.find(p=>p.id==='ucp')!;
    expect(ucp.notSupported.some(n=>/checkout/i.test(n.capability))).toBe(true);
    const acp=PROTOCOLS.find(p=>p.id==='acp')!;
    expect(acp.notSupported.some(n=>/payment/i.test(n.capability))).toBe(true);
    for(const p of PROTOCOLS) for(const n of p.notSupported) expect(n.reason.length).toBeGreaterThan(15);
  });
  it('summarises support without implying it can take money',()=>{
    for(const p of protocolSupport()){
      expect(p.summary).toContain('read access');
      expect(p.summary).not.toMatch(/full checkout|processes payment/i);
    }
  });

  it('publishes a UCP manifest that parses against our own parser',async()=>{
    await saveBusinessProfile(env,SHOP,{name:'N',description:'',contactEmail:'',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://n.example',policies:[]},1000);
    const slug=await ensureProfile(env,SHOP);
    const manifest=(await buildUcpManifest(env,SHOP,slug,'https://agentcart.example'))!;
    const parsed=parseUcpManifest(JSON.stringify(manifest));
    expect(parsed.valid).toBe(true);
    expect(parsed.services[0].transport).toBe('rest');
  });

  it('advertises no checkout capability and no payment handlers',async()=>{
    await saveBusinessProfile(env,SHOP,{name:'N',description:'',contactEmail:'',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://n.example',policies:[]},1000);
    const slug=await ensureProfile(env,SHOP);
    const manifest:any=await buildUcpManifest(env,SHOP,slug,'https://agentcart.example');
    expect(Object.keys(manifest.ucp.capabilities).some(c=>/checkout/i.test(c))).toBe(false);
    expect(manifest.ucp.payment_handlers).toBeUndefined();
  });

  it('serves the manifest publicly',async()=>{
    await saveBusinessProfile(env,SHOP,{name:'N',description:'',contactEmail:'',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://n.example',policies:[]},1000);
    const slug=await ensureProfile(env,SHOP);
    const res=await worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/ucp`),env);
    expect(res.status).toBe(200);
    expect(parseUcpManifest(await res.text()).valid).toBe(true);
  });

  it('lists protocol support without a session',async()=>{
    const body:any=await (await worker.fetch(new Request('https://agentcart.example/api/protocols'),env)).json();
    expect(body.protocols.length).toBe(4);
    expect(body.note).toContain('does not process payments');
  });
});

describe('operational events',()=>{
  it('records and reads back',async()=>{
    await recordOps(env,'sync.initial','error','it broke',{shop:SHOP});
    const recent=await recentOps(env,SHOP);
    expect(recent[0].kind).toBe('sync.initial');
    expect(recent[0].message).toBe('it broke');
  });
  it('redacts credentials before storing',async()=>{
    await recordOps(env,'sync.initial','error','failed with shpat_abcdef0123456789abcdef',{shop:SHOP});
    const dump=JSON.stringify(sqlite.prepare('select * from ops_events').all());
    expect(dump).not.toContain('shpat_abcdef0123456789abcdef');
    expect(dump).toContain('[redacted]');
  });
  it('never breaks the request it is observing',async()=>{
    const broken={...env,DB:{prepare(){throw new Error('db down');}}} as any;
    await expect(recordOps(broken,'x','error','y',{shop:SHOP})).resolves.toBeUndefined();
  });
});

describe('connection health self-diagnosis',()=>{
  it('reports a disconnected store as broken',async()=>{
    const h=await connectionHealth(env,'ghost.myshopify.com');
    expect(h.overall).toBe('broken');
    expect(h.checks[0].fix).toContain('Reinstall');
  });

  it('flags a missing pixel as degraded with a real fix',async()=>{
    const h=await connectionHealth(env,SHOP);
    const pixel=h.checks.find(c=>c.key==='pixel')!;
    expect(pixel.state).toBe('degraded');
    expect(pixel.fix).toContain('Customer events');
  });

  it('reports healthy when everything is in place',async()=>{
    await updatePixelId(env,SHOP,'gid://shopify/WebPixel/1');
    await insertEvent(env,{shop:SHOP,eventId:'e1',eventType:'page_viewed',
      occurredAt:new Date().toISOString()},'ChatGPT','chatgpt.com');
    await recordSyncRun(env,SHOP,'full','complete',5,null);
    await saveBusinessProfile(env,SHOP,{name:'N',description:'',contactEmail:'',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://n.example',policies:[]},1000);
    await ensureProfile(env,SHOP);
    const h=await connectionHealth(env,SHOP);
    expect(h.overall).toBe('ok');
    expect(h.summary).toContain('healthy');
  });

  it('flags stale events',async()=>{
    await updatePixelId(env,SHOP,'p');
    const old=Date.now()-30*86400000;
    await insertEvent(env,{shop:SHOP,eventId:'old',eventType:'page_viewed',
      occurredAt:new Date(old).toISOString()},'ChatGPT','');
    const h=await connectionHealth(env,SHOP);
    const events=h.checks.find(c=>c.key==='events')!;
    expect(events.state).toBe('degraded');
    expect(events.detail).toContain('days ago');
  });

  it('surfaces a missing permission as broken, with reconnect as the fix',async()=>{
    await recordSyncRun(env,SHOP,'full','needs_reauthorization',0,'scope missing');
    const sync=(await connectionHealth(env,SHOP)).checks.find(c=>c.key==='sync')!;
    expect(sync.state).toBe('broken');
    expect(sync.fix).toContain('Reconnect');
  });

  it('gives every check a fix in the merchant own words',async()=>{
    for(const c of (await connectionHealth(env,SHOP)).checks){
      expect(c.fix.length,c.key).toBeGreaterThan(5);
      expect(c.detail.length,c.key).toBeGreaterThan(10);
      expect(c.label,c.key).not.toMatch(/null|undefined|json/i);
    }
  });

  it('is served over an authenticated route',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/health/connection'),env)).status).toBe(401);
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    const res=await worker.fetch(new Request('https://agentcart.example/api/health/connection',{headers:{cookie}}),env);
    expect(res.status).toBe(200);
    expect((await res.json() as any).checks.length).toBeGreaterThan(3);
  });
});
