import {describe,expect,it} from 'vitest';
import {STATIC_SCAN_CAVEAT,assessInteraction} from '../src/agentready/interaction';
import {PAYMENT_CAVEAT,assessPayment,paymentLabels} from '../src/agentready/payment';
import {extractSignals} from '../src/agentready';
import * as F from './fixtures/pages';
import type {PageEvidence,PageType} from '../src/agentready/types';

const page=(url:string,type:PageType,html:string):PageEvidence=>{
  const s=extractSignals(html);return {url,pageType:type,status:200,title:s.title,signals:s};
};

const GOOD_CONTROLS=`<form action="/cart/add" method="post">
  <label for="size">Size</label>
  <select id="size" name="variant-size"><option>S</option><option>M</option></select>
  <label for="qty">Quantity</label><input id="qty" name="quantity" type="number" value="1">
  <button name="add" type="submit" aria-label="Add Merino Base Layer to cart">Add to cart</button>
</form>
<a href="/checkout" aria-label="Proceed to checkout">Proceed to checkout</a>
<form><label for="em">Email</label><input id="em" type="email" name="email"></form>`;

const BAD_CONTROLS=`<div onclick="addToCart()" role="button">Add to cart</div>
<div onclick="go()">Click here</div><div onclick="x()">More</div>
<span>add to cart</span><input type="text"><input type="text">`;

describe('interaction readiness',()=>{
  it('recognises real semantic controls',()=>{
    const s=assessInteraction(GOOD_CONTROLS,{sellsProducts:true});
    expect(s.find(x=>x.key==='semantic-controls')!.state).toBe('pass');
    expect(s.find(x=>x.key==='add-to-cart')!.state).toBe('pass');
    expect(s.find(x=>x.key==='variant-selection')!.state).toBe('pass');
    expect(s.find(x=>x.key==='quantity-control')!.state).toBe('pass');
    expect(s.find(x=>x.key==='labelled-inputs')!.state).toBe('pass');
  });

  it('fails markup an agent cannot operate, even though the words are present',()=>{
    const s=assessInteraction(BAD_CONTROLS,{sellsProducts:true});
    expect(s.find(x=>x.key==='semantic-controls')!.state).toBe('fail');
    // The old regex would have called this a pass because "add to cart" appears.
    expect(s.find(x=>x.key==='add-to-cart')!.state).not.toBe('pass');
    expect(s.find(x=>x.key==='labelled-inputs')!.state).toBe('fail');
  });

  it('flags ambiguous control text',()=>{
    expect(assessInteraction(BAD_CONTROLS).find(x=>x.key==='meaningful-text')!.state).toBe('unknown');
    expect(assessInteraction(GOOD_CONTROLS).find(x=>x.key==='meaningful-text')!.state).toBe('pass');
  });

  it('never claims a static fetch proved a browser journey',()=>{
    for(const s of assessInteraction(GOOD_CONTROLS,{sellsProducts:true}))
      expect(s.verifiedBy).toBe('static_scan');
    expect(STATIC_SCAN_CAVEAT).toContain('not prove');
  });

  it('skips product checks for a business that sells nothing',()=>{
    const keys=assessInteraction(GOOD_CONTROLS,{}).map(s=>s.key);
    expect(keys).not.toContain('add-to-cart');
    expect(keys).not.toContain('variant-selection');
  });

  it('assesses booking controls only when booking applies',()=>{
    const withBooking=assessInteraction('<a href="/book">Book an appointment</a>',{offersBooking:true});
    expect(withBooking.find(s=>s.key==='booking-control')!.state).toBe('pass');
    expect(assessInteraction('<a href="/book">Book</a>',{}).map(s=>s.key)).not.toContain('booking-control');
  });

  it('records evidence and a plain explanation for every signal',()=>{
    for(const s of assessInteraction(BAD_CONTROLS,{sellsProducts:true,offersBooking:true})){
      expect(s.evidence.length,s.key).toBeGreaterThan(0);
      expect(s.detail.length,s.key).toBeGreaterThan(15);
      expect(s.label,s.key).not.toMatch(/aria-|<div|regex/);
    }
  });

  it('does not throw on empty or hostile markup',()=>{
    for(const html of ['','<'.repeat(5000),'a'.repeat(200000)])
      expect(()=>assessInteraction(html,{sellsProducts:true})).not.toThrow();
  });
});

