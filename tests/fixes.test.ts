import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {ApprovalRequiredError,REGISTRY,applyAllAutomatic,applyFix,approveFix,fixByKey,listFixes,proposeFixes,verifiedCount} from '../src/fixes';
import {saveBusinessProfile,saveCatalog} from '../src/platform';
import {normalizeProduct} from '../src/platform/shopify';
import {SCOPES,encryptToken,sessionCookie} from '../src/shopify';
import {saveShop} from '../src/db';
import {getProfileMeta} from '../src/ailayer/service';
import {TEST_KEY,TEST_SECRET,fakeEnv} from './helpers/env';
import * as S from './fixtures/shopify';
import type {Env} from '../src/types';

const SHOP='northbound.myshopify.com';
let env:Env; let sqlite:any;

// A stateful fake Shopify: mutations actually change what later reads return, so
// verification is exercised rather than stubbed to always succeed.
function fakeShopify(opts:{seoWriteSucceeds?:boolean;metafieldWriteSucceeds?:boolean;verifyDrifts?:boolean}={}){
  const seo=new Map<string,string>();
  const metafields=new Map<string,string>();
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(_u:any,init:any)=>{
    const {query,variables}=JSON.parse(init.body);
    const reply=(data:unknown)=>new Response(JSON.stringify({data}),{status:200});
    if(query.includes('query P(')){
      calls.push('read-seo');
      return reply({product:{id:variables.id,title:'x',seo:{title:'',description:seo.get(variables.id)||''}}});
    }
    if(query.includes('mutation U(')){
      calls.push('write-seo');
      if(opts.seoWriteSucceeds===false)return reply({productUpdate:{product:null,userErrors:[{field:['seo'],message:'Not permitted.'}]}});
      const value=opts.verifyDrifts?'something else entirely':variables.input.seo.description;
      seo.set(variables.input.id,value);
      return reply({productUpdate:{product:{id:variables.input.id,seo:{description:value}},userErrors:[]}});
    }
    if(query.includes('mutation M(')){
      calls.push('write-metafield');
      if(opts.metafieldWriteSucceeds===false)return reply({metafieldsSet:{metafields:[],userErrors:[{field:[],message:'Denied.'}]}});
      const m=variables.metafields[0];metafields.set(m.ownerId,m.value);
      return reply({metafieldsSet:{metafields:[m],userErrors:[]}});
    }
    if(query.includes('mutation MD(')){
      calls.push('delete-metafield');
      const m=variables.metafields[0];metafields.delete(m.ownerId);
      return reply({metafieldsDelete:{deletedMetafields:[m],userErrors:[]}});
    }
    if(query.includes('query MF(')){
      calls.push('read-metafield');
      const v=metafields.get(variables.id);
      return reply({product:{id:variables.id,metafield:v?{value:v}:null}});
    }
    return reply({});
  }));
  return {seo,metafields,calls};
}

beforeEach(async()=>{
  const f=fakeEnv();env=f.env;sqlite=f.sqlite;
  await saveShop(env,SHOP,await encryptToken('shpat_test',TEST_KEY),null,Date.now(),SCOPES.join(','));
  await saveBusinessProfile(env,SHOP,{name:'Northbound',description:'Gear.',contactEmail:'a@b.example',
    contactPhone:'',address:{},currency:'GBP',primaryUrl:'https://northbound.example',policies:[]},1000);
  await saveCatalog(env,SHOP,[1,2].map(i=>({...normalizeProduct(S.productNode(i),SHOP),
    title:['Merino Base Layer','Trail Runner GTX'][i-1]})),1000);
});
afterEach(()=>vi.unstubAllGlobals());

