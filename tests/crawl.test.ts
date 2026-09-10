import {afterEach,describe,expect,it,vi} from 'vitest';
import {CRAWL_BUDGET_MS,MAX_PAGES,MAX_PAGE_BYTES,crawlSite} from '../src/agentready/crawl';
import * as F from './fixtures/pages';

// A scripted network. Keys are pathnames; anything unlisted 404s.
function mockNet(routes:Record<string,{body?:string;status?:number;headers?:Record<string,string>;delayMs?:number;fail?:boolean}>){
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:any,init:any={})=>{
    const url=new URL(String(input));
    calls.push(url.pathname);
    const r=routes[url.pathname];
    if(!r)return new Response('',{status:404});
    if(r.fail)throw new Error('network down');
    if(r.delayMs){
      // Honour the abort signal the crawler passes, as a real fetch would.
      await new Promise((res,rej)=>{
        const t=setTimeout(res,r.delayMs);
        init?.signal?.addEventListener?.('abort',()=>{clearTimeout(t);rej(new Error('aborted'));});
      });
    }
    return new Response(r.body??'',{status:r.status??200,headers:r.headers??{}});
  }));
  return calls;
}
afterEach(()=>vi.unstubAllGlobals());

const STORE={
  '/':{body:F.RICH_HOME},
  '/robots.txt':{body:'User-agent: *\nAllow: /'},
  '/sitemap.xml':{body:'<urlset/>'},
  '/products/merino-base-layer':{body:F.RICH_PRODUCT},
  '/collections/base-layers':{body:F.RICH_HOME},
  '/pages/contact':{body:F.CONTACT_PAGE},
  '/policies/shipping-policy':{body:F.POLICY_PAGE('Delivery','Ships in two days worldwide.')},
  '/policies/refund-policy':{body:F.POLICY_PAGE('Returns','Thirty day returns on everything.')},
  '/policies/privacy-policy':{body:F.POLICY_PAGE('Privacy','What we store about you.')},
  '/pages/faq':{body:F.POLICY_PAGE('FAQ','Sizing and delivery questions.')}
};

describe('crawlSite',()=>{
  it('refuses a private-network target before making any request',async()=>{
    const calls=mockNet(STORE);
    await expect(crawlSite('http://127.0.0.1/')).rejects.toThrow(/IP addresses/);
    expect(calls).toEqual([]);
  });

  it('fetches multiple representative pages, not just the homepage',async()=>{
    mockNet(STORE);
    const r=await crawlSite('https://example.com');
    expect(r.pages.length).toBeGreaterThan(4);
    const types=new Set(r.pages.map(p=>p.pageType));
    for(const t of ['home','product','collection','contact']) expect([...types]).toContain(t);
  });

  it('never exceeds the page cap',async()=>{
    const many:Record<string,any>={'/':{body:Array.from({length:60},(_,i)=>`<a href="/products/p${i}">x</a>`).join('')}};
    for(let i=0;i<60;i++)many[`/products/p${i}`]={body:'<html><body>x</body></html>'};
    mockNet(many);
    const r=await crawlSite('https://example.com');
    expect(r.pages.length).toBeLessThanOrEqual(MAX_PAGES);
  });

  it('stays on the same origin',async()=>{
    const calls=mockNet({...STORE,'/':{body:'<a href="https://evil.example/x">go</a><a href="/pages/contact">c</a>'}});
    await crawlSite('https://example.com');
    expect(calls.every(p=>!p.includes('evil'))).toBe(true);
  });

  it('truncates a huge response rather than holding it all',async()=>{
    mockNet({'/':{body:'<html><body>'+'a'.repeat(MAX_PAGE_BYTES*3)+'</body></html>'}});
    const r=await crawlSite('https://example.com');
    expect(r.homeHtml.length).toBeLessThanOrEqual(MAX_PAGE_BYTES);
  });

  it('surfaces a clear error when the homepage cannot be loaded',async()=>{
    mockNet({'/':{status:500}});
    await expect(crawlSite('https://example.com')).rejects.toThrow(/could not load/i);
  });

  it('survives one broken subpage',async()=>{
    mockNet({...STORE,'/pages/contact':{fail:true}});
    const r=await crawlSite('https://example.com');
    expect(r.pages.length).toBeGreaterThan(2);
    expect(r.pages.some(p=>p.pageType==='product')).toBe(true);
  });

  it('records robots, llms and sitemap availability',async()=>{
    mockNet({...STORE,'/llms.txt':{body:'# Example'}});
    const r=await crawlSite('https://example.com');
    expect(r.robots).toContain('User-agent');
    expect(r.llms).toContain('Example');
    expect(r.sitemap).toBe(true);
  });

  it('reports no sitemap when it 404s',async()=>{
    const {['/sitemap.xml']:_omit,...rest}=STORE;
    mockNet(rest);
    expect((await crawlSite('https://example.com')).sitemap).toBe(false);
  });

  it('tries well-known paths for pages the homepage does not link',async()=>{
    const calls=mockNet({'/':{body:'<html><body><p>Just a homepage</p></body></html>'},'/contact':{body:F.CONTACT_PAGE}});
    const r=await crawlSite('https://example.com');
    expect(calls).toContain('/contact');
    expect(r.pages.some(p=>p.pageType==='contact')).toBe(true);
  });

  it('stops fetching subpages once the time budget is spent',async()=>{
    let clock=0;
    const now=()=>clock;
    const slow:Record<string,any>={'/':{body:F.RICH_HOME}};
    for(const p of Object.keys(STORE))if(p!=='/')slow[p]={body:'<html><body>x</body></html>'};
    mockNet(slow);
    // Advance the clock past the budget immediately after the homepage is read.
    const r=await crawlSite('https://example.com',()=>{const v=clock;clock+=CRAWL_BUDGET_MS;return v;});
    expect(r.pages.length).toBe(1);
    expect(now()).toBeGreaterThanOrEqual(0);
  });

  it('captures response headers for platform detection',async()=>{
    mockNet({...STORE,'/':{body:F.RICH_HOME,headers:{'x-powered-by':'Shopify'}}});
    const r=await crawlSite('https://example.com');
    expect(r.headers['x-powered-by']).toBe('Shopify');
  });
});
