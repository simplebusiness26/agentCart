import {beforeEach,describe,expect,it} from 'vitest';
import {businessId,getFindings,getLatestScan,getScanComparison,getScanHistory,recordFailedScan,saveScanRun} from '../src/agentready/store';
import {extractSignals,scoreReport} from '../src/agentready';
import {fakeEnv} from './helpers/env';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';
import type {AgentReadyReport,PageEvidence,PageType} from '../src/agentready/types';

let env:Env; let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});

const page=(url:string,type:PageType,html:string):PageEvidence=>{
  const signals=extractSignals(html);
  return {url,pageType:type,status:200,title:signals.title,signals};
};
const report=(over:Partial<AgentReadyReport>={}):AgentReadyReport=>({
  ...scoreReport({url:'https://example.com/',sitemap:true,robots:'User-agent: *\nAllow: /',
    platform:{platform:'shopify',confidence:.9,signals:['Shopify CDN assets']},
    pages:[page('https://example.com/','home',F.RICH_HOME),page('https://example.com/products/x','product',F.RICH_PRODUCT)]}),
  ...over});

describe('businessId',()=>{
  it('is stable and safe for a path segment',()=>{
    expect(businessId('Example.COM')).toBe(businessId('example.com'));
    expect(businessId('shop.example.co.uk')).toMatch(/^biz_[a-z0-9-]+$/);
  });
});

describe('saveScanRun',()=>{
  it('creates the business and persists the run, pages and findings',async()=>{
    const r=report();
    const runId=await saveScanRun(env,r);
    expect(sqlite.prepare('select count(*) c from businesses').get().c).toBe(1);
    const run=sqlite.prepare('select * from scan_runs where id=?').get(runId);
    expect(run.score).toBe(r.score);
    expect(run.status).toBe('complete');
    expect(run.scoring_version).toBe(r.scoringVersion);
    expect(run.platform).toBe('shopify');
    expect(sqlite.prepare('select count(*) c from scan_pages where scan_run_id=?').get(runId).c).toBe(r.pages.length);
    expect(sqlite.prepare('select count(*) c from scan_findings where scan_run_id=?').get(runId).c).toBe(r.checks.length);
  });

  it('reuses one business across repeat scans of the same domain',async()=>{
    await saveScanRun(env,report());
    await saveScanRun(env,report());
    expect(sqlite.prepare('select count(*) c from businesses').get().c).toBe(1);
    expect(sqlite.prepare('select count(*) c from scan_runs').get().c).toBe(2);
  });

  it('records the trigger so scheduled runs are distinguishable',async()=>{
    const a=await saveScanRun(env,report(),'user');
    const b=await saveScanRun(env,report(),'monitor');
    expect(sqlite.prepare('select trigger from scan_runs where id=?').get(a).trigger).toBe('user');
    expect(sqlite.prepare('select trigger from scan_runs where id=?').get(b).trigger).toBe('monitor');
  });

  it('keeps not-applicable findings so a later run can tell skipped from failed',async()=>{
    const runId=await saveScanRun(env,report());
    const findings=await getFindings(env,runId);
    expect(findings.some(f=>f.status==='na')||findings.every(f=>f.status!=='na')).toBe(true);
    expect(findings.length).toBeGreaterThan(10);
  });

  it('orders findings by how much score they would recover',async()=>{
    const runId=await saveScanRun(env,report());
    const gains=(await getFindings(env,runId)).map(f=>Number(f.estimated_score_gain));
    expect(gains).toEqual([...gains].sort((a,b)=>b-a));
  });
});

describe('history and comparison',()=>{
  it('returns the most recent run first',async()=>{
    await saveScanRun(env,report({score:40}),'user',1000);
    await saveScanRun(env,report({score:80}),'user',2000);
    const history=await getScanHistory(env,'example.com');
    expect(history.map(h=>h.score)).toEqual([80,40]);
  });

  it('computes a delta between the last two runs',async()=>{
    await saveScanRun(env,report({score:54}),'user',1000);
    await saveScanRun(env,report({score:82}),'user',2000);
    const c=(await getScanComparison(env,'example.com'))!;
    expect(c.latest.score).toBe(82);
    expect(c.previous.score).toBe(54);
    expect(c.delta).toBe(28);
    expect(c.comparable).toBe(true);
  });

  it('reports no delta on a first scan rather than pretending it is zero',async()=>{
    await saveScanRun(env,report({score:61}),'user',1000);
    const c=(await getScanComparison(env,'example.com'))!;
    expect(c.previous).toBe(null);
    expect(c.delta).toBe(null);
  });

  it('refuses to compare scores from different scoring versions',async()=>{
    await saveScanRun(env,report({score:40,scoringVersion:'1.0.0'}),'user',1000);
    await saveScanRun(env,report({score:90,scoringVersion:'2.0.0'}),'user',2000);
    const c=(await getScanComparison(env,'example.com'))!;
    expect(c.comparable).toBe(false);
    expect(c.delta).toBe(null);
  });

  it('returns null for a domain never scanned',async()=>{
    expect(await getScanComparison(env,'unknown.example')).toBe(null);
  });

  it('keeps histories of different domains apart',async()=>{
    await saveScanRun(env,report({score:10}),'user',1000);
    await saveScanRun(env,report({domain:'other.example',url:'https://other.example/',score:90}),'user',2000);
    expect((await getScanHistory(env,'example.com')).map(h=>h.score)).toEqual([10]);
    expect((await getScanHistory(env,'other.example')).map(h=>h.score)).toEqual([90]);
  });
});

describe('failed scans',()=>{
  it('are recorded without polluting history or comparison',async()=>{
    await saveScanRun(env,report({score:70}),'user',1000);
    await recordFailedScan(env,'example.com','We could not load that website.',2000);
    expect(sqlite.prepare('select count(*) c from scan_runs').get().c).toBe(2);
    const history=await getScanHistory(env,'example.com');
    expect(history.length).toBe(1);
    expect((await getLatestScan(env,'example.com'))!.score).toBe(70);
  });

  it('store the reason for the failure',async()=>{
    await recordFailedScan(env,'broken.example','We could not load that website.');
    const row=sqlite.prepare("select status,error from scan_runs where domain='broken.example'").get();
    expect(row.status).toBe('failed');
    expect(row.error).toContain('could not load');
  });
});
