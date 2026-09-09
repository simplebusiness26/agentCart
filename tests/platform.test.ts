import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ShopifyAdapter,ShopifyScopeError,normalizeProduct} from '../src/platform/shopify';
import {getBusinessProfile,getCatalog,getCatalogItem,getLastSync,saveCatalog,searchCatalog,syncConnectedStore} from '../src/platform';
import {encryptToken,sessionCookie} from '../src/shopify';
import worker from '../src/index';
import {saveShop} from '../src/db';
import {TEST_KEY,TEST_SECRET,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

const SHOP='northbound.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});
afterEach(()=>vi.unstubAllGlobals());

// Replies in order, matching on the operation name in the query body.
function mockAdmin(handler:(query:string)=>unknown,status=200){
  vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{
    const body=JSON.parse(init.body);
    const out=handler(body.query);
    return new Response(JSON.stringify(out),{status,headers:{'content-type':'application/json'}});
  }));
}
const standard=(pages=1)=>{
  let call=0;
  return (q:string)=>{
    if(q.includes('query Shop'))return S.SHOP_RESPONSE;
    if(q.includes('query Policies'))return S.POLICY_RESPONSE;
    call++;
    return S.productsResponse([S.productNode(call)],call<pages,`c${call}`);
  };
};
const connect=async()=>saveShop(env,SHOP,await encryptToken('shpat_test',TEST_KEY));

describe('normalizeProduct',()=>{
  const item=normalizeProduct(S.productNode(1),SHOP);
  it('strips markup out of the description',()=>{
    expect(item.description).toBe('Description for item 1 with markup .');
    expect(item.description).not.toContain('<');
  });
  it('captures the price range and currency',()=>{
    expect(item.priceMin).toBe(29);
    expect(item.priceMax).toBe(49);
    expect(item.currency).toBe('GBP');
  });
  it('reports available when any variant is available',()=>{
    expect(item.available).toBe(true);
    expect(normalizeProduct(S.productNode(2,{variants:{nodes:[{availableForSale:false,price:"1.00"}]}}),SHOP).available).toBe(false);
  });
  it('keeps identifiers and SEO fields',()=>{
    expect(item.identifiers.sku).toBe('NB-1-S');
    expect(item.identifiers.barcode).toBeTruthy();
    expect(item.seoTitle).toBe('Item 1 SEO');
  });
  it('falls back to a constructed URL when onlineStoreUrl is absent',()=>{
    expect(normalizeProduct(S.productNode(3,{onlineStoreUrl:null}),SHOP).url).toContain(`https://${SHOP}/products/item-3`);
  });
  it('does not throw on a sparse node',()=>{
    expect(()=>normalizeProduct({},SHOP)).not.toThrow();
  });
});

describe('ShopifyAdapter',()=>{
  it('normalizes the business profile',async()=>{
    mockAdmin(standard());
    const b=await new ShopifyAdapter(env).syncBusiness(SHOP,'tok');
    expect(b.name).toBe('Northbound Outfitters');
    expect(b.description).toBe('Cold weather hiking gear, made in Yorkshire.');
    expect(b.currency).toBe('GBP');
    expect(b.address.zip).toBe('LS1 6BY');
    expect(b.policies.length).toBe(2);
    expect(b.policies[0].body).not.toContain('<p>');
  });

  it('still returns a profile when policies fail',async()=>{
    mockAdmin(q=>q.includes('query Policies')?{errors:[{message:'boom'}]}:S.SHOP_RESPONSE);
    const b=await new ShopifyAdapter(env).syncBusiness(SHOP,'tok');
    expect(b.name).toBe('Northbound Outfitters');
    expect(b.policies).toEqual([]);
  });

  it('paginates the catalogue',async()=>{
    mockAdmin(standard(3));
    const items=await new ShopifyAdapter(env).syncCatalog(SHOP,'tok');
    expect(items.length).toBe(3);
  });

  it('stops at the requested limit',async()=>{
    let call=0;
    mockAdmin(q=>{
      if(q.includes('query Shop'))return S.SHOP_RESPONSE;
      call++;return S.productsResponse([S.productNode(call),S.productNode(call+100)],true,`c${call}`);
    });
    expect((await new ShopifyAdapter(env).syncCatalog(SHOP,'tok',3)).length).toBe(3);
  });

  it('does not paginate for ever on a pathological catalogue',async()=>{
    let calls=0;
    mockAdmin(q=>{
      if(q.includes('query Shop'))return S.SHOP_RESPONSE;
      calls++;return S.productsResponse([S.productNode(calls)],true,'always-more');
    });
    await new ShopifyAdapter(env).syncCatalog(SHOP,'tok',100000);
    expect(calls).toBeLessThanOrEqual(10);
  });

  it('reports a missing scope distinctly from a transport failure',async()=>{
    mockAdmin(()=>S.ACCESS_DENIED);
    await expect(new ShopifyAdapter(env).syncCatalog(SHOP,'tok')).rejects.toBeInstanceOf(ShopifyScopeError);
    mockAdmin(()=>({}),500);
    await expect(new ShopifyAdapter(env).syncCatalog(SHOP,'tok')).rejects.toThrow(/Shopify API error/);
  });

  it('treats a 403 as needing reauthorization',async()=>{
    mockAdmin(()=>({}),403);
    await expect(new ShopifyAdapter(env).syncBusiness(SHOP,'tok')).rejects.toBeInstanceOf(ShopifyScopeError);
  });
});