describe('registry',()=>{
  it('every fix declares a preview, apply and verify',()=>{
    for(const f of REGISTRY){
      expect(typeof f.preview,f.key).toBe('function');
      expect(typeof f.apply,f.key).toBe('function');
      expect(typeof f.verify,f.key).toBe('function');
      expect(f.risk,f.key).toMatch(/^(low|medium|high)$/);
    }
  });
  it('anything that changes customer-facing content requires approval',()=>{
    expect(fixByKey('shopify.product.seo_description')!.fixType).toBe('approval_required');
  });
  it('the hosted-layer fix mutates nothing on the store and needs no scopes',()=>{
    const f=fixByKey('hosted.ai_layer')!;
    expect(f.fixType).toBe('hosted_layer');
    expect(f.requiredScopes).toEqual([]);
  });
  it('no fix touches price, inventory, variants or policy text',()=>{
    const source=REGISTRY.map(f=>`${f.key} ${f.title} ${f.description}`).join(' ').toLowerCase();
    for(const forbidden of ['price','inventory','checkout'])
      expect(source.includes(`change ${forbidden}`),forbidden).toBe(false);
  });
});

describe('propose',()=>{
  it('finds work across the registry',async()=>{
    fakeShopify();
    const proposed=await proposeFixes(env,SHOP,'shopify');
    const keys=new Set(proposed.map(p=>p.key));
    expect(keys.has('hosted.ai_layer')).toBe(true);
    expect(keys.has('shopify.product.ai_metafield')).toBe(true);
    expect(keys.has('shopify.product.seo_description')).toBe(true);
  });

  it('never proposes overwriting a description the merchant already wrote',async()=>{
    const fake=fakeShopify();
    fake.seo.set('gid://shopify/Product/1','A description the merchant wrote themselves.');
    const proposed=await proposeFixes(env,SHOP,'shopify');
    const seoTargets=proposed.filter(p=>p.key==='shopify.product.seo_description').map(p=>p.targetTitle);
    expect(seoTargets).not.toContain('Merino Base Layer');
    expect(seoTargets).toContain('Trail Runner GTX');
  });

  it('includes a before and after so the change can be reviewed',async()=>{
    fakeShopify();
    const seo=(await proposeFixes(env,SHOP,'shopify')).find(p=>p.key==='shopify.product.seo_description')!;
    expect((seo.before as any).seoDescription).toBe('');
    expect(String((seo.after as any).seoDescription).length).toBeGreaterThan(10);
  });

  it('builds the description only from the merchant own catalogue facts',async()=>{
    fakeShopify();
    const seo=(await proposeFixes(env,SHOP,'shopify')).find(p=>p.key==='shopify.product.seo_description')!;
    const text=String((seo.after as any).seoDescription);
    expect(text).toContain('Merino Base Layer');
    expect(text).toMatch(/GBP|Northbound|Base layers/);
    expect(text).not.toMatch(/best|amazing|guaranteed|cheapest/i);
  });

  it('does not propose the hosted layer again once it is live',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const hosted=(await listFixes(env,SHOP)).find(f=>f.finding_key==='access-content')!;
    await applyFix(env,SHOP,String(hosted.id));
    const again=await proposeFixes(env,SHOP,'shopify');
    expect(again.some(p=>p.key==='hosted.ai_layer')).toBe(false);
  });
});

describe('approval is enforced',()=>{
  it('refuses to apply a customer-facing change without approval',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const seo=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required')!;
    await expect(applyFix(env,SHOP,String(seo.id))).rejects.toBeInstanceOf(ApprovalRequiredError);
    expect(String((await listFixes(env,SHOP)).find(f=>f.id===seo.id)!.status)).toBe('proposed');
  });

  it('applies it once approved',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const seo=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required')!;
    await approveFix(env,SHOP,String(seo.id));
    const out=await applyFix(env,SHOP,String(seo.id));
    expect(out!.status).toBe('verified');
  });

  it('apply-automatic never touches a fix that needs approval',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    await applyAllAutomatic(env,SHOP);
    const pending=(await listFixes(env,SHOP)).filter(f=>f.fix_type==='approval_required');
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every(f=>f.status==='proposed')).toBe(true);
  });
});

