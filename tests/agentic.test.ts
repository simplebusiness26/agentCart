import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {beginIdempotent,completeIdempotent,failIdempotent,hashRequest} from '../src/agentic/idempotency';
import {assessChannel,getChannelCapabilities,saveChannelCapabilities} from '../src/agentic/channel';
import {saveBusinessProfile,saveCatalog} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {saveShop} from '../src/db';
import {fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,'tok');});
afterEach(()=>vi.unstubAllGlobals());

describe('idempotency',()=>{
  const body={item:'x',qty:1};
  it('lets a first request through',async()=>{
    expect((await beginIdempotent(env,SHOP,'cart','k1',body)).status).toBe('fresh');
  });
  it('replays the stored response instead of acting twice',async()=>{
    await beginIdempotent(env,SHOP,'cart','k1',body);
    await completeIdempotent(env,SHOP,'k1',{cartId:'c1'});
    const again=await beginIdempotent(env,SHOP,'cart','k1',body);
    expect(again.status).toBe('replayed');
    expect((again as any).response).toEqual({cartId:'c1'});
  });
  it('reports an in-flight duplicate rather than acting again',async()=>{
    await beginIdempotent(env,SHOP,'cart','k1',body);
    expect((await beginIdempotent(env,SHOP,'cart','k1',body)).status).toBe('in_progress');
  });
  it('rejects the same key used with a different body',async()=>{
    await beginIdempotent(env,SHOP,'cart','k1',body);
    await completeIdempotent(env,SHOP,'k1',{cartId:'c1'});
    const conflict=await beginIdempotent(env,SHOP,'cart','k1',{item:'y',qty:99});
    expect(conflict.status).toBe('conflict');
    expect((conflict as any).detail).toContain('different request body');
  });
  it('keeps keys separate per shop',async()=>{
    await saveShop(env,'other.myshopify.com','tok');
    await beginIdempotent(env,SHOP,'cart','shared',body);
    await completeIdempotent(env,SHOP,'shared',{cartId:'mine'});
    expect((await beginIdempotent(env,'other.myshopify.com','cart','shared',body)).status).toBe('fresh');
  });
  it('does not replay a failed attempt as a success',async()=>{
    await beginIdempotent(env,SHOP,'cart','k1',body);
    await failIdempotent(env,SHOP,'k1');
    expect((await beginIdempotent(env,SHOP,'cart','k1',body)).status).toBe('fresh');
  });
  it('expires and sweeps old keys',async()=>{
    const long=Date.now()-1000*60*60*48;
    await beginIdempotent(env,SHOP,'cart','old',body,long);
    await completeIdempotent(env,SHOP,'old',{x:1});
    expect((await beginIdempotent(env,SHOP,'cart','old',body)).status).toBe('fresh');
    await beginIdempotent(env,SHOP,'cart','new',body);
    expect(sqlite.prepare("select count(*) c from idempotency_keys where key='old'").get().c).toBeLessThanOrEqual(1);
  });
  it('hashes request bodies stably regardless of object identity',async()=>{
    expect(await hashRequest({a:1,b:[2,3]})).toBe(await hashRequest({a:1,b:[2,3]}));
    expect(await hashRequest({a:1})).not.toBe(await hashRequest({a:2}));
  });
});

function mockAdmin(handler:(q:string)=>unknown,status=200){
  vi.stubGlobal('fetch',vi.fn(async(_u:any,init:any)=>
    new Response(JSON.stringify(handler(JSON.parse(init.body).query)),{status})));
}
const withChannel=(names:string[])=>(q:string)=>{
  if(q.includes('query Pubs'))return {data:{publications:{nodes:names.map(name=>({id:'1',name}))}}};
  if(q.includes('query Pol'))return {data:{shop:{shopPolicies:[
    {type:'REFUND_POLICY',url:'x'},{type:'PRIVACY_POLICY',url:'y'},{type:'TERMS_OF_SERVICE',url:'z'}]}}};
  return {data:{}};
};

