import {describe,expect,it} from 'vitest';
import {accessForAgent,groupForAgent,parseRobots,providerAccess} from '../src/providers/robots';
import {PROVIDERS,isScoredPurpose,providerById,regionAvailability} from '../src/providers/registry';

const meta=providerById('meta')!;
const agent=(token:string)=>meta.crawlers.find(c=>c.token===token)!;

describe('robots parsing',()=>{
  it('groups consecutive user-agent lines together',()=>{
    const g=parseRobots(`User-agent: a\nUser-agent: b\nDisallow: /x\n\nUser-agent: c\nDisallow: /y`);
    expect(g.length).toBe(2);
    expect(g[0].agents).toEqual(['a','b']);
    expect(g[0].disallow).toEqual(['/x']);
    expect(g[1].agents).toEqual(['c']);
  });
  it('ignores comments and blank lines',()=>{
    const g=parseRobots(`# comment\nUser-agent: a   # trailing\nDisallow: /x\n\n  \n`);
    expect(g[0].agents).toEqual(['a']);
    expect(g[0].disallow).toEqual(['/x']);
  });
  it('does not throw on junk',()=>{
    for(const junk of ['','????','\n\n\n','User-agent:','Disallow: /'.repeat(500)])
      expect(()=>parseRobots(junk)).not.toThrow();
  });
  it('picks the most specific matching agent group over the wildcard',()=>{
    const g=parseRobots(`User-agent: *\nDisallow: /\n\nUser-agent: meta-externalfetcher\nAllow: /`);
    expect(groupForAgent(g,'meta-externalfetcher')!.allow).toEqual(['/']);
    expect(groupForAgent(g,'some-other-bot')!.disallow).toEqual(['/']);
  });
  it('matches Meta tokens written with a version suffix',()=>{
    const g=parseRobots(`User-agent: meta-externalagent/1.1\nDisallow: /`);
    expect(groupForAgent(g,'meta-externalagent')).toBeTruthy();
  });
  it('lets a more specific Allow override a Disallow',()=>{
    const g=parseRobots(`User-agent: *\nDisallow: /\nAllow: /products/`);
    expect(accessForAgent(g,meta,agent('meta-webindexer'),'/products/x').allowed).toBe(true);
    expect(accessForAgent(g,meta,agent('meta-webindexer'),'/private').allowed).toBe(false);
  });
  it('supports wildcard and end-anchored rules',()=>{
    const g=parseRobots(`User-agent: *\nDisallow: /*.pdf$`);
    expect(accessForAgent(g,meta,agent('meta-webindexer'),'/a/b.pdf').allowed).toBe(false);
    expect(accessForAgent(g,meta,agent('meta-webindexer'),'/a/b.html').allowed).toBe(true);
  });
  it('records the exact directive as evidence',()=>{
    const g=parseRobots(`User-agent: meta-webindexer\nDisallow: /secret`);
    const a=accessForAgent(g,meta,agent('meta-webindexer'),'/secret');
    expect(a.evidence).toContain('Disallow: /secret');
    expect(a.evidence).toContain('meta-webindexer');
  });
});

// The rule Phase 10.1 is most explicit about.
describe('training access is separated from discovery',()=>{
  it('blocking only the training crawler does not fail discovery',()=>{
    const reports=providerAccess(`User-agent: meta-externalagent\nDisallow: /`);
    const m=reports.find(r=>r.provider==='meta')!;
    expect(m.training).toBe('blocked_by_choice');
    expect(m.discovery).toBe('pass');
  });
  it('says plainly that blocking training costs nothing',()=>{
    const m=providerAccess(`User-agent: meta-externalagent\nDisallow: /`).find(r=>r.provider==='meta')!;
    expect(m.notes.join(' ')).toContain('does not reduce your score');
  });
  it('training crawlers are never scored; discovery and agentic fetch are',()=>{
    for(const p of PROVIDERS)
      for(const c of p.crawlers)
        expect(isScoredPurpose(c.purpose),`${p.id}/${c.token}`).toBe(c.purpose==='discovery'||c.purpose==='agentic_fetch');
  });
});

describe('honesty about agents that may ignore robots',()=>{
  it('does not claim Muse is blocked when its fetcher may bypass robots',()=>{
    // meta-externalfetcher is documented as possibly ignoring robots.txt.
    const m=providerAccess(`User-agent: meta-externalfetcher\nDisallow: /`).find(r=>r.provider==='meta')!;
    expect(m.agenticFetch).toBe('unknown');
    expect(m.agenticFetch).not.toBe('fail');
    expect(m.notes.join(' ')).toContain('stated preference');
  });
  it('marks that disallow as a stated preference, with evidence',()=>{
    const g=parseRobots(`User-agent: meta-externalfetcher\nDisallow: /`);
    const a=accessForAgent(g,meta,agent('meta-externalfetcher'),'/');
    expect(a.allowed).toBe(false);
    expect(a.statedPreferenceOnly).toBe(true);
    expect(a.evidence).toContain('Disallow: /');
  });
  it('does report a real failure for an agent that honours robots',()=>{
    const m=providerAccess(`User-agent: meta-webindexer\nDisallow: /`).find(r=>r.provider==='meta')!;
    expect(m.discovery).toBe('fail');
  });
  it('a blanket wildcard block fails discovery for robots-respecting agents',()=>{
    const m=providerAccess(`User-agent: *\nDisallow: /`).find(r=>r.provider==='openai')!;
    expect(m.discovery).toBe('fail');
  });
});

describe('unknown is distinct from failed',()=>{
  it('an unreachable robots.txt is unknown, not a failure',()=>{
    for(const r of providerAccess(undefined)){
      expect(r.discovery).toBe('unknown');
      expect(r.discovery).not.toBe('fail');
    }
  });
  it('an empty robots.txt permits everything',()=>{
    const m=providerAccess('').find(r=>r.provider==='meta')!;
    expect(m.discovery).toBe('pass');
  });
  it('a provider with no agent of that purpose is unsupported, not failed',()=>{
    const anthropic=providerAccess('').find(r=>r.provider==='anthropic')!;
    expect(['pass','unsupported']).toContain(anthropic.discovery);
  });
});

describe('region availability',()=>{
  it('does not penalise a merchant outside a region-limited product',()=>{
    expect(regionAvailability(meta,'GB')).toBe('not_available_in_region');
    expect(regionAvailability(meta,'GB')).not.toBe('fail');
  });
  it('passes inside the documented region',()=>{
    expect(regionAvailability(meta,'US')).toBe('pass');
  });
  it('is unknown when the country is not known',()=>{
    expect(regionAvailability(meta)).toBe('unknown');
  });
  it('treats absence of region data as no restriction',()=>{
    expect(regionAvailability(providerById('anthropic')!,'GB')).toBe('pass');
  });
});

describe('registry integrity',()=>{
  it('every provider records when it was verified and where from',()=>{
    for(const p of PROVIDERS){
      expect(p.verifiedOn,p.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sources.length,p.id).toBeGreaterThan(0);
      for(const c of p.crawlers) expect(c.source,`${p.id}/${c.token}`).toMatch(/^https:\/\//);
    }
  });
  it('crawler tokens are lowercase and unique within a provider',()=>{
    for(const p of PROVIDERS){
      const tokens=p.crawlers.map(c=>c.token);
      expect(tokens).toEqual(tokens.map(t=>t.toLowerCase()));
      expect(new Set(tokens).size).toBe(tokens.length);
    }
  });
});
