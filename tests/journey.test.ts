import {afterEach,describe,expect,it,vi} from 'vitest';
import {JOURNEY_SAFETY_NOTE,verifyJourney} from '../src/agentic/journey';
import * as F from './fixtures/pages';

// Routes may be a bare HTML string or {body,status}; a bare string is by far the common case here.
type Route=string|{body?:string;status?:number};
function mockNet(routes:Record<string,Route>){
  const calls:Array<{path:string;method:string}>=[];
  vi.stubGlobal('fetch',vi.fn(async(input:any,init:any={})=>{
    const url=new URL(String(input));
    calls.push({path:url.pathname,method:init?.method||'GET'});
    const r=routes[url.pathname];
    if(r===undefined)return new Response('',{status:404});
    if(typeof r==='string')return new Response(r,{status:200});
    return new Response(r.body??'',{status:r.status??200});
  }));
  return calls;
}
afterEach(()=>vi.unstubAllGlobals());

const STORE={
  '/':F.RICH_HOME,
  '/products/merino-base-layer':F.RICH_PRODUCT,
  // A realistic policy page. A page under a couple of hundred characters is genuinely too thin
  // for an agent to quote, and the verifier is right to say so -- so the fixture reflects reality.
  '/policies/shipping-policy':F.POLICY_PAGE('Delivery',
    'We ship worldwide within two working days using a tracked service. UK orders over fifty pounds '+
    'are delivered free of charge; below that a flat rate of three pounds ninety-five applies. '+
    'European orders usually arrive within five working days and the rest of the world within ten. '+
    'You will receive an email with a tracking number as soon as your parcel leaves our warehouse in Leeds. '+
    'If your order has not arrived within fourteen working days, contact us and we will replace it.'),
  '/pages/contact':F.CONTACT_PAGE
};

describe('buy journey',()=>{
  it('walks product, price, cart and stops at the checkout handoff',async()=>{
    mockNet(STORE);
    const r=await verifyJourney('https://example.com','buy_product');
    expect(r.steps.map(s=>s.name)).toEqual([
      'Reached the website','Found a product','Read the price','Add to cart is operable','Reached the checkout handoff']);
    expect(r.reached).toBe('Reached the checkout handoff');
    expect(r.stoppedBecause).toContain('before any payment step');
  });

  // The safety rule that matters most here.
  it('never submits anything and never posts',async()=>{
    const calls=mockNet(STORE);
    await verifyJourney('https://example.com','buy_product');
    expect(calls.every(c=>c.method==='GET')).toBe(true);
    expect(calls.some(c=>/checkout/.test(c.path))).toBe(false);
  });

  it('always carries the no-payment note',async()=>{
    mockNet(STORE);
    for(const intent of ['buy_product','find_policy','contact_business','book_appointment'] as const){
      const r=await verifyJourney('https://example.com',intent);
      expect(r.safetyNote,intent).toBe(JOURNEY_SAFETY_NOTE);
    }
    expect(JOURNEY_SAFETY_NOTE).toContain('never spends money');
  });

  it('reports where it got to when no product is reachable',async()=>{
    mockNet({'/':'<html><body><p>Just a homepage</p></body></html>'});
    const r=await verifyJourney('https://example.com','buy_product');
    expect(r.completed).toBe(false);
    expect(r.reached).toBe('Reached the website');
    expect(r.stoppedBecause).toContain('No product was reachable');
  });

  it('reports a site that does not load without pretending to continue',async()=>{
    mockNet({'/':{status:500}});
    const r=await verifyJourney('https://example.com','buy_product');
    expect(r.steps.length).toBe(1);
    expect(r.completed).toBe(false);
    expect(r.stoppedBecause).toContain('did not load');
  });

  it('flags a product an agent cannot add to a cart',async()=>{
    mockNet({...STORE,'/products/merino-base-layer':
      F.RICH_PRODUCT.replace(/<form action="\/cart\/add">[\s\S]*?<\/form>/,'<div onclick="add()">Add to cart</div>')});
    const r=await verifyJourney('https://example.com','buy_product');
    expect(r.steps.find(s=>s.name==='Add to cart is operable')!.state).not.toBe('pass');
    expect(r.completed).toBe(false);
  });
});

describe('other intents',()=>{
  it('finds a policy page and confirms it has readable content',async()=>{
    mockNet(STORE);
    const r=await verifyJourney('https://example.com','find_policy');
    expect(r.steps.find(s=>s.name==='Found a policy page')!.state).toBe('pass');
    expect(r.completed).toBe(true);
  });
  it('says a policy page too thin to quote is unknown, not a pass',async()=>{
    mockNet({...STORE,'/policies/shipping-policy':F.POLICY_PAGE('Delivery','Ships fast.')});
    const r=await verifyJourney('https://example.com','find_policy');
    const step=r.steps.find(s=>s.name==='Found a policy page')!;
    expect(step.state).toBe('unknown');
    expect(step.detail).toContain('very little readable text');
  });
  it('reports a policy that is not linked from the homepage',async()=>{
    mockNet({'/':'<html><body><p>Nothing linked here at all</p></body></html>'});
    const r=await verifyJourney('https://example.com','find_policy');
    expect(r.completed).toBe(false);
    expect(r.stoppedBecause).toContain('not linked from the homepage');
  });
  it('checks a contact route is actually usable',async()=>{
    mockNet(STORE);
    const r=await verifyJourney('https://example.com','contact_business');
    expect(r.steps.find(s=>s.name==='A contact method is usable')!.state).toBe('pass');
  });
  it('reports a booking route that is missing',async()=>{
    mockNet({'/':'<html><body><p>We take bookings by phone only</p></body></html>'});
    const r=await verifyJourney('https://example.com','book_appointment');
    expect(r.steps.find(s=>s.name==='Found a booking route')!.state).toBe('fail');
  });
});

describe('safety and robustness',()=>{
  it('refuses a private-network target before any request',async()=>{
    const calls=mockNet(STORE);
    await expect(verifyJourney('http://127.0.0.1/','buy_product')).rejects.toThrow(/IP addresses/);
    expect(calls).toEqual([]);
  });
  it('stays on the same origin',async()=>{
    const calls=mockNet({...STORE,'/':'<a href="https://evil.example/products/x">Product</a>'});
    await verifyJourney('https://example.com','buy_product');
    expect(calls.every(c=>!c.path.includes('evil'))).toBe(true);
  });
  it('does not throw when the network fails mid-journey',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(input:any)=>{
      if(new URL(String(input)).pathname==='/')return new Response(F.RICH_HOME,{status:200});
      throw new Error('connection reset');
    }));
    const r=await verifyJourney('https://example.com','buy_product');
    expect(r.completed).toBe(false);
    expect(r.steps.some(s=>s.name==='Journey interrupted'||s.state==='fail')).toBe(true);
  });
  it('gives every step evidence and a plain explanation',async()=>{
    mockNet(STORE);
    for(const s of (await verifyJourney('https://example.com','buy_product')).steps){
      expect(s.evidence.length,s.name).toBeGreaterThan(0);
      expect(s.detail.length,s.name).toBeGreaterThan(10);
    }
  });
});