describe('Shopify agentic channel readiness',()=>{
  beforeEach(async()=>{
    await saveBusinessProfile(env,SHOP,{name:'S',description:'',contactEmail:'',contactPhone:'',
      address:{},currency:'GBP',primaryUrl:'https://s.example',policies:[]},1000);
  });

  it('detects a connected Meta channel',async()=>{
    mockAdmin(withChannel(['Online Store','Facebook & Instagram by Meta']));
    const caps=await assessChannel(env,SHOP,'tok','US');
    expect(caps.find(c=>c.key==='sales-channel')!.state).toBe('pass');
  });

  it('reports a missing channel as a merchant account action, not something it can fix',async()=>{
    mockAdmin(withChannel(['Online Store']));
    const c=(await assessChannel(env,SHOP,'tok','US')).find(x=>x.key==='sales-channel')!;
    expect(c.state).toBe('fail');
    expect(c.fixClass).toBe('merchant_account_action');
    expect(c.nextAction).toContain('Only you can do this');
  });

  it('never reports a region restriction as a merchant failure',async()=>{
    mockAdmin(withChannel(['Online Store']));
    const c=(await assessChannel(env,SHOP,'tok','GB')).find(x=>x.key==='region')!;
    expect(c.state).toBe('not_available_in_region');
    expect(c.state).not.toBe('fail');
    expect(c.detail).toContain('not a failing on your part');
    expect(c.fixClass).toBe('platform_unavailable');
  });

  it('says unknown when it cannot see something, rather than guessing',async()=>{
    mockAdmin(withChannel(['Facebook & Instagram by Meta']));
    const caps=await assessChannel(env,SHOP,'tok','US');
    const terms=caps.find(c=>c.key==='agentic-terms')!;
    expect(terms.state).toBe('unknown');
    expect(terms.detail).toContain('not exposed by a documented API');
    expect(terms.state).not.toBe('fail');
  });

  it('degrades to unknown when the API call fails, not to a failure',async()=>{
    mockAdmin(()=>({}),500);
    const c=(await assessChannel(env,SHOP,'tok','US')).find(x=>x.key==='sales-channel')!;
    expect(c.state).toBe('unknown');
    expect(c.state).not.toBe('fail');
  });

  it('flags incomplete catalogue data and offers the fix engine',async()=>{
    mockAdmin(withChannel(['Facebook & Instagram by Meta']));
    await saveCatalog(env,SHOP,[{...normalizeProduct(S.productNode(1),SHOP),description:''}],1000);
    const c=(await assessChannel(env,SHOP,'tok','US')).find(x=>x.key==='catalogue-eligibility')!;
    expect(c.state).toBe('fail');
    expect(c.fixClass).toBe('automatic');
    expect(c.nextAction).toContain('Fixes tab');
  });

  it('will not write legal text for the merchant',async()=>{
    mockAdmin(q=>q.includes('query Pol')
      ?{data:{shop:{shopPolicies:[{type:'PRIVACY_POLICY',url:'y'}]}}}
      :withChannel(['Facebook & Instagram by Meta'])(q));
    const c=(await assessChannel(env,SHOP,'tok','US')).find(x=>x.key==='required-policies')!;
    expect(c.state).toBe('fail');
    expect(c.nextAction).toContain('will not write legal text');
  });

  it('gives every capability evidence and a next action',async()=>{
    mockAdmin(withChannel(['Facebook & Instagram by Meta']));
    for(const c of await assessChannel(env,SHOP,'tok','US')){
      expect(c.evidence.length,c.key).toBeGreaterThan(0);
      expect(c.nextAction.length,c.key).toBeGreaterThan(5);
      expect(c.detail.length,c.key).toBeGreaterThan(20);
    }
  });

  it('persists and reads back capabilities',async()=>{
    mockAdmin(withChannel(['Facebook & Instagram by Meta']));
    const caps=await assessChannel(env,SHOP,'tok','US');
    await saveChannelCapabilities(env,SHOP,caps);
    const stored=await getChannelCapabilities(env,SHOP);
    expect(stored.length).toBe(caps.length);
    await saveChannelCapabilities(env,SHOP,caps);
    expect((await getChannelCapabilities(env,SHOP)).length).toBe(caps.length);
  });
});
