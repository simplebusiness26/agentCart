import {beforeEach,describe,expect,it} from 'vitest';
import worker from '../src/index';
import {deleteShop,saveShop} from '../src/db';
import {SESSION_MAX_AGE_MS,sessionCookie} from '../src/shopify';
import {TEST_SECRET,fakeEnv} from './helpers/env';
import type {Env} from '../src/types';

const SHOP='demo.myshopify.com';
let env:Env;
beforeEach(()=>{env=fakeEnv().env;});

const cookieFor=async(shop=SHOP,issuedAt=Date.now())=>
  (await sessionCookie(TEST_SECRET,shop,issuedAt)).split(';')[0];
const dash=(cookie:string)=>worker.fetch(new Request('https://agentcart.example/api/dashboard',{headers:{cookie}}),env);

describe('session revocation',()=>{
  it('a valid cookie works while the shop is installed',async()=>{
    await saveShop(env,SHOP,'tok',null,Date.now()-1000);
    expect((await dash(await cookieFor(SHOP,Date.now()))).status).toBe(200);
  });

  it('stops working the moment the shop is uninstalled',async()=>{
    const issued=Date.now();
    await saveShop(env,SHOP,'tok',null,issued-1000);
    const cookie=await cookieFor(SHOP,issued);
    expect((await dash(cookie)).status).toBe(200);
    await deleteShop(env,SHOP);
    // Same cookie, still correctly signed and well within Max-Age.
    expect((await dash(cookie)).status).toBe(401);
  });

  it('a cookie from before a reinstall is rejected',async()=>{
    const oldIssued=Date.now()-100000;
    await saveShop(env,SHOP,'tok',null,oldIssued);
    const oldCookie=await cookieFor(SHOP,oldIssued);
    expect((await dash(oldCookie)).status).toBe(200);
    await saveShop(env,SHOP,'tok2',null,Date.now());
    expect((await dash(oldCookie)).status).toBe(401);
  });

  it('an expired cookie is rejected even for an installed shop',async()=>{
    await saveShop(env,SHOP,'tok',null,0);
    expect((await dash(await cookieFor(SHOP,Date.now()-SESSION_MAX_AGE_MS-1))).status).toBe(401);
  });

  it('a cookie for one shop cannot read another shop',async()=>{
    await saveShop(env,SHOP,'tok',null,0);
    expect((await dash(await cookieFor('other.myshopify.com'))).status).toBe(401);
  });

  it('the dashboard page renders the signed-out state without a session',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/dashboard'),env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });
});

describe('browser-facing errors render HTML',()=>{
  const cases:[string,string][]=[
    ['/connect?shop=evil.com','invalid shop'],
    ['/api/shopify/callback?shop=demo.myshopify.com','incomplete callback']
  ];
  it.each(cases)('%s returns an HTML page (%s)',async(path)=>{
    const res=await worker.fetch(new Request(`https://agentcart.example${path}`),env);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body=await res.text();
    expect(body).toContain('AgentCart');
    expect(body.startsWith('{')).toBe(false);
  });

  it('an unverified callback does not leak why it failed',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/api/shopify/callback?shop=demo.myshopify.com&state=x&code=y&hmac=deadbeef'),env);
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain('hmac');
  });
});

describe('pixel activation banner',()=>{
  it('is shown when the callback flagged a failure',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/dashboard?pixel=failed'),env);
    expect(await res.text()).toContain('did not activate');
  });
  it('is absent normally',async()=>{
    const res=await worker.fetch(new Request('https://agentcart.example/dashboard'),env);
    expect(await res.text()).not.toContain('did not activate');
  });
});
