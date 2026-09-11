import {beforeEach,describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import worker from '../src/index';
import {TIERS,classifyOrderSource,createJourneyId,revenueByTier,startJourney,verifyJourneyId} from '../src/attribution';
import {saveOrder,saveShop} from '../src/db';
import {sessionCookie} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,'tok');});

const sign=(b:string)=>createHmac('sha256',TEST_SECRET).update(b).digest('base64');
const hook=(payload:unknown,topic='orders/paid')=>{
  const body=JSON.stringify(payload);
  return worker.fetch(new Request('https://agentcart.example/api/shopify/webhooks',{method:'POST',body,
    headers:{'content-type':'application/json','x-shopify-topic':topic,
      'x-shopify-hmac-sha256':sign(body),'x-shopify-shop-domain':SHOP}}),env);
};
const order=(over:Record<string,unknown>={})=>({
  id:450789469,admin_graphql_api_id:'gid://shopify/Order/450789469',
  current_total_price:'99.00',currency:'GBP',processed_at:new Date().toISOString(),...over});

describe('journey ids',()=>{
  it('round-trip verify for the right shop and provider',async()=>{
    const id=await createJourneyId(TEST_SECRET,SHOP,'meta');
    expect(await verifyJourneyId(TEST_SECRET,SHOP,'meta',id)).toBe(true);
  });
  it('do not verify for another shop or provider or secret',async()=>{
    const id=await createJourneyId(TEST_SECRET,SHOP,'meta');
    expect(await verifyJourneyId(TEST_SECRET,'other.myshopify.com','meta',id)).toBe(false);
    expect(await verifyJourneyId(TEST_SECRET,SHOP,'openai',id)).toBe(false);
    expect(await verifyJourneyId('other-secret',SHOP,'meta',id)).toBe(false);
  });
  it('reject tampered or malformed ids without throwing',async()=>{
    const id=await createJourneyId(TEST_SECRET,SHOP,'meta');
    for(const bad of [id.slice(0,-1)+'x','ac1_nope','','not-an-id','ac1_a.b.c.d'])
      expect(await verifyJourneyId(TEST_SECRET,SHOP,'meta',bad),bad).toBe(false);
  });
  it('are collision resistant across rapid creation',async()=>{
    const ids=await Promise.all(Array.from({length:200},()=>createJourneyId(TEST_SECRET,SHOP,'meta')));
    expect(new Set(ids).size).toBe(200);
  });
  it('carry no customer identity or secret',async()=>{
    const id=await createJourneyId('super-secret-value',SHOP,'meta');
    expect(id).not.toContain('super-secret-value');
    expect(id).not.toContain(SHOP);
  });
});

describe('classifying an order source',()=>{
  it('names Meta from an agentic channel marker',()=>{
    for(const channel of ['meta_ai_checkout','muse','meta-ai','MUSE_CHECKOUT']){
      const r=classifyOrderSource({channel});
      expect(r.tier,channel).toBe('verified');
      expect(r.agent,channel).toBe('Meta');
    }
  });
  it('names ChatGPT from a source name',()=>{
    expect(classifyOrderSource({sourceName:'openai-instant-checkout'}).agent).toBe('ChatGPT');
  });

  // Underscores are word characters, so \\bmeta\\b never matches the tokens platforms emit.
  it('matches underscore-separated tokens',()=>{
    expect(classifyOrderSource({channel:'meta_ai'}).agent).toBe('Meta');
  });

  // An ordinary sales channel is not an AI agent. Counting it as one would fabricate the exact
  // number this product exists to report honestly.
  it('does not treat an ordinary sales channel as an AI agent',()=>{
    for(const channel of ['facebook','instagram','google','google_shopping','facebook_shop','pos','web']){
      const r=classifyOrderSource({channel});
      expect(r.agent,channel).toBe('Direct / unknown');
    }
  });
  it('does not match a substring inside an unrelated word',()=>{
    for(const channel of ['metadata','metal_supplies','museum_gift_shop'])
      expect(classifyOrderSource({channel}).agent,channel).toBe('Direct / unknown');
  });
  // The rule the spec calls out explicitly.
  it('never infers an agent merely because no pixel fired',()=>{
    const r=classifyOrderSource({channel:'web'});
    expect(r.agent).toBe('Direct / unknown');
    expect(r.agent).not.toBe('Meta');
  });
  it('reports unknown when there is no evidence at all',()=>{
    const r=classifyOrderSource({});
    expect(r.tier).toBe('unknown');
    expect(r.evidence.join(' ')).toContain('No channel or referral evidence');
  });
  it('uses a journey id when no channel marker exists',()=>{
    const r=classifyOrderSource({journeyId:'ac1_abc.def'});
    expect(r.tier).toBe('identifiable_referral');
  });
  it('always records why it concluded what it did',()=>{
    for(const input of [{channel:'meta'},{},{channel:'web'},{journeyId:'x'}])
      expect(classifyOrderSource(input).evidence.length).toBeGreaterThan(0);
  });
});

