import {beforeEach,describe,expect,it} from 'vitest';
import {consumeOAuthState,deleteShop,getDashboard,getShop,insertEvent,putOAuthState,saveScan,saveShop,updatePixelId} from '../src/db';
import {fakeEnv} from './helpers/env';
import {migrationFiles} from './helpers/d1';
import type {Env,PixelEventPayload} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any; let close:()=>void;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;close=f.close;});

const ev=(over:Partial<PixelEventPayload>={}):PixelEventPayload=>({
  shop:SHOP,eventId:'e1',eventType:'page_viewed',occurredAt:new Date().toISOString(),...over
});

describe('migrations',()=>{
  it('all apply in filename order against an empty database',()=>{
    const files=migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(files).toEqual([...files].sort());
    const tables=sqlite.prepare("select name from sqlite_master where type='table' order by name").all().map((r:any)=>r.name);
    for(const t of ['events','oauth_states','scans','shops']) expect(tables).toContain(t);
  });
});

describe('oauth state',()=>{
  it('is single-use',async()=>{
    await putOAuthState(env,'st1',SHOP);
    expect(await consumeOAuthState(env,'st1',SHOP)).toBe(true);
    expect(await consumeOAuthState(env,'st1',SHOP)).toBe(false);
  });
  it('rejects a mismatched shop',async()=>{
    await putOAuthState(env,'st2',SHOP);
    expect(await consumeOAuthState(env,'st2','other.myshopify.com')).toBe(false);
  });
  it('rejects an expired state',async()=>{
    await putOAuthState(env,'st3',SHOP);
    sqlite.prepare('update oauth_states set expires_at=? where state=?').run(Date.now()-1,'st3');
    expect(await consumeOAuthState(env,'st3',SHOP)).toBe(false);
  });
  it('rejects an unknown state',async()=>{
    expect(await consumeOAuthState(env,'nope',SHOP)).toBe(false);
  });
});

describe('shops',()=>{
  it('saves and reads back a shop',async()=>{
    await saveShop(env,SHOP,'enc-token');
    const row=await getShop(env,SHOP);
    expect(row?.shop_domain).toBe(SHOP);
    expect(row?.encrypted_access_token).toBe('enc-token');
  });
  it('upsert preserves an existing pixel id when none is supplied',async()=>{
    await saveShop(env,SHOP,'tok1');
    await updatePixelId(env,SHOP,'gid://shopify/WebPixel/1');
    await saveShop(env,SHOP,'tok2');
    const row=await getShop(env,SHOP);
    expect(row?.encrypted_access_token).toBe('tok2');
    expect(row?.pixel_id).toBe('gid://shopify/WebPixel/1');
  });
  it('returns null for an unknown shop',async()=>{
    expect(await getShop(env,'ghost.myshopify.com')).toBe(null);
  });
});

describe('events',()=>{
  it('deduplicates by event id',async()=>{
    await saveShop(env,SHOP,'t');
    await insertEvent(env,ev(),'ChatGPT','chatgpt.com');
    await insertEvent(env,ev(),'ChatGPT','chatgpt.com');
    const n=sqlite.prepare('select count(*) c from events').get().c;
    expect(n).toBe(1);
  });
  it('stores the classified source',async()=>{
    await saveShop(env,SHOP,'t');
    await insertEvent(env,ev({eventId:'x'}),'Perplexity','perplexity.ai');
    const row=sqlite.prepare('select source_agent,source_host from events where event_id=?').get('x');
    expect(row.source_agent).toBe('Perplexity');
    expect(row.source_host).toBe('perplexity.ai');
  });
});

describe('deleteShop',()=>{
  it('removes the shop and its events',async()=>{
    await saveShop(env,SHOP,'t');
    await insertEvent(env,ev({eventId:'d1'}),'ChatGPT','chatgpt.com');
    await deleteShop(env,SHOP);
    expect(await getShop(env,SHOP)).toBe(null);
    expect(sqlite.prepare('select count(*) c from events where shop_domain=?').get(SHOP).c).toBe(0);
  });
});

describe('getDashboard',()=>{
  it('returns the expected shape',async()=>{
    await saveShop(env,SHOP,'t');
    const d:any=await getDashboard(env,SHOP);
    expect(d).toHaveProperty('summary');
    expect(Array.isArray(d.sources)).toBe(true);
    expect(Array.isArray(d.funnel)).toBe(true);
    expect(Array.isArray(d.topProducts)).toBe(true);
  });
  it('aggregates visits, orders and revenue',async()=>{
    await saveShop(env,SHOP,'t');
    const now=new Date().toISOString();
    await insertEvent(env,ev({eventId:'v1',eventType:'page_viewed',sessionId:'s1',occurredAt:now}),'ChatGPT','chatgpt.com');
    await insertEvent(env,ev({eventId:'v2',eventType:'page_viewed',sessionId:'s2',occurredAt:now}),'ChatGPT','chatgpt.com');
    await insertEvent(env,ev({eventId:'o1',eventType:'checkout_completed',orderId:'1001',amount:50,currency:'GBP',sessionId:'s1',occurredAt:now}),'ChatGPT','chatgpt.com');
    const d:any=await getDashboard(env,SHOP);
    expect(Number(d.summary.visits)).toBe(2);
    expect(Number(d.summary.orders)).toBe(1);
    expect(Number(d.summary.revenue)).toBe(50);
  });
});

describe('saveScan',()=>{
  it('persists a scan row',async()=>{
    await saveScan(env,'example.com',72,[{key:'title'}]);
    const row=sqlite.prepare('select domain,score,findings_json from scans').get();
    expect(row.domain).toBe('example.com');
    expect(row.score).toBe(72);
    expect(JSON.parse(row.findings_json)[0].key).toBe('title');
  });
});