describe('a mutation returning success is not verification',()=>{
  it('marks a fix verified only after re-reading the platform',async()=>{
    const fake=fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    const out=await applyFix(env,SHOP,String(mf.id));
    expect(out!.status).toBe('verified');
    expect(fake.calls).toContain('write-metafield');
    expect(fake.calls).toContain('read-metafield');
  });

  it('fails the fix when the platform does not reflect the change',async()=>{
    // The write reports success, but a later read returns something else.
    fakeShopify({verifyDrifts:true});
    await proposeFixes(env,SHOP,'shopify');
    const seo=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required')!;
    await approveFix(env,SHOP,String(seo.id));
    const out=await applyFix(env,SHOP,String(seo.id));
    expect(out!.status).toBe('failed');
    expect(String(out!.error)).toContain('could not be confirmed');
  });

  it('does not count an unverified fix as an improvement',async()=>{
    fakeShopify({verifyDrifts:true});
    await proposeFixes(env,SHOP,'shopify');
    const seo=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required')!;
    await approveFix(env,SHOP,String(seo.id));
    await applyFix(env,SHOP,String(seo.id));
    const verified=await verifiedCount(env,SHOP);
    const failed=(await listFixes(env,SHOP)).filter(f=>f.status==='failed').length;
    expect(failed).toBeGreaterThan(0);
    expect(verified).toBe(0);
  });
});

describe('failure handling',()=>{
  it('records the reason a platform rejected the change',async()=>{
    fakeShopify({metafieldWriteSucceeds:false});
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    const out=await applyFix(env,SHOP,String(mf.id));
    expect(out!.status).toBe('failed');
    expect(String(out!.error)).toContain('Denied');
  });

  it('allows a retry after a failure',async()=>{
    fakeShopify({metafieldWriteSucceeds:false});
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    await applyFix(env,SHOP,String(mf.id));
    fakeShopify();
    const retry=await applyFix(env,SHOP,String(mf.id));
    expect(retry!.status).toBe('verified');
  });

  it('does not reapply an already verified fix',async()=>{
    const fake=fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    await applyFix(env,SHOP,String(mf.id));
    const before=fake.calls.filter(c=>c==='write-metafield').length;
    await applyFix(env,SHOP,String(mf.id));
    expect(fake.calls.filter(c=>c==='write-metafield').length).toBe(before);
  });
});

describe('hosted layer fix',()=>{
  it('publishes the AI profile and verifies it is live',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const hosted=(await listFixes(env,SHOP)).find(f=>f.finding_key==='access-content')!;
    const out=await applyFix(env,SHOP,String(hosted.id));
    expect(out!.status).toBe('verified');
    expect(Number((await getProfileMeta(env,SHOP))!.active)).toBe(1);
  });
});

describe('fix routes',()=>{
  const authed=async(path:string,method='GET')=>{
    const cookie=(await sessionCookie(TEST_SECRET,SHOP,Date.now())).split(';')[0];
    return worker.fetch(new Request(`https://agentcart.example${path}`,{method,headers:{cookie}}),env);
  };
  it('require a session',async()=>{
    expect((await worker.fetch(new Request('https://agentcart.example/api/fixes'),env)).status).toBe(401);
  });
  it('group fixes the way the merchant sees them',async()=>{
    fakeShopify();
    await authed('/api/fixes/propose','POST');
    const b:any=await (await authed('/api/fixes')).json();
    expect(b.automatic.length).toBeGreaterThan(0);
    expect(b.needsApproval.length).toBeGreaterThan(0);
    expect(b.done).toEqual([]);
  });
  it('carry the stored preview so a change can be seen before it is approved',async()=>{
    fakeShopify();
    await authed('/api/fixes/propose','POST');
    const b:any=await (await authed('/api/fixes')).json();
    const item=b.needsApproval[0];
    expect(item.after).toBeTruthy();
    expect(Object.keys(item.after).length).toBeGreaterThan(0);
    expect(item.before).toBeTruthy();
    expect(item.reversible).toBe(true);
  });

  it('name the fixes withheld for a missing scope rather than hiding them',async()=>{
    fakeShopify();
    await saveShop(env,SHOP,await encryptToken('shpat_test',TEST_KEY),null,Date.now(),'read_products,write_pixels');
    const b:any=await (await authed('/api/fixes')).json();
    expect(b.unavailable.length).toBe(2);
    expect(b.unavailable[0].needsReauthorization).toBe(true);
    expect(String(b.unavailable[0].summary)).toContain('write_products');
  });

  it('reject applying an approval-required fix over HTTP',async()=>{
    fakeShopify();
    await authed('/api/fixes/propose','POST');
    const b:any=await (await authed('/api/fixes')).json();
    const res=await authed(`/api/fixes/${b.needsApproval[0].id}/apply`,'POST');
    expect(res.status).toBe(403);
    expect((await res.json() as any).needsApproval).toBe(true);
  });
  it('apply automatic fixes and report them verified',async()=>{
    fakeShopify();
    await authed('/api/fixes/propose','POST');
    await authed('/api/fixes/x/apply-automatic','POST');
    const b:any=await (await authed('/api/fixes')).json();
    expect(b.done.length).toBeGreaterThan(0);
  });
});