describe('agentic order without a pixel',()=>{
  it('produces verified AI-channel revenue with no pixel event at all',async()=>{
    expect((await hook(order({source_name:'meta_muse_checkout'}))).status).toBe(200);
    expect(sqlite.prepare('select count(*) c from events').get().c).toBe(0);
    const row=sqlite.prepare('select source_tier,source_agent,total from orders').get();
    expect(row.source_tier).toBe('verified');
    expect(row.source_agent).toBe('Meta');
    expect(row.total).toBe(99);
  });

  it('joins a signed journey id carried in order note attributes',async()=>{
    const journeyId=await startJourney(env,SHOP,'meta',{intent:'buy'});
    await hook(order({note_attributes:[{name:'agentcart_journey',value:journeyId}]}));
    const row=sqlite.prepare('select source_tier,journey_id from orders').get();
    expect(row.journey_id).toBe(journeyId);
    expect(row.source_tier).toBe('identifiable_referral');
    expect(sqlite.prepare('select order_id from commerce_journeys').get().order_id).toBe('450789469');
  });

  it('rejects a forged journey id rather than trusting the payload',async()=>{
    await hook(order({note_attributes:[{name:'agentcart_journey',value:'ac1_forged.abc.deadbeef'}]}));
    const row=sqlite.prepare('select source_tier,journey_id from orders').get();
    expect(row.journey_id).toBe(null);
    expect(row.source_tier).not.toBe('identifiable_referral');
  });

  it('rejects a journey id belonging to another shop',async()=>{
    await saveShop(env,'other.myshopify.com','tok');
    const foreign=await startJourney(env,'other.myshopify.com','meta',{});
    await hook(order({note_attributes:[{name:'agentcart_journey',value:foreign}]}));
    expect(sqlite.prepare('select journey_id from orders').get().journey_id).toBe(null);
  });

  it('persists no customer identity from an agentic order',async()=>{
    await hook(order({source_name:'meta_muse',email:'buyer@example.com',phone:'+447700900123',
      customer:{id:1,first_name:'Sam',last_name:'Lee',email:'buyer@example.com'},
      billing_address:{address1:'9 Test Road',city:'Leeds',zip:'LS1 1AA'}}));
    const tables=sqlite.prepare("select name from sqlite_master where type='table'").all().map((r:any)=>r.name);
    const dump=tables.map((t:string)=>JSON.stringify(sqlite.prepare(`select * from "${t}"`).all())).join(' ');
    for(const pii of ['buyer@example.com','+447700900123','Sam','Lee','9 Test Road','LS1 1AA'])
      expect(dump,`leaked ${pii}`).not.toContain(pii);
  });
});

describe('existing browser attribution still works',()=>{
  it('pixel events are still ingested and classified',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/events',{method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({shop:SHOP,eventId:'e1',eventType:'page_viewed',
        occurredAt:new Date().toISOString(),referrer:'https://chatgpt.com/'})}),env);
    expect(res.status).toBe(202);
    expect(sqlite.prepare('select source_agent from events').get().source_agent).toBe('ChatGPT');
  });
});

describe('tiers are reported separately, never summed',()=>{
  it('returns every tier with its own totals',async()=>{
    const now=Date.now();
    await saveOrder(env,SHOP,'1','1',100,'GBP',now);
    await saveOrder(env,SHOP,'2','2',50,'GBP',now);
    sqlite.prepare("update orders set source_tier='verified' where order_id='1'").run();
    sqlite.prepare("update orders set source_tier='reported' where order_id='2'").run();
    const tiers=await revenueByTier(env,SHOP,0,now+1);
    expect(tiers.map(t=>t.tier)).toEqual([...TIERS]);
    expect(tiers.find(t=>t.tier==='verified')!.revenue).toBe(100);
    expect(tiers.find(t=>t.tier==='reported')!.revenue).toBe(50);
  });
  it('explains what each tier means',async()=>{
    for(const t of await revenueByTier(env,SHOP,0,Date.now()+1)){
      expect(t.meaning.length).toBeGreaterThan(20);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe('journey and attribution routes',()=>{
  it('journey creation requires a known store',async()=>{
    const post=(b:unknown)=>worker.fetch(new Request('https://agentcart.example/api/journey',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify(b)}),env);
    expect((await post({shop:'evil.com'})).status).toBe(400);
    expect((await post({shop:'ghost.myshopify.com'})).status).toBe(404);
    const ok=await post({shop:SHOP,provider:'meta',intent:'buy'});
    expect(ok.status).toBe(201);
    expect((await ok.json() as any).journeyId).toMatch(/^ac1_/);
  });
  it('attribution route requires a session',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/attribution'),env)).status).toBe(401);
  });
  it('attribution route returns separated tiers',async()=>{
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    const res=await worker.fetch(new Request('https://agentcart.example/api/attribution',{headers:{cookie}}),env);
    const body:any=await res.json();
    expect(body.tiers.length).toBe(TIERS.length);
    expect(body.note).toContain('never summed');
  });
});
