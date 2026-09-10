import {describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import {SESSION_MAX_AGE_MS,decryptToken,encryptToken,parseSession,randomState,sessionCookie,validShop,verifyOAuthHmac,verifyWebhookHmac} from '../src/shopify';
import {TEST_SECRET} from './helpers/env';

const hmacHex=(secret:string,msg:string)=>createHmac('sha256',secret).update(msg).digest('hex');
const hmacB64=(secret:string,msg:string)=>createHmac('sha256',secret).update(msg).digest('base64');

function signedOAuthUrl(params:Record<string,string>,secret=TEST_SECRET){
  const message=Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&');
  const u=new URL('https://agentcart.example/api/shopify/callback');
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);
  u.searchParams.set('hmac',hmacHex(secret,message));
  return u;
}

describe('validShop',()=>{
  it('accepts real myshopify domains',()=>{
    for(const s of ['a.myshopify.com','my-store.myshopify.com','store123.myshopify.com'])
      expect(validShop(s),s).toBe(true);
  });
  it('rejects lookalikes and injection attempts',()=>{
    for(const s of ['evil.com','a.myshopify.com.evil.com','-x.myshopify.com','.myshopify.com','myshopify.com','','a b.myshopify.com'])
      expect(validShop(s),s).toBe(false);
  });
});

describe('randomState',()=>{
  it('is 48 hex chars and does not repeat',()=>{
    const a=randomState(),b=randomState();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });
});

describe('verifyOAuthHmac',()=>{
  const base={code:'abc123',shop:'demo.myshopify.com',state:'s1',timestamp:'1700000000'};
  it('accepts a correctly signed callback',async()=>{
    expect(await verifyOAuthHmac(signedOAuthUrl(base),TEST_SECRET)).toBe(true);
  });
  it('rejects a tampered parameter',async()=>{
    const u=signedOAuthUrl(base); u.searchParams.set('shop','attacker.myshopify.com');
    expect(await verifyOAuthHmac(u,TEST_SECRET)).toBe(false);
  });
  it('rejects the wrong secret',async()=>{
    expect(await verifyOAuthHmac(signedOAuthUrl(base),'other-secret')).toBe(false);
  });
  it('rejects a missing hmac',async()=>{
    const u=new URL('https://agentcart.example/cb?shop=demo.myshopify.com');
    expect(await verifyOAuthHmac(u,TEST_SECRET)).toBe(false);
  });
  it('verifies regardless of query-string order',async()=>{
    const signed=signedOAuthUrl(base);
    const shuffled=new URL('https://agentcart.example/api/shopify/callback');
    shuffled.searchParams.set('timestamp',base.timestamp);
    shuffled.searchParams.set('shop',base.shop);
    shuffled.searchParams.set('hmac',signed.searchParams.get('hmac')!);
    shuffled.searchParams.set('code',base.code);
    shuffled.searchParams.set('state',base.state);
    expect(await verifyOAuthHmac(shuffled,TEST_SECRET)).toBe(true);
  });
  it('excludes signature as well as hmac from the signed message',async()=>{
    const u=signedOAuthUrl(base); u.searchParams.set('signature','ignored');
    expect(await verifyOAuthHmac(u,TEST_SECRET)).toBe(true);
  });
  // Shopify's `host` param is base64 and frequently carries `=` padding, which is
  // percent-encoded in transit. This locks in that we verify against the DECODED
  // value. If live callbacks ever fail HMAC while everything else looks correct,
  // this is the assumption to revisit first -- see docs/SETUP.md section 10.
  it('verifies a value that is percent-encoded in transit',async()=>{
    const host='ZGVtby5teXNob3BpZnkuY29tL2FkbWlu==';
    const u=signedOAuthUrl({...base,host});
    expect(u.search).toContain('%3D');
    expect(await verifyOAuthHmac(u,TEST_SECRET)).toBe(true);
  });

  it('is unaffected by an extra unexpected parameter only if it was signed',async()=>{
    const withHost=signedOAuthUrl({...base,host:'ZGVtby5teXNob3BpZnkuY29t'});
    expect(await verifyOAuthHmac(withHost,TEST_SECRET)).toBe(true);
    const injected=signedOAuthUrl(base); injected.searchParams.set('host','injected');
    expect(await verifyOAuthHmac(injected,TEST_SECRET)).toBe(false);
  });
});