describe('scope gating',()=>{
  it('requests every scope its own fixes declare',()=>{
    for(const def of REGISTRY)
      for(const scope of def.requiredScopes)
        expect(SCOPES).toContain(scope);
  });

  it('withholds a fix the connection cannot perform instead of failing it',async()=>{
    const fake=fakeShopify();
    // A connection granted at install before write_products was requested.
    await saveShop(env,SHOP,await encryptToken('shpat_test',TEST_KEY),null,Date.now(),'read_products,write_pixels');
    const out=await proposeFixes(env,SHOP,'shopify');
    const withheld=out.filter(f=>f.fixType==='unavailable');
    expect(withheld.length).toBe(2);
    for(const f of withheld){
      expect(f.needsReauthorization).toBe(true);
      expect(String(f.summary)).toContain('write_products');
    }
    // Withheld means never attempted: no row is written and Shopify is never called for them.
    expect((await listFixes(env,SHOP)).some(r=>r.finding_key==='catalog-schema')).toBe(false);
    expect(fake.calls.filter(c=>c.startsWith('write-'))).toEqual([]);
  });

  it('treats an install predating the scope record as not granted',async()=>{
    fakeShopify();
    const older='older.myshopify.com';
    await saveShop(env,older,await encryptToken('shpat_test',TEST_KEY),null,Date.now(),null);
    const out=await proposeFixes(env,older,'shopify');
    expect(out.filter(f=>f.fixType==='unavailable').length).toBe(2);
  });
});

describe('merchant-write hardening',()=>{
  it('refuses to overwrite content the merchant already wrote',async()=>{
    const fake=fakeShopify();
    fake.seo.set('gid://shopify/Product/1','Copy the merchant wrote themselves.');
    await proposeFixes(env,SHOP,'shopify');
    // Force a preview whose "before" is non-empty, simulating content appearing between
    // preview and apply -- exactly the race approval is meant to protect against.
    const row=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required');
    if(row){
      const parsed=JSON.parse(String(row.proposed_change_json));
      parsed.preview.before={seoDescription:'Merchant copy that appeared after preview'};
      sqlite.prepare('update fixes set proposed_change_json=? where id=?')
        .run(JSON.stringify(parsed),String(row.id));
      await approveFix(env,SHOP,String(row.id));
      const out=await applyFix(env,SHOP,String(row.id));
      expect(out!.status).toBe('failed');
      expect(String(out!.error)).toContain('only fills blanks');
    }
  });

  it('rate limits writes so a loop cannot rewrite a catalogue',async()=>{
    fakeShopify();
    const {assertWriteAllowed,WriteGuardError}=await import('../src/fixes');
    const def=REGISTRY.find(f=>f.key==='shopify.product.ai_metafield')!;
    const preview={targetId:'x',targetTitle:'x',summary:'x',before:{},after:{metafield:'{}'}};
    let blocked=false;
    for(let i=0;i<70;i++){
      try{await assertWriteAllowed(env,SHOP,def,preview);}
      catch(e){blocked=e instanceof WriteGuardError;break;}
    }
    expect(blocked).toBe(true);
  });

  it('rejects a fix that declares no change',async()=>{
    const {assertWriteAllowed,WriteGuardError}=await import('../src/fixes');
    const def=REGISTRY.find(f=>f.key==='shopify.product.ai_metafield')!;
    await expect(assertWriteAllowed(env,SHOP,def,
      {targetId:'x',targetTitle:'x',summary:'x',before:{},after:{}})).rejects.toBeInstanceOf(WriteGuardError);
  });
});

