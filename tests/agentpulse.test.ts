import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {runMcpSynthetic} from '../src/agentpulse/mcp';
import {ensureHostedMcpTarget,reliabilitySummary,savePulseRun} from '../src/agentpulse/store';
import type {PulseTarget} from '../src/agentpulse/types';
import {CURRENT_MCP_VERSION} from '../src/standards/registry';
import {fakeEnv} from './helpers/env';
import type {Env} from '../src/types';
import worker from '../src/index';
import {saveShop} from '../src/db';
import {sessionCookie} from '../src/shopify';
import {TEST_SECRET} from './helpers/env';

let env:Env;let sqlite:any;
beforeEach(()=>{const f=fakeEnv();env=f.env;sqlite=f.sqlite;});
afterEach(()=>vi.unstubAllGlobals());

const target=(over:Partial<PulseTarget>={}):PulseTarget=>({
  id:'pulse_1',shop_domain:'demo.myshopify.com',label:'Demo',protocol:'mcp',transport:'streamable_http',
  endpoint:'https://mcp.example/mcp',auth_mode:'public',journey:'mcp_read',tool_name:'get_status',
  tool_arguments_json:'{}',enabled:1,interval_ms:86400000,created_ms:1,updated_ms:1,last_run_ms:null,...over
});

function modernServer(options:{badSchema?:boolean;toolError?:boolean}={}){
  return vi.fn(async(_input:any,init:any)=>{
    const body=JSON.parse(init.body);
    expect(init.headers['MCP-Protocol-Version']).toBe(CURRENT_MCP_VERSION);
    expect(body.params._meta['io.modelcontextprotocol/protocolVersion']).toBe(CURRENT_MCP_VERSION);
    if(body.method==='server/discover')return Response.json({jsonrpc:'2.0',id:body.id,result:{
      resultType:'complete',supportedVersions:[CURRENT_MCP_VERSION],capabilities:{tools:{listChanged:false},extensions:{}},
      _meta:{'io.modelcontextprotocol/serverInfo':{name:'test',version:'1'}}}});
    if(body.method==='tools/list')return Response.json({jsonrpc:'2.0',id:body.id,result:{resultType:'complete',
      tools:[options.badSchema?{name:'broken'}:{name:'get_status',description:'Read status',
        inputSchema:{type:'object',additionalProperties:false},annotations:{readOnlyHint:true}}],
      ttlMs:5000,cacheScope:'public'}});
    return Response.json({jsonrpc:'2.0',id:body.id,result:{resultType:'complete',
      content:[{type:'text',text:'ok'}],isError:!!options.toolError}});
  });
}

