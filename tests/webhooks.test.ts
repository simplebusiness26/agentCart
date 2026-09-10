import {beforeEach,describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import worker from '../src/index';
import {insertEvent,putOAuthState,saveShop} from '../src/db';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env,PixelEventPayload} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});

const sign=(body:string)=>createHmac('sha256',TEST_SECRET).update(body).digest('base64');

function hook(topic:string,payload:unknown,opts:{shopHeader?:string|null;badSig?:boolean}={}){
  const body=JSON.stringify(payload);
  const headers:Record<string,string>={'content-type':'application/json','x-shopify-topic':topic,
    'x-shopify-hmac-sha256':opts.badSig?'wrong':sign(body)};
  const sh=opts.shopHeader===undefined?SHOP:opts.shopHeader;
  if(sh)headers['x-shopify-shop-domain']=sh;
  return worker.fetch(new Request('https://agentcart.example/api/shopify/webhooks',{method:'POST',body,headers}),env);
}

const ev=(o:Partial<PixelEventPayload>):PixelEventPayload=>({
  shop:SHOP,eventId:'e',eventType:'page_viewed',occurredAt:new Date().toISOString(),...o});

const count=(t:string,w='')=>sqlite.prepare(`select count(*) c from ${t} ${w}`).get().c;

describe('webhook authentication',()=>{
  it('rejects a bad signature before doing any work',async()=>{
    await saveShop(env,SHOP,'tok');
    expect((await hook('app/uninstalled',{},{badSig:true})).status).toBe(401);
    expect(count('shops')).toBe(1);
  });
  it('rejects a shop domain that is not a myshopify domain',async()=>{
    expect((await hook('app/uninstalled',{},{shopHeader:'evil.com'})).status).toBe(400);
  });
  it('rejects when no shop can be determined',async()=>{
    expect((await hook('app/uninstalled',{},{shopHeader:null})).status).toBe(400);
  });
  it('falls back to shop_domain in the payload',async()=>{
    await saveShop(env,SHOP,'tok');
    const res=await hook('shop/redact',{shop_domain:SHOP},{shopHeader:null});
    expect(res.status).toBe(200);
    expect(count('shops')).toBe(0);
  });
  it('acknowledges an unknown topic with 200 so Shopify stops retrying',async()=>{
    expect((await hook('orders/cancelled',{})).status).toBe(200);
  });
});

describe('app/uninstalled',()=>{
  it('removes the shop, its events and its pending oauth states',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,ev({eventId:'a'}),'ChatGPT','chatgpt.com');
    await putOAuthState(env,'st',SHOP);
    sqlite.prepare("insert into scans(domain,score,findings_json) values(?,50,'[]')").run(SHOP);
    expect((await hook('app/uninstalled',{})).status).toBe(200);
    expect(count('shops')).toBe(0);
    expect(count('events')).toBe(0);
    expect(count('oauth_states')).toBe(0);
    expect(count('scans')).toBe(0);
  });
});

describe('shop/redact',()=>{
  it('deletes shop data and records the request',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,ev({eventId:'b'}),'Claude','claude.ai');
    expect((await hook('shop/redact',{shop_domain:SHOP})).status).toBe(200);
    expect(count('shops')).toBe(0);
    expect(count('events')).toBe(0);
    const row=sqlite.prepare('select topic from compliance_requests').get();
    expect(row.topic).toBe('shop/redact');
  });
});

describe('customers/redact',()=>{
  beforeEach(async()=>{
    await saveShop(env,SHOP,'tok');
    // customer A: an order plus other activity in the same browsing session
    await insertEvent(env,ev({eventId:'a1',eventType:'checkout_completed',orderId:'1001',sessionId:'sA',amount:20}),'ChatGPT','chatgpt.com');
    await insertEvent(env,ev({eventId:'a2',eventType:'product_viewed',sessionId:'sA'}),'ChatGPT','chatgpt.com');
    // customer B: unrelated, must survive
    await insertEvent(env,ev({eventId:'b1',eventType:'checkout_completed',orderId:'2002',sessionId:'sB',amount:30}),'Claude','claude.ai');
    await insertEvent(env,ev({eventId:'b2',eventType:'page_viewed',sessionId:'sB'}),'Claude','claude.ai');
  });
  it('deletes the customer session and leaves other customers intact',async()=>{
    const res=await hook('customers/redact',{shop_domain:SHOP,customer:{id:99},orders_to_redact:['1001']});
    expect(res.status).toBe(200);
    const remaining=sqlite.prepare('select event_id from events order by event_id').all().map((r:any)=>r.event_id);
    expect(remaining).toEqual(['b1','b2']);
  });
  it('records the request with the customer id',async()=>{
    await hook('customers/redact',{shop_domain:SHOP,customer:{id:99},orders_to_redact:['1001']});
    const row=sqlite.prepare('select topic,customer_id,matched_events from compliance_requests').get();
    expect(row.topic).toBe('customers/redact');
    expect(row.customer_id).toBe('99');
    expect(row.matched_events).toBe(1);
  });
  it('is a no-op when no orders are supplied',async()=>{
    const res=await hook('customers/redact',{shop_domain:SHOP,customer:{id:99},orders_to_redact:[]});
    expect(res.status).toBe(200);
    expect(count('events')).toBe(4);
  });
});

describe('customers/data_request',()=>{
  it('records the request with a count of matching rows and deletes nothing',async()=>{
    await saveShop(env,SHOP,'tok');
    await insertEvent(env,ev({eventId:'c1',eventType:'checkout_completed',orderId:'3003',sessionId:'sC'}),'Gemini','gemini.google.com');
    const res=await hook('customers/data_request',{shop_domain:SHOP,customer:{id:7},orders_requested:['3003']});
    expect(res.status).toBe(200);
    expect(count('events')).toBe(1);
    const row=sqlite.prepare('select topic,customer_id,matched_events,order_ids_json from compliance_requests').get();
    expect(row.topic).toBe('customers/data_request');
    expect(row.customer_id).toBe('7');
    expect(row.matched_events).toBe(1);
    expect(JSON.parse(row.order_ids_json)).toEqual(['3003']);
  });
});

describe('oauth_states garbage collection',()=>{
  it('sweeps expired states on the next install attempt',async()=>{
    await putOAuthState(env,'old',SHOP);
    sqlite.prepare('update oauth_states set expires_at=? where state=?').run(Date.now()-1,'old');
    await putOAuthState(env,'fresh',SHOP);
    const states=sqlite.prepare('select state from oauth_states').all().map((r:any)=>r.state);
    expect(states).toEqual(['fresh']);
  });
});