describe('verifyWebhookHmac',()=>{
  const body=JSON.stringify({shop_domain:'demo.myshopify.com'});
  it('accepts a correct base64 digest',async()=>{
    expect(await verifyWebhookHmac(TEST_SECRET,body,hmacB64(TEST_SECRET,body))).toBe(true);
  });
  it('rejects a null header',async()=>{
    expect(await verifyWebhookHmac(TEST_SECRET,body,null)).toBe(false);
  });
  it('rejects a tampered body',async()=>{
    expect(await verifyWebhookHmac(TEST_SECRET,body+' ',hmacB64(TEST_SECRET,body))).toBe(false);
  });
  it('rejects a length mismatch without throwing',async()=>{
    expect(await verifyWebhookHmac(TEST_SECRET,body,'short')).toBe(false);
  });
});

describe('token encryption',()=>{
  it('round-trips an access token',async()=>{
    const token='shpat_'+'f'.repeat(32);
    expect(await decryptToken(await encryptToken(token,TEST_SECRET),TEST_SECRET)).toBe(token);
  });
  it('produces a different ciphertext each time (random IV)',async()=>{
    const a=await encryptToken('same','k'),b=await encryptToken('same','k');
    expect(a).not.toBe(b);
    expect(await decryptToken(a,'k')).toBe(await decryptToken(b,'k'));
  });
  it('rejects a wrong key',async()=>{
    const enc=await encryptToken('secret-token',TEST_SECRET);
    await expect(decryptToken(enc,'wrong-key')).rejects.toThrow();
  });
  it('rejects malformed input',async()=>{
    await expect(decryptToken('no-dot-separator',TEST_SECRET)).rejects.toThrow('Invalid encrypted token.');
  });
});

describe('session cookie',()=>{
  const val=(c:string)=>c.split(';')[0];

  it('round-trips a shop domain',async()=>{
    const c=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    expect((await parseSession(TEST_SECRET,val(c)))?.shop).toBe('demo.myshopify.com');
  });
  it('sets HttpOnly, Secure and SameSite',async()=>{
    const c=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
  });
  it('rejects a tampered signature',async()=>{
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com'));
    // Flip the final hex digit to a guaranteed different one. Substituting a fixed
    // character is a no-op whenever the signature already ends in it, which made this
    // test pass or fail depending on the signature -- flaky roughly one run in sixteen.
    const last=c.slice(-1);
    expect(await parseSession(TEST_SECRET,c.slice(0,-1)+(last==='a'?'b':'a'))).toBe(null);
  });
  it('rejects a wrong secret',async()=>{
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com'));
    expect(await parseSession('other',c)).toBe(null);
  });
  it('returns null for a missing cookie',async()=>{
    expect(await parseSession(TEST_SECRET,null)).toBe(null);
    expect(await parseSession(TEST_SECRET,'other=1')).toBe(null);
  });
  it('handles a shop domain containing dots',async()=>{
    const c=val(await sessionCookie(TEST_SECRET,'a.b.myshopify.com'));
    expect((await parseSession(TEST_SECRET,c))?.shop).toBe('a.b.myshopify.com');
  });
  it('carries an issued-at that the client cannot alter',async()=>{
    const issued=Date.now()-1000;
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com',issued));
    expect((await parseSession(TEST_SECRET,c))?.issuedAt).toBe(issued);
    // rewriting the timestamp invalidates the signature
    expect(await parseSession(TEST_SECRET,c.replace(String(issued),String(Date.now())))).toBe(null);
  });
  it('expires on its own, independent of the browser honouring Max-Age',async()=>{
    const stale=Date.now()-SESSION_MAX_AGE_MS-1;
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com',stale));
    expect(await parseSession(TEST_SECRET,c)).toBe(null);
  });
  it('accepts a cookie issued just inside the window',async()=>{
    const fresh=Date.now()-SESSION_MAX_AGE_MS+60000;
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com',fresh));
    expect((await parseSession(TEST_SECRET,c))?.shop).toBe('demo.myshopify.com');
  });
  it('rejects a cookie dated far in the future',async()=>{
    const c=val(await sessionCookie(TEST_SECRET,'demo.myshopify.com',Date.now()+86400000));
    expect(await parseSession(TEST_SECRET,c)).toBe(null);
  });
  it('rejects a malformed payload without throwing',async()=>{
    for(const bad of ['agentcart_session=x','agentcart_session=a.b','agentcart_session=shop.notanumber.sig'])
      expect(await parseSession(TEST_SECRET,bad),bad).toBe(null);
  });
});
