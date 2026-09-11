import {beforeEach,describe,expect,it} from 'vitest';
import {dashboardPage} from '../src/ui';
import {providerAccess} from '../src/providers/robots';
import {protocolSupport} from '../src/protocol/index';
import {launchStatus} from '../src/launch/gate';
import {buildChecklist} from '../src/launch/checklist';
import {buildOutcome} from '../src/outcome';
import {encryptToken} from '../src/shopify';
import {saveShop} from '../src/db';
import {TEST_KEY,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env;
beforeEach(async()=>{env=fakeEnv().env;await saveShop(env,SHOP,await encryptToken('shpat_secret',TEST_KEY));});

const page=()=>dashboardPage(false);

// The dashboard's client script is a template string, so TypeScript cannot check that the field
// names it reads exist on the JSON the API returns. A mismatch renders a silently empty column
// rather than failing anywhere. These tests pin the contract from both ends.
describe('dashboard reads field names the APIs actually emit',()=>{
  it('renders every tab it declares',()=>{
    const html=page();
    for(const tab of ['overview','ready','fixes','layer','traffic','agents','launch'])
      expect(html,tab).toContain('data-tab="'+tab+'"'),
      expect(html,tab).toContain('id="panel-'+tab+'"');
  });

  it('uses the provider access field names, not plausible-looking ones',()=>{
    const [sample]=providerAccess('User-agent: *\nAllow: /');
    const html=page();
    for(const key of ['discovery','agenticFetch','notes','label'])
      expect(sample,key).toHaveProperty(key);
    expect(html).toContain('a.agenticFetch');
    // `fetch` is the name the shape does not use; reading it would blank the column.
    expect(sample).not.toHaveProperty('fetch');
    expect(html).not.toContain('a.fetch)');
  });

  it('renders every readiness state a provider can report',()=>{
    const html=page();
    for(const state of ['pass','fail','unsupported','unknown','not_available_in_region'])
      expect(html,state).toContain(state+':[');
  });

  it('uses the protocol field names',()=>{
    const [p]=protocolSupport();
    expect(p).toHaveProperty('label');
    expect(p).toHaveProperty('summary');
  });

  it('uses the launch checklist and gate field names',async()=>{
    const list=await buildChecklist(env,SHOP);
    const gate=await launchStatus(env);
    const html=page();
    for(const key of ['headline','items','ownerActions','hardRule'])expect(list,key).toHaveProperty(key);
    expect(list.items[0]).toHaveProperty('state');
    expect(list.items[0]).toHaveProperty('owner');
    expect(gate).toHaveProperty('summary');
    for(const state of ['done','owner_action','blocked','not_started'])
      expect(html,state).toContain(state+':[');
  });

  it('uses the outcome field names',async()=>{
    const o=await buildOutcome(env,SHOP,null);
    expect(o.readiness).toHaveProperty('score');
    expect(o.northStar).toHaveProperty('verifiedRevenue');
    expect(o.northStar).toHaveProperty('reportedRevenue');
    expect(o.customers).toHaveProperty('visits');
  });

  it('uses the connection health field names',async()=>{
    const {connectionHealth}=await import('../src/ops');
    const h=await connectionHealth(env,SHOP);
    const html=page();
    for(const key of ['overall','summary','checks'])expect(h,key).toHaveProperty(key);
    for(const key of ['key','label','state','detail','fix'])expect(h.checks[0],key).toHaveProperty(key);
    expect(html).toContain("getJSON('/api/health/connection')");
    expect(html).toContain('c.label');
    expect(html).toContain('h.checks');
  });

  it('reads the fix groups and preview fields the fixes API emits',()=>{
    const html=page();
    // Groups added with scope gating and undo. A name the API does not emit blanks a section.
    for(const group of ['unavailable','undone'])expect(html,group).toContain('f.'+group);
    expect(html).toContain('i.reversible');
    expect(html).toContain('/undo');
  });

  it('never reports a blocked training crawler as a merchant failure',()=>{
    const [sample]=providerAccess('User-agent: *\nDisallow: /');
    expect(sample.training).toBe('blocked_by_choice');
    expect(sample.notes.join(' ')).toContain('does not reduce your score');
  });
});
