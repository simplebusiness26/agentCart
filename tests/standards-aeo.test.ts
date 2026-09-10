import {beforeEach,describe,expect,it} from 'vitest';
import {buildStandards,developerInstructions,pathsFor,profileSite} from '../src/standards';
import {ADAPTERS,AEO_CAVEAT,addQuery,aeoReport,associationLanguage,isVanityQuery,listCompetitors,runAeo,setCompetitors,suggestQueries} from '../src/aeo';
import {scoreReport,extractSignals} from '../src/agentready';
import {assessDiscovery} from '../src/providers/discovery';
import {providerAccess} from '../src/providers/robots';
import {assessSafety} from '../src/agentready/safety';
import {assessPayment} from '../src/agentready/payment';
import {assessInteraction} from '../src/agentready/interaction';
import {saveShop} from '../src/db';
import {fakeEnv} from './helpers/env';
import * as F from './fixtures/pages';
import type {Env} from '../src/types';
import type {PageEvidence,PageType} from '../src/agentready/types';

const page=(url:string,type:PageType,html:string):PageEvidence=>{
  const s=extractSignals(html);return {url,pageType:type,status:200,title:s.title,signals:s};
};
const build=(pages:PageEvidence[])=>scoreReport({url:pages[0].url,pages,
  platform:{platform:'other',confidence:0,signals:[]},sitemap:true,robots:'User-agent: *\nAllow: /'});

const shopPages=()=>[page('https://e.com/','home',F.RICH_HOME),page('https://e.com/products/x','product',F.RICH_PRODUCT)];
const servicePages=()=>[page('https://s.com/','home',F.SERVICE_HOME),page('https://s.com/contact','contact',F.CONTACT_PAGE)];

const standardsFor=(pages:PageEvidence[],robots='User-agent: *\nAllow: /')=>{
  const report=build(pages);
  return buildStandards({report,
    discovery:[assessDiscovery('agents_md',{ok:false,body:'',status:404}),
               assessDiscovery('ucp_manifest',{ok:false,body:'',status:404})],
    providers:providerAccess(robots),
    safety:assessSafety(pages.map(p=>p.signals.title).join(' ')),
    payment:assessPayment(pages,F.RICH_PRODUCT,{sellsProducts:pages.some(p=>p.pageType==='product')}),
    interaction:assessInteraction(F.RICH_PRODUCT,{sellsProducts:true})});
};

describe('site profiling decides what applies',()=>{
  it('classifies an online shop as ecommerce',()=>{
    expect(profileSite(build(shopPages())).type).toBe('ecommerce');
  });
  it('classifies a service business without ecommerce standards',()=>{
    const p=profileSite(build(servicePages()));
    expect(['service','booking']).toContain(p.type);
    expect(p.applicable).not.toContain('payment');
    expect(p.applicable).not.toContain('catalog_protocol');
  });
  it('explains why in the merchant own terms',()=>{
    expect(profileSite(build(servicePages())).reason).not.toMatch(/JSON-LD|schema\.org/);
  });
});

// The rule Phase 12.1 states most forcefully.
describe('a service business is not penalised for ecommerce protocols',()=>{
  it('marks catalogue and payment standards not applicable, never failed',()=>{
    const s=standardsFor(servicePages());
    for(const key of ['payment.path','catalog_protocol.ucp']){
      const f=s.findings.find(x=>x.key===key)!;
      expect(f.state,key).toBe('unsupported');
      expect(f.state,key).not.toBe('fail');
      expect(f.detail,key).toContain('Not applicable');
    }
  });
  it('does not count them against the standards score',()=>{
    const s=standardsFor(servicePages());
    expect(s.findings.filter(f=>f.state==='unsupported').length).toBeGreaterThan(0);
    expect(s.applicable).toBeLessThan(s.findings.length);
  });
  it('offers no fix paths for something that does not apply',()=>{
    const s=standardsFor(servicePages());
    expect(s.findings.find(f=>f.key==='payment.path')!.paths).toEqual([]);
  });
});

describe('standards stay separate from the business score',()=>{
  it('says so explicitly',()=>{
    expect(standardsFor(shopPages()).note).toContain('reported separately from your Agent Ready score');
  });
  it('treats an optional catalogue protocol as optional, not a failure',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.key==='catalog_protocol.ucp')!;
    expect(f.state).toBe('unsupported');
    expect(f.detail).toContain('Optional');
  });
});

