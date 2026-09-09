import {beforeEach,describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import worker from '../src/index';
import {countOrders,getVerifiedSources,insertEvent,saveOrder,saveShop,setIngestToken} from '../src/db';
import {normalizeOrderId} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});

const send=(body:unknown,headers:Record<string,string>={})=>worker.fetch(new Request('https://agentcart.example/api/events',{
  method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json',...headers}}),env);
const event=(o:Record<string,unknown>={})=>({shop:SHOP,eventId:'e'+Math.random(),eventType:'page_viewed',occurredAt:new Date().toISOString(),...o});

describe('ingest token',()=>{
  it('accepts the correct token',async()=>{
    await saveShop(env,SHOP,'tok'); await setIngestToken(env,SHOP,'secret-token');
    expect((await send(event(),{'x-agentcart-token':'secret-token'})).status).toBe(202);
  });
  it('rejects a wrong or missing token',async()=>{
    await saveShop(env,SHOP,'tok'); await setIngestToken(env,SHOP,'secret-token');
    expect((await send(event(),{'x-agentcart-token':'wrong'})).status).toBe(401);
    expect((await send(event())).status).toBe(401);
  });
  it('does not lock out a shop installed before tokens existed',async()=>{
    await saveShop(env,SHOP,'tok');
    expect((await send(event())).status).toBe(202);
  });
  it('a token for one shop does not work for another',async()=>{
    await saveShop(env,SHOP,'tok'); await setIngestToken(env,SHOP,'token-a');
    await saveShop(env,'other.myshopify.com','tok'); await setIngestToken(env,'other.myshopify.com','token-b');
    expect((await send(event({shop:SHOP}),{'x-agentcart-token':'token-b'})).status).toBe(401);
  });
});

describe('ingest rate limiting',()=>{
  it('rejects a shop flooding the endpoint',async()=>{
    await saveShop(env,SHOP,'tok');
    let last=202;
    for(let i=0;i<605;i++) last=(await send(event())).status;
    expect(last).toBe(429);
  });
});

describe('origin is observed, not enforced',()=>{
  it('records the origin header without rejecting on it',async()=>{
    await saveShop(env,SHOP,'tok');
    const res=await send(event({eventId:'o1'}),{origin:'https://demo-store.example'});
    expect(res.status).toBe(202);
    const raw=JSON.parse(sqlite.prepare('select payload_json from events where event_id=?').get('o1').payload_json);
    expect(raw.origin).toBe('https://demo-store.example');
  });
  it('still accepts an event with no origin at all',async()=>{
    await saveShop(env,SHOP,'tok');
    expect((await send(event())).status).toBe(202);
  });
});

describe('per-shop event dedupe',()=>{
  it('one shop cannot suppress another shop event id',async()=>{
    await saveShop(env,SHOP,'tok');
    await saveShop(env,'other.myshopify.com','tok');
    await insertEvent(env,{shop:'other.myshopify.com',eventId:'shared',eventType:'page_viewed',occurredAt:new Date().toISOString()},'ChatGPT','');
    await insertEvent(env,{shop:SHOP,eventId:'shared',eventType:'checkout_completed',occurredAt:new Date().toISOString(),amount:99},'ChatGPT','');
    expect(sqlite.prepare("select count(*) c from events where event_id='shared'").get().c).toBe(2);
  });
  it('still dedupes within a single shop',async()=>{
    await saveShop(env,SHOP,'tok');
    const e={shop:SHOP,eventId:'dup',eventType:'page_viewed',occurredAt:new Date().toISOString()};
    await insertEvent(env,e,'ChatGPT','');
    await insertEvent(env,e,'ChatGPT','');
    expect(sqlite.prepare("select count(*) c from events where event_id='dup'").get().c).toBe(1);
  });
});

describe('normalizeOrderId',()=>{
  it('reduces every Shopify order id form to the same value',()=>{
    for(const v of ['gid://shopify/Order/450789469','450789469',450789469,'#450789469'])
      expect(normalizeOrderId(v),String(v)).toBe('450789469');
  });
  it('handles empty and junk input without throwing',()=>{
    expect(normalizeOrderId(null)).toBe('');
    expect(normalizeOrderId(undefined)).toBe('');
    expect(normalizeOrderId('  ')).toBe('');
    expect(normalizeOrderId('ABC')).toBe('abc');
  });
});

describe('orders webhook',()=>{
  const sign=(b:string)=>createHmac('sha256',TEST_SECRET).update(b).digest('base64');
  const hook=(topic:string,payload:unknown)=>{
    const body=JSON.stringify(payload);
    return worker.fetch(new Request('https://agentcart.example/api/shopify/webhooks',{method:'POST',body,
      headers:{'content-type':'application/json','x-shopify-topic':topic,'x-shopify-hmac-sha256':sign(body),'x-shopify-shop-domain':SHOP}}),env);
  };

  // A realistic orders/paid payload, including every PII block Shopify actually sends.
  const ORDER={
    id:450789469,admin_graphql_api_id:'gid://shopify/Order/450789469',
    current_total_price:'123.45',currency:'GBP',processed_at:'2026-09-01T10:00:00Z',
    email:'jane.doe@example.com',phone:'+447700900123',
    customer:{id:207119551,email:'jane.doe@example.com',first_name:'Jane',last_name:'Doe'},
    billing_address:{address1:'12 Example Street',city:'Leeds',zip:'LS1 1AA',name:'Jane Doe'},
    shipping_address:{address1:'12 Example Street',city:'Leeds',zip:'LS1 1AA',name:'Jane Doe'}
  };

  it('stores the order total and currency',async()=>{
    await saveShop(env,SHOP,'tok');
    expect((await hook('orders/paid',ORDER)).status).toBe(200);
    const row=sqlite.prepare('select * from orders').get();
    expect(row.total).toBe(123.45);
    expect(row.currency).toBe('GBP');
    expect(row.normalized_id).toBe('450789469');
  });

  // The single most important assertion here: AgentCart promises in three documents
  // that it holds no customer identity. This proves the promise under future edits.
  it('persists no customer identity anywhere in the database',async()=>{
    await saveShop(env,SHOP,'tok');
    await hook('orders/paid',ORDER);
    const tables=sqlite.prepare("select name from sqlite_master where type='table'").all().map((r:any)=>r.name);
    const haystack=tables.map((t:string)=>JSON.stringify(sqlite.prepare(`select * from "${t}"`).all())).join(' ');
    for(const secret of ['jane.doe@example.com','+447700900123','Jane','Doe','12 Example Street','Leeds','LS1 1AA','207119551'])
      expect(haystack,`leaked: ${secret}`).not.toContain(secret);
  });

  it('is idempotent on redelivery',async()=>{
    await saveShop(env,SHOP,'tok');
    await hook('orders/paid',ORDER);
    await hook('orders/paid',ORDER);
    expect(sqlite.prepare('select count(*) c from orders').get().c).toBe(1);
  });
});

describe('verified revenue join',()=>{
  // computed per call: a window captured at collection time predates the rows written in the test
  const WIN=()=>[0,Date.now()+1] as [number,number];
  it('attributes an order to the AI source that produced the matching pixel event',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,{shop:SHOP,eventId:'ce',eventType:'checkout_completed',occurredAt:new Date().toISOString(),orderId:'450789469'},'ChatGPT','chatgpt.com');
    await saveOrder(env,SHOP,'450789469','450789469',123.45,'GBP',Date.now());
    const rows=await getVerifiedSources(env,SHOP,...WIN());
    expect(rows).toEqual([{source:'ChatGPT',orders:1,revenue:123.45}]);
  });
  it('reports an order with no matching pixel event as unattributed, not guessed',async()=>{
    await saveShop(env,SHOP,'tok');
    await saveOrder(env,SHOP,'999','999',10,'GBP',Date.now());
    const rows=await getVerifiedSources(env,SHOP,...WIN());
    expect(rows[0].source).toBe('Direct / unknown');
  });
  it('joins across the gid and numeric id forms',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,{shop:SHOP,eventId:'ce2',eventType:'checkout_completed',occurredAt:new Date().toISOString(),orderId:'450789469'},'Claude','claude.ai');
    await saveOrder(env,SHOP,'gid://shopify/Order/450789469',normalizeOrderId('gid://shopify/Order/450789469'),50,'GBP',Date.now());
    const rows=await getVerifiedSources(env,SHOP,...WIN());
    expect(rows[0].source).toBe('Claude');
  });
  it('counts no orders when the table is empty, so the dashboard can fall back',async()=>{
    await saveShop(env,SHOP,'tok');
    expect(await countOrders(env,SHOP,...WIN())).toBe(0);
  });
});

describe('dashboard verified flag',()=>{
  const dash=async()=>{
    const {getDashboardWindows}=await import('../src/db');
    return getDashboardWindows(env,SHOP,Date.now()) as any;
  };
  it('reports verified:false and pixel revenue when no orders are recorded',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,{shop:SHOP,eventId:'p1',eventType:'checkout_completed',occurredAt:new Date().toISOString(),orderId:'1',amount:77},'ChatGPT','chatgpt.com');
    const d=await dash();
    expect(d.verified).toBe(false);
    expect(Number(d.summary.revenue)).toBe(77);
  });
  it('switches to verified:true and authoritative totals once orders exist',async()=>{
    await saveShop(env,SHOP,'tok');
    // pixel claims 999; the HMAC-verified order says 20
    await insertEvent(env,{shop:SHOP,eventId:'p2',eventType:'checkout_completed',occurredAt:new Date().toISOString(),orderId:'450789469',amount:999},'ChatGPT','chatgpt.com');
    await saveOrder(env,SHOP,'450789469','450789469',20,'GBP',Date.now());
    const d=await dash();
    expect(d.verified).toBe(true);
    expect(Number(d.summary.revenue)).toBe(20);
    expect(Number(d.summary.orders)).toBe(1);
  });
});
