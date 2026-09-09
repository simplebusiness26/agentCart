import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {MONITOR_INTERVAL_MS,dueForMonitoring,linkShopToBusiness,monitorOne,monitoringHistory,runMonitorPass} from '../src/monitor';
import {saveScanRun} from '../src/agentready/store';
import {scoreReport,extractSignals} from '../src/agentready';
import {saveBusinessProfile} from '../src/platform';
import {encryptToken,sessionCookie} from '../src/shopify';
import {saveShop} from '../src/db';
import {TEST_KEY,TEST_SECRET,fakeEnv} from './helpers/env';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';
import type {AgentReadyReport,PageEvidence,PageType} from '../src/agentready/types';

const SHOP='northbound.myshopify.com';
const SITE='northbound.example';
const NOW=Date.parse('2026-09-09T03:00:00Z');
let env:Env; let sqlite:any;

const page=(url:string,type:PageType,html:string):PageEvidence=>{
  const s=extractSignals(html);return {url,pageType:type,status:200,title:s.title,signals:s};
};
const report=(over:Partial<AgentReadyReport>={}):AgentReadyReport=>({
  ...scoreReport({url:`https://${SITE}/`,sitemap:true,robots:'User-agent: *\nAllow: /',
    platform:{platform:'shopify',confidence:.9,signals:[]},
    pages:[page(`https://${SITE}/`,'home',F.RICH_HOME)]}),
  domain:SITE,...over});

// Mocks both the storefront crawl and the Shopify Admin calls the sync makes.
function mockNet(pages:Record<string,string>){
  vi.stubGlobal('fetch',vi.fn(async(input:any,init:any)=>{
    const url=new URL(String(input));
    if(url.pathname.includes('graphql'))return new Response(JSON.stringify({data:{shop:{
      name:'Northbound',description:'',contactEmail:'',url:`https://${SITE}`,currencyCode:'GBP',
      billingAddress:{}},products:{pageInfo:{hasNextPage:false},nodes:[]}}}),{status:200});
    const body=pages[url.pathname];
    return body===undefined?new Response('',{status:404}):new Response(body,{status:200});
  }));
}
const SITE_PAGES={
  '/':F.RICH_HOME,'/robots.txt':'User-agent: *\nAllow: /','/sitemap.xml':'<urlset/>',
  '/products/merino-base-layer':F.RICH_PRODUCT,'/pages/contact':F.CONTACT_PAGE,
  '/policies/shipping-policy':F.POLICY_PAGE('Delivery','Two days.'),
  '/policies/refund-policy':F.POLICY_PAGE('Returns','Thirty days.')
};

beforeEach(async()=>{
  const f=fakeEnv();env=f.env;sqlite=f.sqlite;
  await saveShop(env,SHOP,await encryptToken('shpat_test',TEST_KEY));
  await saveBusinessProfile(env,SHOP,{name:'Northbound',description:'',contactEmail:'',contactPhone:'',
    address:{},currency:'GBP',primaryUrl:`https://${SITE}`,policies:[]},1000);
});
afterEach(()=>vi.unstubAllGlobals());

const at=(ms:number,over:Partial<AgentReadyReport>={})=>report({scannedAt:new Date(ms).toISOString(),...over});

const connectBusiness=async()=>{
  await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*3),'user',NOW-MONITOR_INTERVAL_MS*3);
  await linkShopToBusiness(env,SHOP,SITE);
};

describe('selecting what to monitor',()=>{
  it('ignores businesses with no connected store',async()=>{
    await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*3),'user',NOW-MONITOR_INTERVAL_MS*3);
    expect(await dueForMonitoring(env,NOW)).toEqual([]);
  });

  it('picks up a store connected before any website scan existed',async()=>{
    // The real install order: Shopify connects, and only later is the site scanned.
    await linkShopToBusiness(env,SHOP,SITE);
    expect((await dueForMonitoring(env,NOW)).map(d=>d.domain)).toEqual([SITE]);
  });

  it('includes a connected business never monitored',async()=>{
    await connectBusiness();
    const due=await dueForMonitoring(env,NOW);
    expect(due.map(d=>d.domain)).toEqual([SITE]);
  });

  it('excludes one monitored inside the interval',async()=>{
    await connectBusiness();
    await saveScanRun(env,at(NOW-1000),'monitor',NOW-1000);
    expect(await dueForMonitoring(env,NOW)).toEqual([]);
  });

  it('includes one monitored longer ago than the interval',async()=>{
    await connectBusiness();
    await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS-1000),'monitor',NOW-MONITOR_INTERVAL_MS-1000);
    expect((await dueForMonitoring(env,NOW)).length).toBe(1);
  });

  it('takes the least recently monitored first and caps the batch',async()=>{
    for(let i=0;i<8;i++){
      const d=`shop${i}.example`;
      await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*3,{domain:d,url:`https://${d}/`}),'user',NOW-MONITOR_INTERVAL_MS*3);
      await linkShopToBusiness(env,`s${i}.myshopify.com`,d);
      await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS-i*1000,{domain:d,url:`https://${d}/`}),'monitor',NOW-MONITOR_INTERVAL_MS-i*1000);
    }
    const due=await dueForMonitoring(env,NOW,3);
    expect(due.length).toBe(3);
    expect(due[0].domain).toBe('shop7.example');
  });
});

