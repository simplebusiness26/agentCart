import {beforeEach,describe,expect,it} from 'vitest';
import {assessAuthorizationReadiness} from '../src/standards/authorization';
import {CURRENT_MCP_VERSION,factByKey,queueStaleRegistryFacts,registrySnapshot,STANDARDS_REGISTRY_VERSION} from '../src/standards/registry';
import {fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

let env:Env;let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});

describe('the versioned standards/provider registry',()=>{
  it('has version, source, evidence and freshness on every fact',()=>{
    expect(STANDARDS_REGISTRY_VERSION).toBeTruthy();
    for(const fact of registrySnapshot(Date.parse('2026-09-17T12:00:00Z'))){
      expect(fact.key).toBeTruthy();expect(fact.source).toMatch(/^https:\/\//);
      expect(fact.version).toBeTruthy();expect(fact.effectiveBasis).not.toBe('unknown');
    }
    expect(factByKey('mcp.core')?.version).toBe(CURRENT_MCP_VERSION);
  });

  it('turns stale evidence into unknown rather than merchant failure',()=>{
    const facts=registrySnapshot(Date.parse('2027-09-17T00:00:00Z'));
    expect(facts.every(f=>f.stale&&f.reviewRequired&&f.effectiveBasis==='unknown')).toBe(true);
  });

  it('queues stale facts for review without rewriting them',async()=>{
    const before=factByKey('mcp.core',Date.parse('2027-09-17T00:00:00Z'));
    const queued=await queueStaleRegistryFacts(env,Date.parse('2027-09-17T00:00:00Z'));
    expect(queued).toContain('mcp.core');
    expect(sqlite.prepare("select status from standards_review_queue where registry_key='mcp.core'").get().status).toBe('queued');
    expect(factByKey('mcp.core',Date.parse('2027-09-17T00:00:00Z'))).toEqual(before);
  });
});

describe('authorization readiness stays evidence-bounded',()=>{
  it('does not invent tenant isolation or secret safety from one public call',()=>{
    const out=assessAuthorizationReadiness({authMode:'public',tools:[{name:'get_profile',
      inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]});
    expect(out.find(f=>f.key==='tenant_isolation')?.state).toBe('unknown');
    expect(out.find(f=>f.key==='secret_leakage')?.state).toBe('unknown');
    expect(out.find(f=>f.key==='scoped_writes')?.state).toBe('unsupported');
  });

  it('flags an observable credential-like value without retaining it',()=>{
    const out=assessAuthorizationReadiness({authMode:'public',tools:[],observedText:'Bearer abcdefghijklmnopqrstuvwxyz'});
    expect(out.find(f=>f.key==='secret_leakage')?.state).toBe('fail');
    expect(JSON.stringify(out)).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });
});
