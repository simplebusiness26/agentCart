import {beforeEach,describe,expect,it} from 'vitest';
import {calibrate,runCase,scoreClaim} from '../src/launch/calibration';
import type {BenchmarkCase} from '../src/launch/calibration';
import {canPublishProfile,canScan,PLANNED_METHODS} from '../src/ownership';
import {linkShopToBusiness} from '../src/monitor';
import {saveShop} from '../src/db';
import {fakeEnv} from './helpers/env';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';

const ALLOW='User-agent: *\nAllow: /';
const BLOCK='User-agent: *\nDisallow: /';

const STRONG:BenchmarkCase={id:'strong-shopify',label:'Strong Shopify store',
  groundTruth:{discoverable:true,understandable:true,actionable:true},platform:'shopify',robots:ALLOW,sitemap:true,
  pages:[{url:'https://a.example/',type:'home',html:F.RICH_HOME},
    {url:'https://a.example/products/x',type:'product',html:F.RICH_PRODUCT},
    {url:'https://a.example/pages/contact',type:'contact',html:F.CONTACT_PAGE},
    {url:'https://a.example/policies/shipping-policy',type:'shipping',html:F.POLICY_PAGE('Delivery','Ships in two working days worldwide with tracking and a fourteen day guarantee.')},
    {url:'https://a.example/policies/refund-policy',type:'returns',html:F.POLICY_PAGE('Returns','Thirty day returns on anything unused, no questions asked, refunded in full.')}]};