describe('reversible fixes',()=>{
  it('undoes a metafield fix by deleting what AgentCart wrote',async()=>{
    const fake=fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    await applyFix(env,SHOP,String(mf.id));
    expect(fake.metafields.size).toBeGreaterThan(0);
    const {undoFix}=await import('../src/fixes');
    const out=await undoFix(env,SHOP,String(mf.id));
    expect(out!.status).toBe('undone');
    // Restoring the prior state means removing the key, not leaving an empty object behind:
    // an empty metafield would still read as published and keep counting as verified.
    expect(fake.metafields.size).toBe(0);
    expect(await verifiedCount(env,SHOP)).toBe(0);
  });

  it('refuses to undo a change the merchant has edited since',async()=>{
    const fake=fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const mf=(await listFixes(env,SHOP)).find(f=>f.finding_key==='catalog-schema')!;
    await applyFix(env,SHOP,String(mf.id));
    const owner=[...fake.metafields.keys()][0];
    fake.metafields.set(owner,'{"written":"by the merchant"}');
    const {undoFix,WriteGuardError}=await import('../src/fixes');
    await expect(undoFix(env,SHOP,String(mf.id))).rejects.toBeInstanceOf(WriteGuardError);
    // The merchant's newer value survives, and the fix is not falsely marked undone.
    expect(fake.metafields.get(owner)).toBe('{"written":"by the merchant"}');
    const after=(await listFixes(env,SHOP)).find(f=>f.id===mf.id)!;
    expect(after.status).not.toBe('undone');
  });

  it('restores the previous SEO description exactly',async()=>{
    const fake=fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const seo=(await listFixes(env,SHOP)).find(f=>f.fix_type==='approval_required')!;
    await approveFix(env,SHOP,String(seo.id));
    await applyFix(env,SHOP,String(seo.id));
    expect([...fake.seo.values()].some(v=>v.length>0)).toBe(true);
    const {undoFix}=await import('../src/fixes');
    await undoFix(env,SHOP,String(seo.id));
    // before was empty, so undo restores empty
    expect([...fake.seo.values()].every(v=>v==='')).toBe(true);
  });

  it('turns the AI profile back off',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const hosted=(await listFixes(env,SHOP)).find(f=>f.finding_key==='access-content')!;
    await applyFix(env,SHOP,String(hosted.id));
    expect(Number((await getProfileMeta(env,SHOP))!.active)).toBe(1);
    const {undoFix}=await import('../src/fixes');
    await undoFix(env,SHOP,String(hosted.id));
    expect(Number((await getProfileMeta(env,SHOP))!.active)).toBe(0);
  });

  it('refuses to undo something that was never applied',async()=>{
    fakeShopify();
    await proposeFixes(env,SHOP,'shopify');
    const pending=(await listFixes(env,SHOP)).find(f=>f.status==='proposed')!;
    const {undoFix}=await import('../src/fixes');
    await expect(undoFix(env,SHOP,String(pending.id))).rejects.toThrow(/nothing to undo/);
  });

  it('every fix either supports undo or explains why not',()=>{
    for(const f of REGISTRY)
      if(!f.undo) expect(f.undoNote,`${f.key} has no undo and no explanation`).toBeTruthy();
  });
});