describe('the MCP synthetic monitor',()=>{
  it('completes discover -> list -> safe invoke -> validate on modern MCP',async()=>{
    const fetcher=modernServer();
    const run=await runMcpSynthetic(target(),fetcher as any);
    expect(run.status).toBe('pass');expect(run.era).toBe('modern');
    expect(run.protocolVersion).toBe(CURRENT_MCP_VERSION);expect(run.toolCount).toBe(1);
    expect(run.schemaFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(run.steps.map(s=>s.step)).toEqual(['connect','discover','authenticate','invoke','validate','evidence']);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('falls back to initialize only when modern discovery is observably unsupported',async()=>{
    const fetcher=vi.fn(async(_input:any,init:any)=>{
      const b=JSON.parse(init.body);
      if(b.method==='server/discover')return Response.json({jsonrpc:'2.0',id:b.id,error:{code:-32601,message:'unknown'}},{status:400});
      if(b.method==='initialize')return Response.json({jsonrpc:'2.0',id:b.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}}}});
      if(b.method==='tools/list')return Response.json({jsonrpc:'2.0',id:b.id,result:{tools:[{name:'get_status',description:'Read status',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]}});
      return Response.json({jsonrpc:'2.0',id:b.id,result:{content:[{type:'text',text:'ok'}]}});
    });
    const run=await runMcpSynthetic(target(),fetcher as any);
    expect(run.status).toBe('pass');expect(run.era).toBe('legacy');
    expect(run.protocolVersion).toBe('2025-11-25');
  });

  it('rejects invalid advertised schemas and does not invoke them',async()=>{
    const fetcher=modernServer({badSchema:true});
    const run=await runMcpSynthetic(target(),fetcher as any);
    expect(run.status).toBe('fail');expect(run.errorCode).toBe('invalid_tool_definition');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('will not invoke a configured tool unless it is explicitly read-only',async()=>{
    const fetcher=vi.fn(async(_input:any,init:any)=>{
      const b=JSON.parse(init.body);
      if(b.method==='server/discover')return Response.json({jsonrpc:'2.0',id:b.id,result:{supportedVersions:[CURRENT_MCP_VERSION],capabilities:{tools:{}}}});
      return Response.json({jsonrpc:'2.0',id:b.id,result:{resultType:'complete',tools:[{name:'get_status',description:'Looks harmless',inputSchema:{type:'object'}}]}});
    });
    const run=await runMcpSynthetic(target(),fetcher as any);
    expect(run.status).toBe('blocked');expect(run.errorCode).toBe('tool_not_read_only');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('AgentPulse persistence and reliability evidence',()=>{
  it('runs the deployed route shape end to end against AgentCart\'s own hosted MCP surface',async()=>{
    await saveShop(env,'demo.myshopify.com','encrypted');
    vi.stubGlobal('fetch',vi.fn((input:any,init:any)=>worker.fetch(new Request(input,init),env)));
    const cookie=(await sessionCookie(TEST_SECRET,'demo.myshopify.com',Date.now())).split(';')[0];
    const res=await worker.fetch(new Request('https://agentcart.example/api/agentpulse/run',{
      method:'POST',headers:{cookie}}),env);
    expect(res.status).toBe(200);
    const body:any=await res.json();
    expect(body.run.status,JSON.stringify(body.run)).toBe('pass');
    expect(body.run.steps.map((s:any)=>s.step)).toEqual(['connect','discover','authenticate','invoke','validate','evidence']);
    expect(body.runs).toHaveLength(7);
    expect(body.runs.map((r:any)=>r.journey)).toEqual(expect.arrayContaining([
      'mcp_read','discovery','price_availability','policies','quote_contact','booking_handoff','checkout_handoff']));
    expect(sqlite.prepare('select count(*) c from agentpulse_runs').get().c).toBe(7);
  });

  it('stores allowlisted evidence, steps and a computed observed summary',async()=>{
    await ensureHostedMcpTarget(env,'demo.myshopify.com','https://agentcart.example/api/ai/demo/mcp',1000);
    const row=sqlite.prepare('select * from agentpulse_targets').get();
    const run=await runMcpSynthetic({...target(),id:row.id,endpoint:row.endpoint},modernServer() as any);
    await savePulseRun(env,run);
    expect(sqlite.prepare('select count(*) c from agentpulse_steps').get().c).toBe(6);
    const stored=sqlite.prepare('select evidence_json from agentpulse_runs').get().evidence_json;
    expect(stored).not.toContain('ok');
    const summary=await reliabilitySummary(env,'demo.myshopify.com');
    expect(summary.successRate).toBe(1);expect(summary.p50Ms).not.toBeNull();
    expect(summary.note).toContain('not an SLA');
  });

  it('deduplicates failures and records recovery',async()=>{
    await ensureHostedMcpTarget(env,'demo.myshopify.com','https://agentcart.example/api/ai/demo/mcp',1000);
    const row=sqlite.prepare('select * from agentpulse_targets').get();
    for(let i=0;i<2;i++){
      const failed=await runMcpSynthetic({...target(),id:row.id,endpoint:row.endpoint},modernServer({badSchema:true}) as any);
      failed.id=`failed-${i}`;await savePulseRun(env,failed);
    }
    expect(sqlite.prepare('select count(*) c from agentpulse_incidents').get().c).toBe(1);
    expect(sqlite.prepare('select occurrences from agentpulse_incidents').get().occurrences).toBe(2);
    const passed=await runMcpSynthetic({...target(),id:row.id,endpoint:row.endpoint},modernServer() as any);
    passed.id='passed';await savePulseRun(env,passed);
    expect(sqlite.prepare('select state from agentpulse_incidents').get().state).toBe('recovered');
  });
});
