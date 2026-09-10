import {beforeEach,describe,expect,it,vi,afterEach} from 'vitest';
import worker from '../src/index';
import {LAUNCH_CHECKS,launchStatus,recordLaunchResults,redact,missingPrerequisites} from '../src/launch/gate';
import {runLaunchGate} from '../src/launch/runner';
import {saveShop} from '../src/db';
import {sessionCookie} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env; let sqlite:any;
beforeEach(async()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;await saveShop(env,SHOP,'tok');});
afterEach(()=>vi.unstubAllGlobals());

const authed=async(path:string,method='GET',body?:unknown)=>{
  const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
  return worker.fetch(new Request(`https://agentcart.example${path}`,{method,
    headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined}),env);
};

// The single most important property of this whole phase.
describe('green tests never make the MVP launch ready',()=>{
  it('starts not ready, with every check unrun',async()=>{
    const s=await launchStatus(env);
    expect(s.readyForLaunch).toBe(false);
    expect(s.notRun).toBe(LAUNCH_CHECKS.length);
    expect(s.summary).toContain('a green test suite does not establish this');
  });

  it('stays not ready even with the entire suite passing',async()=>{
    // This test itself is part of a green suite; that must change nothing.
    expect((await launchStatus(env)).readyForLaunch).toBe(false);
  });

  it('is not ready until every single check has a recorded pass',async()=>{
    const all=LAUNCH_CHECKS.map(c=>({key:c.key,status:'pass' as const,evidence:'ok'}));
    await recordLaunchResults(env,'r1','production','v1',all.slice(0,-1));
    expect((await launchStatus(env)).readyForLaunch).toBe(false);
    await recordLaunchResults(env,'r2','production','v1',all);
    expect((await launchStatus(env)).readyForLaunch).toBe(true);
  });

  it('a single failure removes readiness',async()=>{
    await recordLaunchResults(env,'r1','production','v1',
      LAUNCH_CHECKS.map(c=>({key:c.key,status:'pass' as const,evidence:'ok'})));
    expect((await launchStatus(env)).readyForLaunch).toBe(true);
    await recordLaunchResults(env,'r2','production','v1',
      [{key:LAUNCH_CHECKS[0].key,status:'fail',failureReason:'regressed'}]);
    const s=await launchStatus(env);
    expect(s.readyForLaunch).toBe(false);
    expect(s.failed).toBe(1);
  });

  it('keeps environments separate',async()=>{
    await recordLaunchResults(env,'r1','staging','v1',
      LAUNCH_CHECKS.map(c=>({key:c.key,status:'pass' as const,evidence:'ok'})));
    expect((await launchStatus(env,'staging')).readyForLaunch).toBe(true);
    expect((await launchStatus(env,'production')).readyForLaunch).toBe(false);
  });
});