describe('three fix paths',()=>{
  // "unsupported" carries two different meanings and they must not be conflated: an absent
  // agents.md is optional-but-actionable, while payment on a service business does not apply
  // at all. Only the second has no fix path.
  it('a passing finding offers no routes',()=>{
    for(const f of standardsFor(shopPages()).findings)
      if(f.state==='pass')expect(f.paths,f.key).toEqual([]);
  });

  it('a finding that does not apply to this business offers no routes',()=>{
    for(const f of standardsFor(servicePages()).findings)
      if(f.detail.startsWith('Not applicable'))expect(f.paths,f.key).toEqual([]);
  });

  it('every failing finding offers at least one route',()=>{
    for(const f of standardsFor(shopPages()).findings)
      if(f.state==='fail')expect(f.paths.length,f.key).toBeGreaterThan(0);
  });

  it('an optional standard that is simply absent is still actionable',()=>{
    const agents=standardsFor(shopPages()).findings.find(f=>f.key==='discovery.agents_md')!;
    expect(agents.state).toBe('unsupported');
    expect(agents.paths).toContain('agentcart');
  });

  it('puts Fix with AgentCart first where AgentCart can genuinely do it',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.paths.includes('agentcart'))!;
    expect(pathsFor(f,'https://e.com')[0].path).toBe('agentcart');
  });

  it('generates developer instructions from real evidence',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.paths.includes('developer'))!;
    const body=developerInstructions(f,'https://e.com').body;
    expect(body).toContain('What AgentCart observed');
    expect(body).toContain(f.key);
    expect(body).toContain('How to verify');
  });

  it('tells a coding agent to preserve behaviour and confirm the current spec',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.paths.includes('developer'))!;
    const body=developerInstructions(f,'https://e.com').body;
    expect(body).toContain('Preserve all existing behaviour');
    expect(body).toContain('confirm the current official specification');
  });

  it('never represents generated instructions as already applied',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.paths.includes('developer'))!;
    const body=developerInstructions(f,'https://e.com').body;
    expect(body).toContain('Nothing here has been applied');
  });

  it('does not leak secrets into the instructions',()=>{
    const f=standardsFor(shopPages()).findings.find(x=>x.paths.includes('developer'))!;
    const body=developerInstructions(f,'https://e.com').body;
    expect(body).toContain('Do not add credentials');
    expect(body).not.toMatch(/shpat_|sk_live|Bearer /);
  });
});

// The AEO honesty rule.
describe('AEO never fabricates a metric',()=>{
  const SHOP='demo.myshopify.com';
  let env:Env;
  beforeEach(async()=>{env=fakeEnv().env;await saveShop(env,SHOP,'tok');});

  it('ships every adapter unsupported with a stated reason',()=>{
    for(const a of ADAPTERS){
      expect(a.available({} as any),a.id).toBe(false);
      expect(a.unsupportedReason.length,a.id).toBeGreaterThan(30);
    }
  });

  it('reports nothing rather than estimating when nothing can be measured',async()=>{
    const r=await aeoReport(env,SHOP);
    expect(r.status).toBe('unsupported');
    expect(r.metrics).toEqual([]);
    expect(r.summary).toContain('rather than estimating');
    expect(r.unsupportedProviders.length).toBe(ADAPTERS.length);
  });

  it('records an unsupported run instead of silently doing nothing',async()=>{
    const run=await runAeo(env,SHOP,'openai','Northbound');
    expect(run.status).toBe('unsupported');
    expect(run.unsupportedReason).toContain('API key');
    expect(run.observations).toEqual([]);
  });

  it('is explicit that Muse cannot be tested programmatically',()=>{
    const meta=ADAPTERS.find(a=>a.id==='meta')!;
    expect(meta.unsupportedReason).toContain('breach provider terms');
  });

  it('carries a caveat that does not promise ranking',async()=>{
    const r=await aeoReport(env,SHOP);
    expect(r.caveat).toBe(AEO_CAVEAT);
    expect(AEO_CAVEAT).toContain('no ranking or recommendation is promised');
  });

  it('uses association language, not causation',()=>{
    const text=associationLanguage('delivery information');
    expect(text).toContain('likely contributor');
    expect(text).not.toMatch(/because of|caused by|proves/i);
  });
});

describe('AEO query sets',()=>{
  const SHOP='demo.myshopify.com';
  let env:Env;
  beforeEach(async()=>{env=fakeEnv().env;await saveShop(env,SHOP,'tok');});

  it('builds queries from category and location, not the business name',()=>{
    const qs=suggestQueries('hiking boots','Leeds');
    expect(qs.length).toBeGreaterThan(2);
    for(const q of qs)expect(q.query).not.toContain('Northbound');
  });
  it('rejects vanity queries that name the business',()=>{
    expect(isVanityQuery('tell me about Northbound Outfitters','Northbound Outfitters')).toBe(true);
    expect(isVanityQuery('best hiking boots in Leeds','Northbound Outfitters')).toBe(false);
  });
  it('stores queries and competitors',async()=>{
    await addQuery(env,SHOP,'comparison','best hiking boots compared');
    await setCompetitors(env,SHOP,[{name:'Rival Outdoors'},{name:'Peak Gear'}]);
    expect((await listCompetitors(env,SHOP)).length).toBe(2);
  });
  it('caps the competitor set',async()=>{
    await setCompetitors(env,SHOP,Array.from({length:25},(_,i)=>({name:`C${i}`})));
    expect((await listCompetitors(env,SHOP)).length).toBeLessThanOrEqual(10);
  });
});
