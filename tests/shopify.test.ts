import {describe,expect,it} from 'vitest';
import {createHmac} from 'node:crypto';
import {decryptToken,encryptToken,randomState,sessionCookie,shopFromCookie,validShop,verifyOAuthHmac,verifyWebhookHmac} from '../src/shopify';
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
  it('round-trips a shop domain',async()=>{
    const cookie=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    const value=cookie.split(';')[0];
    expect(await shopFromCookie(TEST_SECRET,value)).toBe('demo.myshopify.com');
  });
  it('sets HttpOnly, Secure and SameSite',async()=>{
    const cookie=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });
  it('rejects a tampered signature',async()=>{
    const cookie=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    expect(await shopFromCookie(TEST_SECRET,cookie.split(';')[0].replace(/.$/,'0'))).toBe(null);
  });
  it('rejects a wrong secret',async()=>{
    const cookie=await sessionCookie(TEST_SECRET,'demo.myshopify.com');
    expect(await shopFromCookie('other',cookie.split(';')[0])).toBe(null);
  });
  it('returns null for a missing cookie',async()=>{
    expect(await shopFromCookie(TEST_SECRET,null)).toBe(null);
    expect(await shopFromCookie(TEST_SECRET,'other=1')).toBe(null);
  });
  it('handles a shop domain containing dots',async()=>{
    const cookie=await sessionCookie(TEST_SECRET,'a.b.myshopify.com');
    expect(await shopFromCookie(TEST_SECRET,cookie.split(';')[0])).toBe('a.b.myshopify.com');
  });
});
