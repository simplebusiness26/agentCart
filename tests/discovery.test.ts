import {beforeEach,describe,expect,it} from 'vitest';
import worker from '../src/index';
import {assessDiscovery,discoveryScoreContribution,parseUcpManifest} from '../src/providers/discovery';
import {buildAgentsMd} from '../src/ailayer/agentsmd';
import {ensureProfile} from '../src/ailayer/service';
import {saveBusinessProfile,saveCatalog} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {encryptToken} from '../src/shopify';
import {insertEvent,saveShop,setIngestToken} from '../src/db';
import {TEST_KEY,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

// A manifest matching the shape verified from ucp.dev on 2026-09-10.
const VALID_UCP=JSON.stringify({
  ucp:{version:"2026-04-08",
    services:{"dev.ucp.shopping":{version:"2026-04-08",transport:"rest",
      endpoint:"https://shop.example/ucp",schema:"https://shop.example/openapi.json",spec:"https://ucp.dev"}},
    capabilities:{"dev.ucp.shopping.checkout":[{version:"1",schema:"https://ucp.dev/s.json",spec:"https://ucp.dev"}]},
    payment_handlers:{"dev.ucp.payment.card":{id:"card",version:"1",schema:"s",spec:"p"}}},
  keys:[{kid:"k1",kty:"EC",alg:"ES256",crv:"P-256",x:"a",y:"b"}]
});
const ok=(body:string)=>({ok:true,body,status:200});
const missing={ok:false,body:'',status:404};

describe('UCP manifest parsing',()=>{
  it('reads a valid manifest',()=>{
    const s=parseUcpManifest(VALID_UCP);
    expect(s.valid).toBe(true);
    expect(s.version).toBe('2026-04-08');
    expect(s.capabilities).toEqual(['dev.ucp.shopping.checkout']);
    expect(s.services[0]).toMatchObject({key:'dev.ucp.shopping',transport:'rest'});
    expect(s.paymentHandlers).toEqual(['dev.ucp.payment.card']);
    expect(s.hasKeys).toBe(true);
    expect(s.problems).toEqual([]);
  });
  it('does not assume a fixed set of reverse-domain keys',()=>{
    const custom=JSON.stringify({ucp:{version:"draft",
      services:{"com.example.custom":{transport:"mcp",endpoint:"https://x"}},
      capabilities:{"com.example.custom.thing":[{version:"1"}]}}});
    const s=parseUcpManifest(custom);
    expect(s.valid).toBe(true);
    expect(s.capabilities).toEqual(['com.example.custom.thing']);
  });
  it('reports a missing version as a problem',()=>{
    const s=parseUcpManifest(JSON.stringify({ucp:{capabilities:{"a.b":[{}]}}}));
    expect(s.valid).toBe(false);
    expect(s.problems.join(' ')).toContain('ucp.version');
  });
  it('flags capabilities declared with no services to reach them',()=>{
    const s=parseUcpManifest(JSON.stringify({ucp:{version:"draft",capabilities:{"a.b":[{}]}}}));
    expect(s.problems.join(' ')).toContain('cannot reach them');
  });
  it('flags an unrecognised transport',()=>{
    const s=parseUcpManifest(JSON.stringify({ucp:{version:"draft",
      services:{"a.b":{transport:"carrier-pigeon",endpoint:"x"}},capabilities:{"a.b.c":[{}]}}}));
    expect(s.problems.join(' ')).toContain('carrier-pigeon');
  });
  it('never throws on hostile input',()=>{
    for(const junk of ['','not json','null','[]','{"ucp":null}','{"ucp":42}','{"ucp":{"services":"x"}}'])
      expect(()=>parseUcpManifest(junk),junk).not.toThrow();
  });
});

describe('discovery findings',()=>{
  it('records each file separately',()=>{
    expect(assessDiscovery('agents_md',ok('# Hi')).state).toBe('pass');
    expect(assessDiscovery('llms_txt',missing).state).toBe('unsupported');
  });
  it('treats an absent optional file as unsupported, never a failure',()=>{
    for(const kind of ['agents_md','llms_txt','llms_full_txt'] as const){
      const f=assessDiscovery(kind,missing);
      expect(f.state,kind).toBe('unsupported');
      expect(f.state,kind).not.toBe('fail');
    }
  });
  it('treats a published but empty file as a real failure',()=>{
    expect(assessDiscovery('agents_md',ok('')).state).toBe('fail');
  });
  it('treats a published but broken UCP manifest as a failure',()=>{
    const f=assessDiscovery('ucp_manifest',ok('{"ucp":{}}'));
    expect(f.state).toBe('fail');
    expect(f.detail).toContain('not usable');
  });
  it('recognises a platform-provided file rather than telling the merchant to hand-create it',()=>{
    const f=assessDiscovery('sitemap',missing,'shopify');
    expect(f.platformProvided).toBe(true);
    expect(f.detail).toContain('platform normally provides this');
  });
  it('does not claim a platform provides a file when that is unverified',()=>{
    // Shopify-native /.well-known/ucp publication is explicitly unverified in our research.
    expect(assessDiscovery('ucp_manifest',missing,'shopify').platformProvided).toBe(false);
  });
  it('is unknown when a file was not checked at all',()=>{
    expect(assessDiscovery('agents_md',undefined).state).toBe('unknown');
  });
  it('always records evidence',()=>{
    for(const f of [assessDiscovery('agents_md',ok('x')),assessDiscovery('agents_md',missing)])
      expect(f.evidence.length).toBeGreaterThan(0);
  });
});

describe('no single discovery file dominates the score',()=>{
  it('caps the contribution regardless of how many files exist',()=>{
    const all=(['agents_md','llms_txt','llms_full_txt','ucp_manifest'] as const)
      .map(k=>assessDiscovery(k,ok(k==='ucp_manifest'?VALID_UCP:'x')));
    const c=discoveryScoreContribution(all);
    expect(c.points).toBeLessThanOrEqual(3);
    expect(c.maxPoints).toBe(3);
  });
  it('publishing only agents.md does not max the contribution',()=>{
    const c=discoveryScoreContribution([assessDiscovery('agents_md',ok('# x'))]);
    expect(c.points).toBeLessThan(c.maxPoints);
  });
  it('excludes the sitemap, which is scored elsewhere',()=>{
    expect(discoveryScoreContribution([assessDiscovery('sitemap',ok('<urlset/>'))]).maxPoints).toBe(0);
  });
});

describe('hosted agents.md',()=>{
  const SHOP='northbound.myshopify.com';
  const TOKEN='shpat_hosted_secret';
  let env:Env; let slug:string;

  beforeEach(async()=>{
    env=fakeEnv().env;
    await saveShop(env,SHOP,await encryptToken(TOKEN,TEST_KEY));
    await setIngestToken(env,SHOP,'ingest-secret');
    await saveBusinessProfile(env,SHOP,{name:'Northbound Outfitters',description:'Cold weather gear.',
      contactEmail:'hello@northbound.example',contactPhone:'+441134960100',
      address:{city:'Leeds',country:'United Kingdom'},currency:'GBP',
      primaryUrl:'https://northbound.example',
      policies:[{type:'REFUND_POLICY',title:'Refunds',url:'https://x/r',body:'30 days.'}]},1000);
    await saveCatalog(env,SHOP,[1,2].map(i=>({...normalizeProduct(S.productNode(i),SHOP),
      title:['Merino Base Layer','Trail Runner GTX'][i-1]})),1000);
    await insertEvent(env,{shop:SHOP,eventId:'e1',eventType:'checkout_completed',
      occurredAt:new Date().toISOString(),orderId:'999',sessionId:'sess-private'},'ChatGPT','chatgpt.com');
    slug=await ensureProfile(env,SHOP);
  });

  it('describes the business, endpoints and actions',async()=>{
    const md=(await buildAgentsMd(env,SHOP,slug,'https://agentcart.example'))!;
    expect(md).toContain('# Northbound Outfitters');
    expect(md).toContain(`/api/ai/${slug}/catalog`);
    expect(md).toContain('/mcp');
    expect(md).toContain('Merino Base Layer');
  });

  it('is honest about what an agent cannot do',async()=>{
    const md=(await buildAgentsMd(env,SHOP,slug,'https://agentcart.example'))!;
    expect(md).toContain('Not supported');
    expect(md.toLowerCase()).toContain('never transacts');
  });

  it('leaks no credentials, customer data or internal analytics',async()=>{
    const md=(await buildAgentsMd(env,SHOP,slug,'https://agentcart.example'))!;
    for(const secret of [TOKEN,'ingest-secret','sess-private','999',SHOP])
      expect(md,`leaked ${secret}`).not.toContain(secret);
  });

  it('is served over the public AI layer with an ETag',async()=>{
    const res=await worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/agents.md`),env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/markdown');
    const etag=res.headers.get('etag')!;
    const again=await worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/agents.md`,
      {headers:{'if-none-match':etag}}),env);
    expect(again.status).toBe(304);
  });

  it('404s for a business with no synced profile',async()=>{
    const f=fakeEnv();
    await saveShop(f.env,SHOP,'tok');
    const s=await ensureProfile(f.env,SHOP);
    const res=await worker.fetch(new Request(`https://agentcart.example/api/ai/${s}/agents.md`),f.env);
    expect(res.status).toBe(404);
  });

  it('does not drift from the JSON API it is generated from',async()=>{
    const md=(await buildAgentsMd(env,SHOP,slug,'https://agentcart.example'))!;
    const api:any=await (await worker.fetch(new Request(`https://agentcart.example/api/ai/${slug}/profile`),env)).json();
    expect(md).toContain(api.business.name);
    for(const a of api.actions.filter((x:any)=>!x.supported))
      expect(md).toContain(a.description);
  });
});