describe('syncConnectedStore',()=>{
  it('persists the profile and catalogue and records the run',async()=>{
    await connect();
    mockAdmin(standard(2));
    const out=await syncConnectedStore(env,SHOP);
    expect(out.items).toBe(2);
    expect((await getBusinessProfile(env,SHOP))!.name).toBe('Northbound Outfitters');
    expect((await getCatalog(env,SHOP)).length).toBe(2);
    expect((await getLastSync(env,SHOP))!.status).toBe('complete');
  });

  it('decrypts the stored token and never persists it',async()=>{
    await connect();
    mockAdmin(standard());
    await syncConnectedStore(env,SHOP);
    const tables=sqlite.prepare("select name from sqlite_master where type='table'").all().map((r:any)=>r.name);
    const dump=tables.filter((t:string)=>t!=='shops')
      .map((t:string)=>JSON.stringify(sqlite.prepare(`select * from "${t}"`).all())).join(' ');
    expect(dump).not.toContain('shpat_test');
  });

  it('refuses a store that is not connected',async()=>{
    await expect(syncConnectedStore(env,'nope.myshopify.com')).rejects.toThrow(/not connected/);
  });

  it('flags a scope failure as needing reauthorization',async()=>{
    await connect();
    mockAdmin(()=>S.ACCESS_DENIED);
    await expect(syncConnectedStore(env,SHOP)).rejects.toBeInstanceOf(ShopifyScopeError);
    expect((await getLastSync(env,SHOP))!.status).toBe('needs_reauthorization');
  });

  it('records an ordinary failure separately',async()=>{
    await connect();
    mockAdmin(()=>({}),500);
    await expect(syncConnectedStore(env,SHOP)).rejects.toThrow();
    const run=(await getLastSync(env,SHOP))!;
    expect(run.status).toBe('failed');
    expect(String(run.error)).toContain('Shopify API error');
  });

  it('removes items that disappeared upstream',async()=>{
    await connect();
    mockAdmin(standard(3));
    await syncConnectedStore(env,SHOP,1000);
    expect((await getCatalog(env,SHOP)).length).toBe(3);
    mockAdmin(standard(1));
    await syncConnectedStore(env,SHOP,2000);
    expect((await getCatalog(env,SHOP)).length).toBe(1);
  });
});

describe('catalogue queries',()=>{
  beforeEach(async()=>{
    await saveCatalog(env,SHOP,[1,2,3].map(i=>({
      ...normalizeProduct(S.productNode(i),SHOP),
      title:['Merino Base Layer','Trail Runner GTX','Insulated Flask'][i-1],
      productType:['Base layers','Footwear','Drinkware'][i-1]
    })),1000);
  });
  it('looks an item up by id or handle',async()=>{
    expect((await getCatalogItem(env,SHOP,'item-2'))!.title).toBe('Trail Runner GTX');
    expect((await getCatalogItem(env,SHOP,'gid://shopify/Product/2'))!.title).toBe('Trail Runner GTX');
  });
  it('returns nothing for an unknown item',async()=>{
    expect(await getCatalogItem(env,SHOP,'nope')).toBe(null);
  });
  it('searches title, type and vendor',async()=>{
    expect((await searchCatalog(env,SHOP,'merino')).length).toBe(1);
    expect((await searchCatalog(env,SHOP,'Footwear')).length).toBe(1);
    expect((await searchCatalog(env,SHOP,'northbound')).length).toBe(3);
  });
  it('does not let wildcards in a query match everything',async()=>{
    for(const q of ['%','_','%%','   ',''])
      expect((await searchCatalog(env,SHOP,q)).length,q).toBe(0);
  });
  it('keeps catalogues of different shops apart',async()=>{
    await saveCatalog(env,'other.myshopify.com',[normalizeProduct(S.productNode(9),'other.myshopify.com')],1000);
    expect((await getCatalog(env,SHOP)).length).toBe(3);
    expect((await getCatalog(env,'other.myshopify.com')).length).toBe(1);
  });
});

describe('sync routes',()=>{
  const authed=async(path:string,method='GET')=>{
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    return worker.fetch(new Request(`https://agentcart.example${path}`,{method,headers:{cookie}}),env);
  };

  it('requires a session',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/sync',{method:'POST'}),env);
    expect(res.status).toBe(401);
  });

  it('syncs and reports the item count',async()=>{
    await connect();
    mockAdmin(standard(2));
    const body:any=await (await authed('/api/sync','POST')).json();
    expect(body.ok).toBe(true);
    expect(body.items).toBe(2);
  });

  it('tells the merchant to reconnect when a scope is missing',async()=>{
    await connect();
    mockAdmin(()=>S.ACCESS_DENIED);
    const res=await authed('/api/sync','POST');
    expect(res.status).toBe(403);
    const body:any=await res.json();
    expect(body.needsReauthorization).toBe(true);
    expect(body.reconnectUrl).toContain('/connect?shop=');
  });

  it('does not present an upstream outage as a reauthorization prompt',async()=>{
    await connect();
    mockAdmin(()=>({}),500);
    const res=await authed('/api/sync','POST');
    expect(res.status).toBe(502);
    expect((await res.json() as any).needsReauthorization).toBeUndefined();
  });

  it('rate limits repeated syncs',async()=>{
    await connect();
    mockAdmin(standard());
    for(let i=0;i<4;i++)await authed('/api/sync','POST');
    expect((await authed('/api/sync','POST')).status).toBe(429);
  });

  it('reports sync status without exposing the token',async()=>{
    await connect();
    mockAdmin(standard());
    await authed('/api/sync','POST');
    const text=await (await authed('/api/sync/status')).text();
    expect(text).toContain('complete');
    expect(text).not.toContain('shpat_test');
  });
});