const store=()=>[
  page('https://e.com/','home',F.RICH_HOME),
  page('https://e.com/products/x','product',F.RICH_PRODUCT),
  page('https://e.com/policies/shipping-policy','shipping',F.POLICY_PAGE('Delivery','Two days.')),
  page('https://e.com/policies/refund-policy','returns',F.POLICY_PAGE('Returns','Thirty days.'))
];

const UCP_CHECKOUT=JSON.stringify({ucp:{version:"draft",
  services:{"dev.ucp.shopping":{transport:"rest",endpoint:"https://x"}},
  capabilities:{"dev.ucp.shopping.checkout":[{version:"1"}]}}});

describe('payment readiness is staged, not a single link check',()=>{
  it('walks the stages in order and reports how far it got',()=>{
    const r=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true});
    expect(r.stages.map(s=>s.step)).toEqual([...r.stages.map(s=>s.step)].sort((a,b)=>a-b));
    expect(r.furthestStage).toBeGreaterThan(5);
    expect(r.purchaseCapable).toBe(true);
  });

  it('reports a partial journey honestly',()=>{
    // Product and cart, but no shipping, returns or checkout. The checkout route has to be
    // stripped from the page evidence too, not just the raw html argument.
    const noCheckout=F.RICH_PRODUCT.replace(/\/checkout/g,'#').replace(/Proceed to checkout/g,'Continue');
    const partial=[page('https://e.com/products/x','product',noCheckout)];
    const r=assessPayment(partial,noCheckout,{sellsProducts:true});
    expect(r.purchaseCapable).toBe(false);
    expect(r.stages.find(s=>s.key==='shipping-info')!.state).toBe('fail');
    expect(r.stages.find(s=>s.key==='returns-info')!.state).toBe('fail');
  });

  it('is not assessed at all for a business that sells nothing',()=>{
    const r=assessPayment([],'',{sellsProducts:false});
    expect(r.stages[0].state).toBe('unsupported');
    expect(r.purchaseCapable).toBe(false);
  });

  it('separates purchase capable from optimized',()=>{
    const plain=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true});
    expect(plain.purchaseCapable).toBe(true);
    expect(plain.optimized).toBe(false);
    const native=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true,ucpManifest:UCP_CHECKOUT});
    expect(native.optimized).toBe(true);
    expect(paymentLabels(native).optimized.value).toBe(true);
  });

  it('does not make accelerated checkout mandatory',()=>{
    const r=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true});
    const accel=r.stages.find(s=>s.key==='accelerated-checkout')!;
    expect(accel.state).toBe('unsupported');
    expect(accel.state).not.toBe('fail');
    expect(accel.detail).toContain('not a problem');
  });

  it('detects Shop Pay and Stripe only from real markers',()=>{
    const r=assessPayment(store(),F.RICH_PRODUCT+'<script src="https://js.stripe.com/v3"></script><div class="shop-pay"></div>',
      {sellsProducts:true});
    expect(r.integrations).toContain('Stripe Link');
    expect(r.integrations).toContain('Shop Pay');
    expect(assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true}).integrations).not.toContain('Stripe Link');
  });

  it('reports a region-limited feature as unavailable, not as a merchant failure',()=>{
    const r=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true,region:'not_available_in_region'});
    const agentic=r.stages.find(s=>s.key==='agentic-checkout')!;
    expect(agentic.state).toBe('not_available_in_region');
    expect(agentic.state).not.toBe('fail');
    expect(agentic.detail).toContain('not a failing on your part');
  });

  it('states that approval stays with the payment provider',()=>{
    const r=assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true});
    const approval=r.stages.find(s=>s.key==='approval-stays-with-provider')!;
    expect(approval.state).toBe('pass');
    expect(approval.detail).toContain('never sees or stores card details');
  });

  it('carries the no-payment-credentials caveat',()=>{
    expect(assessPayment(store(),F.RICH_PRODUCT,{sellsProducts:true}).caveat).toBe(PAYMENT_CAVEAT);
    expect(PAYMENT_CAVEAT).toContain('never handles card details');
  });
});

// The spec's hardest rule about this area.
describe('AgentCart accepts no payment credentials',()=>{
  it('a page full of card-like data yields no stored credential in the result',()=>{
    const hostile=`<input name="cardnumber" value="4242424242424242">
      <input name="cvc" value="123"><input name="exp" value="12/29">`;
    const json=JSON.stringify(assessPayment(store(),hostile,{sellsProducts:true}))
      +JSON.stringify(assessInteraction(hostile,{sellsProducts:true}));
    for(const secret of ['4242424242424242','123456','12/29'])
      expect(json,`leaked ${secret}`).not.toContain(secret);
  });
});