describe('the evidence record never stores secrets',()=>{
  it('redacts credentials of several shapes',()=>{
    const dirty=`token shpat_abcdef0123456789abcdef sk_live_9876543210abcdef `+
      `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef "api_key":"supersecretvalue" `+
      `deadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;
    const clean=redact(dirty);
    for(const secret of ['shpat_abcdef0123456789abcdef','sk_live_9876543210abcdef','supersecretvalue'])
      expect(clean,`leaked ${secret}`).not.toContain(secret);
    expect(clean).toContain('[redacted]');
  });
  it('redacts on the way into the database',async()=>{
    await recordLaunchResults(env,'r1','production','v1',
      [{key:'d1-migrations',status:'fail',evidence:'failed with shpat_abcdef0123456789abcdef',
        failureReason:'token shpat_abcdef0123456789abcdef rejected'}]);
    const dump=JSON.stringify(sqlite.prepare('select * from launch_checks').all());
    expect(dump).not.toContain('shpat_abcdef0123456789abcdef');
    expect(dump).toContain('[redacted]');
  });
  it('truncates very long evidence',()=>{
    expect(redact('x'.repeat(50000)).length).toBeLessThanOrEqual(1000);
  });
});

describe('every check declares why a mock cannot satisfy it',()=>{
  it('has a title, proof statement, reason and prerequisites',()=>{
    for(const c of LAUNCH_CHECKS){
      expect(c.title.length,c.key).toBeGreaterThan(5);
      expect(c.proves.length,c.key).toBeGreaterThan(20);
      expect(c.whyNotMockable.length,c.key).toBeGreaterThan(20);
      expect(c.requires.length,c.key).toBeGreaterThan(0);
    }
  });
  it('covers all eighteen checks from the plan',()=>{
    expect(LAUNCH_CHECKS.length).toBe(18);
    expect(new Set(LAUNCH_CHECKS.map(c=>c.key)).size).toBe(18);
  });
});

describe('running the gate without prerequisites',()=>{
  it('blocks everything rather than passing anything',async()=>{
    const f=fakeEnv({SHOPIFY_API_KEY:'',APP_URL:'http://localhost:8787'});
    await saveShop(f.env,SHOP,'tok');
    const out=await runLaunchGate(f.env,{shop:SHOP});
    expect(out.results.every(r=>r.status==='blocked')).toBe(true);
    expect(out.status.readyForLaunch).toBe(false);
    expect(out.results[0].failureReason).toContain('Missing configuration');
  });
  it('names what is missing',()=>{
    const f=fakeEnv({SHOPIFY_API_SECRET:'',APP_URL:'http://localhost:8787'});
    const missing=missingPrerequisites(f.env);
    expect(missing).toContain('SHOPIFY_API_SECRET');
    expect(missing.join(' ')).toContain('APP_URL');
  });
});

describe('running the gate with real-looking config',()=>{
  it('passes the D1 checks it can genuinely execute, blocks the manual ones',async()=>{
    const out=await runLaunchGate(env,{shop:SHOP,environment:'production',appVersion:'test'});
    const byKey=Object.fromEntries(out.results.map(r=>[r.key,r]));
    expect(byKey['d1-migrations'].status).toBe('pass');
    expect(byKey['d1-batch'].status).toBe('pass');
    // Manual checks must never be auto-passed.
    for(const c of LAUNCH_CHECKS.filter(c=>c.mode==='manual'))
      expect(byKey[c.key].status,c.key).not.toBe('pass');
    expect(out.status.readyForLaunch).toBe(false);
  });

  it('never marks a manual check as passed',async()=>{
    const out=await runLaunchGate(env,{shop:SHOP});
    for(const c of LAUNCH_CHECKS.filter(c=>c.mode==='manual')){
      const r=out.results.find(x=>x.key===c.key)!;
      expect(r.status,c.key).toBe('blocked');
      expect(r.remediation,c.key).toBeTruthy();
    }
  });

  it('blocks store-dependent checks when no store is connected',async()=>{
    const f=fakeEnv();
    const out=await runLaunchGate(f.env,{});
    expect(out.results.find(r=>r.key==='catalog-sync')!.status).toBe('blocked');
  });

  it('reports a real failure rather than throwing',async()=>{
    const out=await runLaunchGate(env,{shop:SHOP});
    const timestamps=out.results.find(r=>r.key==='pixel-timestamps')!;
    // No events have been received, so this legitimately fails.
    expect(timestamps.status).toBe('fail');
    expect(timestamps.failureReason).toContain('No pixel events');
  });
});

describe('launch routes',()=>{
  it('require a session',async()=>{
    for(const [p,m] of [['/api/launch','GET'],['/api/launch/run','POST']] as const)
      expect((await worker.fetch(new Request(`https://agentcart.example${p}`,{method:m}),env)).status,p).toBe(401);
  });
  it('state the hard rule in the response',async()=>{
    const body:any=await (await authed('/api/launch')).json();
    expect(body.readyForLaunch).toBe(false);
    expect(body.hardRule).toContain('never make AgentCart launch ready');
    expect(body.checks.length).toBe(18);
  });
  it('rate limit gate runs',async()=>{
    for(let i=0;i<4;i++)await authed('/api/launch/run','POST',{});
    expect((await authed('/api/launch/run','POST',{})).status).toBe(429);
  });
});

describe('the authoritative launch checklist',()=>{
  it('says not ready, and says why, before anything is set up',async()=>{
    const {buildChecklist}=await import('../src/launch/checklist');
    const f=fakeEnv({SHOPIFY_API_KEY:'',APP_URL:'http://localhost:8787'});
    const c=await buildChecklist(f.env);
    expect(c.readyForLaunch).toBe(false);
    expect(c.headline).toContain('not launch ready');
    expect(c.ownerActions.length).toBeGreaterThan(2);
  });

  it('states the hard rule',async()=>{
    const {buildChecklist,HARD_RULE}=await import('../src/launch/checklist');
    expect((await buildChecklist(env)).hardRule).toBe(HARD_RULE);
    expect(HARD_RULE).toContain('never make AgentCart launch ready');
  });

  it('marks the code as done but does not let that alone imply readiness',async()=>{
    const {buildChecklist}=await import('../src/launch/checklist');
    const c=await buildChecklist(env,SHOP);
    expect(c.items.find(i=>i.key==='code')!.state).toBe('done');
    expect(c.items.find(i=>i.key==='code')!.detail).toContain('not sufficient');
    expect(c.readyForLaunch).toBe(false);
  });

  it('separates what AgentCart owns from what the owner must do',async()=>{
    const {buildChecklist}=await import('../src/launch/checklist');
    const c=await buildChecklist(env,SHOP);
    expect(c.items.some(i=>i.owner==='agentcart')).toBe(true);
    expect(c.items.filter(i=>i.owner==='you').length).toBeGreaterThan(3);
  });

  it('only becomes ready once the gate itself passes',async()=>{
    const {buildChecklist}=await import('../src/launch/checklist');
    await recordLaunchResults(env,'r1','production','v1',
      LAUNCH_CHECKS.map(c=>({key:c.key,status:'pass' as const,evidence:'ok'})));
    const c=await buildChecklist(env,SHOP);
    expect(c.items.find(i=>i.key==='gate')!.state).toBe('done');
  });

  it('is served over a route',async()=>{
    const body:any=await (await authed('/api/launch/checklist')).json();
    expect(body.items.length).toBeGreaterThan(5);
    expect(body.readyForLaunch).toBe(false);
  });
});