const NO_SCHEMA:BenchmarkCase={id:'no-structured-data',label:'Usable checkout, no structured data',
  groundTruth:{discoverable:true,understandable:true,actionable:true},robots:ALLOW,sitemap:true,
  pages:[{url:'https://b.example/',type:'home',
    html:F.RICH_HOME.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')},
    {url:'https://b.example/products/x',type:'product',
     html:F.RICH_PRODUCT.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')},
    {url:'https://b.example/pages/contact',type:'contact',html:F.CONTACT_PAGE},
    {url:'https://b.example/policies/shipping-policy',type:'shipping',html:F.POLICY_PAGE('Delivery','Ships in two working days worldwide with tracking and a fourteen day guarantee.')},
    {url:'https://b.example/policies/refund-policy',type:'returns',html:F.POLICY_PAGE('Returns','Thirty day returns on anything unused, no questions asked, refunded in full.')}]};

const BROKEN:BenchmarkCase={id:'inaccessible-controls',label:'Ambiguous, script-only controls',
  groundTruth:{discoverable:true,understandable:false,actionable:false},robots:ALLOW,sitemap:false,
  pages:[{url:'https://c.example/',type:'home',html:F.BARE_HOME}]};

const CRAWLER_BLOCKED:BenchmarkCase={id:'crawler-blocked',label:'Blocks all crawlers',
  groundTruth:{discoverable:false,understandable:true,actionable:true},robots:BLOCK,sitemap:false,
  pages:[{url:'https://d.example/',type:'home',html:F.RICH_HOME},
    {url:'https://d.example/products/x',type:'product',html:F.RICH_PRODUCT}]};

const SERVICE:BenchmarkCase={id:'service-booking',label:'Service business with booking',
  groundTruth:{discoverable:true,understandable:true,actionable:true},robots:ALLOW,sitemap:true,
  pages:[{url:'https://e.example/',type:'home',html:F.SERVICE_HOME},
    {url:'https://e.example/book',type:'booking',html:F.BOOKING_PAGE},
    {url:'https://e.example/contact',type:'contact',html:F.CONTACT_PAGE},
    {url:'https://e.example/privacy',type:'policy',html:F.POLICY_PAGE('Privacy','What we store about you and for how long, and how to ask us to delete it.')},
    {url:'https://e.example/faqs',type:'faq',html:F.POLICY_PAGE('Questions','Common questions about appointments, fees, cancellations and emergency care.')}]};

const STALE:BenchmarkCase={id:'no-price-or-stock',label:'Missing price and stock',
  groundTruth:{discoverable:true,understandable:false,actionable:false},robots:ALLOW,sitemap:true,
  pages:[{url:'https://f.example/',type:'home',
    html:F.RICH_HOME.replace(/£29\.00|In stock/g,'').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')},
    {url:'https://f.example/products/x',type:'product',
     html:F.RICH_PRODUCT.replace(/&pound;79\.00/g,'call us').replace(/In stock/g,'')
       .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'')
       .replace(/<form action="\/cart\/add">[\s\S]*?<\/form>/,'<div onclick="add()">Add</div>')
       .replace(/<a href="\/checkout">[\s\S]*?<\/a>/,'')}]};

const SUITE=[STRONG,NO_SCHEMA,BROKEN,CRAWLER_BLOCKED,SERVICE,STALE];

describe('scoring is deterministic and versioned',()=>{
  it('gives identical results for identical input',()=>{
    expect(JSON.stringify(runCase(STRONG))).toBe(JSON.stringify(runCase(STRONG)));
  });
  it('records the scoring version on every run',()=>{
    expect(calibrate(SUITE).scoringVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('score order matches what an agent could actually do',()=>{
  it('a strong store outscores one an agent cannot use',()=>{
    expect(runCase(STRONG).score).toBeGreaterThan(runCase(BROKEN).score);
  });
  it('missing price and stock costs real points',()=>{
    expect(runCase(STALE).score).toBeLessThan(runCase(STRONG).score);
  });
  it('a usable store without structured data still scores respectably',()=>{
    const s=runCase(NO_SCHEMA).score;
    expect(s).toBeLessThan(runCase(STRONG).score);
    expect(s).toBeGreaterThan(runCase(BROKEN).score);
  });
  it('a service business is not punished for having no catalogue',()=>{
    expect(runCase(SERVICE).score).toBeGreaterThan(runCase(BROKEN).score);
  });
  it('blocking every crawler produces a real deduction',()=>{
    const blocked=runCase(CRAWLER_BLOCKED);
    expect(blocked.checks.find(c=>c.key==='access-crawl')!.status).toBe('fail');
  });
});

describe('calibration reports disagreements honestly',()=>{
  it('finds no false positives or negatives across the benchmark',()=>{
    const r=calibrate(SUITE);
    expect(r.falsePositives,JSON.stringify(r.cases.filter(c=>c.discrepancy))).toBe(0);
    expect(r.falseNegatives,JSON.stringify(r.cases.filter(c=>c.discrepancy))).toBe(0);
  });
  it('flags a high score on a site an agent cannot use',()=>{
    const lying={...STRONG,id:'lying',groundTruth:{discoverable:false,understandable:false,actionable:false}};
    const r=calibrate([...SUITE,lying]);
    expect(r.falsePositives).toBe(1);
    expect(r.validated).toBe(false);
  });
  it('refuses to call the score validated on too small a benchmark',()=>{
    expect(calibrate([STRONG]).validated).toBe(false);
  });
  it('states an honest claim in each case',()=>{
    expect(scoreClaim(calibrate(SUITE))).toContain('agrees with what an agent could actually do');
    expect(scoreClaim({...calibrate(SUITE),validated:false})).toContain('not yet been validated');
  });
});

describe('ownership boundary',()=>{
  const SHOP='mine.myshopify.com';
  let env:Env;
  beforeEach(async()=>{env=fakeEnv().env;await saveShop(env,SHOP,'tok');});

  it('lets anyone scan a public site',()=>{
    expect(canScan().allowed).toBe(true);
  });

  // The acceptance criterion the spec states.
  it('will not let an unauthenticated visitor publish a profile for someone else',async()=>{
    const d=await canPublishProfile(env,'someone-elses-business.com',null);
    expect(d.allowed).toBe(false);
    expect(d.howToProve.length).toBeGreaterThan(0);
  });

  it('will not let one merchant publish for another business',async()=>{
    const d=await canPublishProfile(env,'competitor.com',SHOP);
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('not linked');
  });

  it('allows a merchant to publish for their own linked website',async()=>{
    await linkShopToBusiness(env,SHOP,'mine.com');
    const d=await canPublishProfile(env,'mine.com',SHOP);
    expect(d.allowed).toBe(true);
    expect(d.method).toBe('shopify_oauth');
  });

  it('allows a merchant to publish for their own myshopify domain',async()=>{
    expect((await canPublishProfile(env,SHOP,SHOP)).allowed).toBe(true);
  });

  it('does not accept a similar name or matching email domain as proof',async()=>{
    await linkShopToBusiness(env,SHOP,'mine.com');
    for(const lookalike of ['mine.co','mine.com.evil.com','notmine.com','mine-shop.com'])
      expect((await canPublishProfile(env,lookalike,SHOP)).allowed,lookalike).toBe(false);
  });

  it('is honest that other verification methods are planned, not available',()=>{
    expect(PLANNED_METHODS.find(m=>m.method==='shopify_oauth')!.status).toBe('available');
    expect(PLANNED_METHODS.filter(m=>m.status==='planned').length).toBeGreaterThan(2);
  });
});