describe('a monitoring run',()=>{
  it('records the run as monitor-triggered, not user-triggered',async()=>{
    await connectBusiness();
    mockNet(SITE_PAGES);
    await monitorOne(env,SITE,SHOP,NOW);
    const row=sqlite.prepare("select trigger from scan_runs where trigger='monitor'").get();
    expect(row.trigger).toBe('monitor');
  });

  it('reports an improvement against the previous score',async()=>{
    await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*2,{score:40}),'monitor',NOW-MONITOR_INTERVAL_MS*2);
    await linkShopToBusiness(env,SHOP,SITE);
    mockNet(SITE_PAGES);
    const out=await monitorOne(env,SITE,SHOP,NOW);
    expect(out.status).toBe('improved');
    expect(out.previous).toBe(40);
    expect(out.detail).toMatch(/Score improved 40 to \d+/);
  });

  it('reports a decline in the merchant own words',async()=>{
    await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*2,{score:100}),'monitor',NOW-MONITOR_INTERVAL_MS*2);
    await linkShopToBusiness(env,SHOP,SITE);
    mockNet(SITE_PAGES);
    const out=await monitorOne(env,SITE,SHOP,NOW);
    expect(out.status).toBe('declined');
    expect(out.detail).toMatch(/Score fell 100 to \d+/);
  });

  it('records a failure without inventing a score collapse',async()=>{
    await connectBusiness();
    mockNet({});
    const out=await monitorOne(env,SITE,SHOP,NOW);
    expect(out.status).toBe('failed');
    expect(out.score).toBe(null);
    expect(sqlite.prepare("select count(*) c from scan_runs where status='failed'").get().c).toBe(1);
    // A failed run must not enter the comparable history.
    expect(sqlite.prepare("select count(*) c from scan_runs where status='complete' and trigger='monitor'").get().c).toBe(0);
  });

  it('does not report a delta across different scoring models',async()=>{
    await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*2,{score:20,scoringVersion:'0.9.0'}),'monitor',NOW-MONITOR_INTERVAL_MS*2);
    await linkShopToBusiness(env,SHOP,SITE);
    mockNet(SITE_PAGES);
    const out=await monitorOne(env,SITE,SHOP,NOW);
    expect(out.previous).toBe(null);
    expect(out.delta).toBe(null);
  });
});

describe('a monitoring pass',()=>{
  it('processes due businesses and returns an outcome for each',async()=>{
    await connectBusiness();
    mockNet(SITE_PAGES);
    const outcomes=await runMonitorPass(env,NOW);
    expect(outcomes.length).toBe(1);
    expect(outcomes[0].domain).toBe(SITE);
  });

  it('does nothing when nothing is due',async()=>{
    expect(await runMonitorPass(env,NOW)).toEqual([]);
  });

  it('one failing business does not stop the rest of the batch',async()=>{
    for(const d of ['good.example','bad.example']){
      await saveScanRun(env,at(NOW-MONITOR_INTERVAL_MS*3,{domain:d,url:`https://${d}/`}),'user',NOW-MONITOR_INTERVAL_MS*3);
      await linkShopToBusiness(env,SHOP,d);
    }
    vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
      const url=new URL(String(input));
      if(url.pathname.includes('graphql'))return new Response(JSON.stringify({data:{}}),{status:200});
      if(url.hostname==='bad.example')throw new Error('network down');
      const body=(SITE_PAGES as any)[url.pathname];
      return body===undefined?new Response('',{status:404}):new Response(body,{status:200});
    }));
    const outcomes=await runMonitorPass(env,NOW);
    expect(outcomes.length).toBe(2);
    expect(outcomes.some(o=>o.status==='failed')).toBe(true);
    expect(outcomes.some(o=>o.status!=='failed')).toBe(true);
  });
});

describe('the scheduled handler',()=>{
  it('runs a pass without throwing',async()=>{
    await connectBusiness();
    mockNet(SITE_PAGES);
    const waits:Promise<unknown>[]=[];
    const ctx={waitUntil:(p:Promise<unknown>)=>waits.push(p),passThroughOnException(){}} as any;
    await (worker as any).scheduled({cron:'17 3 * * *'} as any,env,ctx);
    await Promise.all(waits);
    expect(sqlite.prepare("select count(*) c from scan_runs where trigger='monitor'").get().c).toBe(1);
  });

  it('survives a monitoring failure without throwing out of the handler',async()=>{
    await connectBusiness();
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('everything is down');}));
    const waits:Promise<unknown>[]=[];
    const ctx={waitUntil:(p:Promise<unknown>)=>waits.push(p),passThroughOnException(){}} as any;
    await expect((worker as any).scheduled({cron:'x'} as any,env,ctx)).resolves.toBeUndefined();
    await Promise.all(waits);
  });
});

describe('monitoring history',()=>{
  it('returns runs newest first with deltas between comparable runs',async()=>{
    // Linking before any scan exists is the real install order, so it must work.
    await linkShopToBusiness(env,SHOP,SITE);
    await saveScanRun(env,at(NOW-3000,{score:40}),'monitor',NOW-3000);
    await saveScanRun(env,at(NOW-2000,{score:60}),'monitor',NOW-2000);
    await saveScanRun(env,at(NOW-1000,{score:55}),'monitor',NOW-1000);
    const history=await monitoringHistory(env,SHOP);
    expect(history.map(h=>h.score)).toEqual([55,60,40]);
    expect(history[0].delta).toBe(-5);
    expect(history[1].delta).toBe(20);
    expect(history[2].delta).toBe(null);
  });

  it('is served over an authenticated route',async()=>{
    await linkShopToBusiness(env,SHOP,SITE);
    await saveScanRun(env,at(NOW-1000,{score:70}),'monitor',NOW-1000);
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    const res=await worker.fetch(new Request('https://agentcart.example/api/monitoring',{headers:{cookie}}),env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).history.length).toBe(1);
  });

  it('requires a session',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/monitoring'),env)).status).toBe(401);
  });
});
