import {beforeEach,describe,expect,it} from 'vitest';
import worker from '../src/index';
import {ensureProfile,setProfileActive,slugFor} from '../src/ailayer/service';
import {handleMcp} from '../src/ailayer/mcp';
import {saveBusinessProfile,saveCatalog} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {encryptToken,sessionCookie} from '../src/shopify';
import {insertEvent,saveShop,setIngestToken} from '../src/db';
import {TEST_KEY,TEST_SECRET,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

const SHOP='northbound.myshopify.com';
const TOKEN='shpat_supersecret_token';
let env:Env; let sqlite:any; let slug:string;

beforeEach(async()=>{
  const f=fakeEnv();env=f.env;sqlite=f.sqlite;
  await saveShop(env,SHOP,await encryptToken(TOKEN,TEST_KEY));
  await setIngestToken(env,SHOP,'ingest-secret-value');
  await saveBusinessProfile(env,SHOP,{
    name:'Northbound Outfitters',description:'Cold weather hiking gear.',
    contactEmail:'hello@northbound.example',contactPhone:'+441134960100',
    address:{address1:'14 Kirkgate',city:'Leeds',province:'West Yorkshire',zip:'LS1 6BY',country:'United Kingdom'},
    currency:'GBP',primaryUrl:'https://northbound.example',
    policies:[{type:'REFUND_POLICY',title:'Refund policy',url:'https://x/r',body:'Thirty day returns.'}]
  },1000);
  await saveCatalog(env,SHOP,[1,2,3].map(i=>({...normalizeProduct(S.productNode(i),SHOP),
    title:['Merino Base Layer','Trail Runner GTX','Insulated Flask'][i-1]})),1000);
  // customer-derived data that must never surface publicly
  await insertEvent(env,{shop:SHOP,eventId:'e1',eventType:'checkout_completed',
    occurredAt:new Date().toISOString(),orderId:'450789469',amount:123.45,sessionId:'sess-private'},'ChatGPT','chatgpt.com');
  slug=await ensureProfile(env,SHOP);
});

const get=(p:string,headers:Record<string,string>={})=>worker.fetch(new Request(`https://agentcart.example${p}`,{headers}),env);
const rpc=(body:unknown)=>worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/mcp`,{
  method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}}),env);

describe('slug',()=>{
  it('drops the myshopify suffix and is url safe',()=>{
    expect(slugFor('northbound.myshopify.com')).toBe('northbound');
    expect(slugFor('My Store.myshopify.com')).toMatch(/^[a-z0-9-]+$/);
  });
  it('does not reuse a slug across two shops',async()=>{
    const a=await ensureProfile(env,'northbound.myshopify.com');
    await saveShop(env,'northbound.myshopify.com'.replace('northbound','northbound2'),'x');
    sqlite.prepare("insert into ai_profiles(shop_domain,slug,version,active,last_generated_ms) values('other.myshopify.com','northbound-clash',1,1,0)").run();
    expect(a).toBe('northbound');
  });
  it('is stable across repeat calls',async()=>{
    expect(await ensureProfile(env,SHOP)).toBe(slug);
  });
});

describe('public JSON endpoints',()=>{
  it('serves the business profile',async()=>{
    const res=await get(`/api/ai/${slug}/profile`);
    expect(res.status).toBe(200);
    const b:any=await res.json();
    expect(b.business.name).toBe('Northbound Outfitters');
    expect(b.catalogSample.length).toBe(3);
    expect(b.schemaVersion).toBe('1.0');
  });
  it('serves the catalogue with paging',async()=>{
    const b:any=await (await get(`/api/ai/${slug}/catalog?limit=2`)).json();
    expect(b.items.length).toBe(2);
    const p2:any=await (await get(`/api/ai/${slug}/catalog?limit=2&offset=2`)).json();
    expect(p2.items.length).toBe(1);
  });
  it('serves one item by handle and by id',async()=>{
    const byHandle:any=await (await get(`/api/ai/${slug}/items/item-1`)).json();
    expect(byHandle.title).toBe('Merino Base Layer');
    expect(byHandle.variants.length).toBe(2);
    const byId:any=await (await get(`/api/ai/${slug}/items/${encodeURIComponent('gid://shopify/Product/2')}`)).json();
    expect(byId.title).toBe('Trail Runner GTX');
  });
  it('404s an unknown item rather than returning an empty object',async()=>{
    expect((await get(`/api/ai/${slug}/items/nope`)).status).toBe(404);
  });
  it('serves policies and actions',async()=>{
    expect(((await (await get(`/api/ai/${slug}/policies`)).json()) as any).policies.length).toBe(1);
    expect(((await (await get(`/api/ai/${slug}/actions`)).json()) as any).actions.length).toBeGreaterThan(3);
  });
  it('searches the catalogue',async()=>{
    const b:any=await (await get(`/api/ai/${slug}/search?q=merino`)).json();
    expect(b.results.length).toBe(1);
  });
  it('404s an unknown business',async()=>{
    expect((await get('/api/ai/not-a-business/profile')).status).toBe(404);
  });
  it('404s a business whose profile is switched off',async()=>{
    await setProfileActive(env,SHOP,false);
    expect((await get(`/api/ai/${slug}/profile`)).status).toBe(404);
  });
  it('supports conditional requests with an ETag',async()=>{
    const first=await get(`/api/ai/${slug}/profile`);
    const etag=first.headers.get('etag')!;
    expect(etag).toBeTruthy();
    expect((await get(`/api/ai/${slug}/profile`,{'if-none-match':etag})).status).toBe(304);
  });
  it('changes the ETag when the profile version changes',async()=>{
    const before=(await get(`/api/ai/${slug}/profile`)).headers.get('etag');
    await setProfileActive(env,SHOP,true);
    expect((await get(`/api/ai/${slug}/profile`)).headers.get('etag')).not.toBe(before);
  });
});

// The central safety property of this whole layer.
describe('no private data leaves the AI layer',()=>{
  const SECRETS=[TOKEN,'ingest-secret-value','sess-private','450789469','123.45','encrypted_access_token'];
  it('is absent from every public endpoint',async()=>{
    for(const path of ['profile','catalog','policies','actions','search?q=merino']){
      const text=await (await get(`/api/ai/${slug}/${path}`)).text();
      for(const secret of SECRETS)
        expect(text,`${path} leaked ${secret}`).not.toContain(secret);
    }
  });
  it('is absent from the human-readable page',async()=>{
    const text=await (await get(`/ai/${slug}`)).text();
    for(const secret of SECRETS) expect(text,`leaked ${secret}`).not.toContain(secret);
  });
  it('is absent from every MCP tool result',async()=>{
    for(const name of ['get_business','get_policies','get_supported_actions']){
      const r:any=await (await rpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{}}})).json();
      const text=JSON.stringify(r);
      for(const secret of SECRETS) expect(text,`${name} leaked ${secret}`).not.toContain(secret);
    }
  });
  it('does not expose the myshopify domain publicly',async()=>{
    const text=await (await get(`/api/ai/${slug}/profile`)).text();
    expect(text).not.toContain('northbound.myshopify.com');
  });
});

describe('human-readable profile',()=>{
  it('shows the merchant exactly what is shared',async()=>{
    const res=await get(`/ai/${slug}`);
    expect(res.status).toBe(200);
    const text=await res.text();
    expect(text).toContain('exactly what AgentCart tells AI assistants');
    expect(text).toContain('Northbound Outfitters');
    expect(text).toContain('Merino Base Layer');
  });
  it('renders an error page for an unknown slug',async()=>{
    const res=await get('/ai/nobody');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('MCP adapter',()=>{
  it('initializes and lists read-only tools',async()=>{
    const init:any=await (await rpc({jsonrpc:'2.0',id:1,method:'initialize'})).json();
    expect(init.result.serverInfo.name).toContain(slug);
    const list:any=await (await rpc({jsonrpc:'2.0',id:2,method:'tools/list'})).json();
    const names=list.result.tools.map((t:any)=>t.name);
    expect(names).toEqual(['get_business','search_catalog','get_item','get_policies','get_supported_actions']);
  });
  it('returns business data through the same service as the JSON API',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'get_business',arguments:{}}})).json();
    const viaTool=JSON.parse(r.result.content[0].text);
    const viaApi:any=await (await get(`/api/ai/${slug}/profile`)).json();
    expect(viaTool).toEqual(viaApi.business);
  });
  it('searches the catalogue',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:4,method:'tools/call',
      params:{name:'search_catalog',arguments:{query:'trail'}}})).json();
    expect(JSON.parse(r.result.content[0].text).results[0].title).toBe('Trail Runner GTX');
  });
  it('is honest when nothing matches instead of inventing a result',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:5,method:'tools/call',
      params:{name:'search_catalog',arguments:{query:'spaceship'}}})).json();
    const out=JSON.parse(r.result.content[0].text);
    expect(out.results).toEqual([]);
    expect(out.note).toContain('Nothing');
  });
  it('reports unsupported actions as unsupported, with a reason',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:6,method:'tools/call',
      params:{name:'get_supported_actions',arguments:{}}})).json();
    const actions=JSON.parse(r.result.content[0].text);
    const purchase=actions.find((a:any)=>a.type==='purchase');
    expect(purchase.supported).toBe(false);
    expect(purchase.limitations).toContain('never transacts');
    const cart=actions.find((a:any)=>a.type==='add_to_cart');
    expect(cart.supported).toBe(false);
  });
  it('exposes no tool that mutates anything',async()=>{
    const list:any=await (await rpc({jsonrpc:'2.0',id:7,method:'tools/list'})).json();
    for(const t of list.result.tools)
      expect(t.name,t.name).toMatch(/^(get|search|list)_/);
  });
  it('rejects an unknown tool',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'delete_everything',arguments:{}}})).json();
    expect(r.error.code).toBe(-32602);
  });
  it('rejects a non-JSON-RPC body and malformed JSON',async()=>{
    const bad:any=await (await rpc({method:'tools/list'})).json();
    expect(bad.error.code).toBe(-32600);
    const res=await worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/mcp`,{
      method:'POST',body:'{oops',headers:{'content-type':'application/json'}}),env);
    expect(res.status).toBe(400);
  });
  it('rejects an unsupported method',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:9,method:'resources/list'})).json();
    expect(r.error.code).toBe(-32601);
  });
  it('reports a missing item honestly',async()=>{
    const r:any=await (await rpc({jsonrpc:'2.0',id:10,method:'tools/call',
      params:{name:'get_item',arguments:{id:'nope'}}})).json();
    expect(JSON.parse(r.result.content[0].text).error).toContain('No item');
  });
});

describe('merchant control of the AI layer',()=>{
  const authed=async(method='GET',body?:unknown)=>{
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    return worker.fetch(new Request('https://agentcart.example/api/ai-layer',{method,
      headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
  };
  it('requires a session',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/ai-layer'),env)).status).toBe(401);
  });
  it('reports the public URLs',async()=>{
    const b:any=await (await authed()).json();
    expect(b.slug).toBe(slug);
    expect(b.publicUrl).toContain(`/ai/${slug}`);
    expect(b.mcpUrl).toContain('/mcp');
    expect(b.active).toBe(true);
  });
  it('lets the merchant switch the profile off and on',async()=>{
    await authed('POST',{active:false});
    expect((await get(`/api/ai/${slug}/profile`)).status).toBe(404);
    await authed('POST',{active:true});
    expect((await get(`/api/ai/${slug}/profile`)).status).toBe(200);
  });
});
