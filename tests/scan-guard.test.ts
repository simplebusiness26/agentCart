import {describe,expect,it} from 'vitest';
import {assertScannableUrl} from '../src/scanner';

// Table-driven because this guard is the only thing standing between a public,
// unauthenticated endpoint and the internal network.
const REJECT:[string,string][]=[
  ['localhost','loopback name'],
  ['localhost:8787','loopback with port'],
  ['http://localhost','explicit scheme loopback'],
  ['127.0.0.1','IPv4 loopback'],
  ['127.1','short IPv4 form normalizes to loopback'],
  ['2130706433','integer IPv4 form normalizes to loopback'],
  ['0x7f.1','hex IPv4 form normalizes to loopback'],
  ['0177.0.0.1','octal IPv4 form normalizes to loopback'],
  ['0.0.0.0','unspecified address'],
  ['10.0.0.1','private class A'],
  ['172.16.0.1','private class B'],
  ['192.168.1.5','private class C'],
  ['169.254.169.254','cloud metadata endpoint'],
  ['[::1]','IPv6 loopback'],
  ['http://[::1]/','IPv6 loopback with scheme'],
  ['[fd00::1]','IPv6 unique local'],
  ['printer.local','mDNS name'],
  ['api.internal','internal TLD'],
  ['db.home.arpa','home.arpa'],
  ['intranet','dotless hostname'],
  ['example.com:22','non-web port'],
  ['example.com:8080','non-web port'],
  ['file:///etc/passwd','file scheme'],
  ['ftp://example.com','ftp scheme'],
  ['gopher://example.com','gopher scheme'],
  ['javascript:alert(1)','javascript scheme'],
  ['data:text/html,x','data scheme'],
  ['','empty input'],
  ['   ','whitespace only']
];

const ACCEPT:[string,string][]=[
  ['example.com','bare domain'],
  ['https://example.com','explicit https'],
  ['http://example.com','explicit http'],
  ['example.com:443','explicit https port'],
  ['example.com:80','explicit http port'],
  ['www.example.co.uk','multi-label public suffix'],
  ['https://shop.example.com/products/thing?x=1','deep path with query'],
  ['  example.com  ','surrounding whitespace'],
  ['EXAMPLE.COM','uppercase'],
  ['xn--bcher-kva.example','punycode label']
];

describe('assertScannableUrl',()=>{
  it.each(REJECT)('rejects %s (%s)',(input,_why)=>{
    expect(()=>assertScannableUrl(input)).toThrow();
  });
  it.each(ACCEPT)('accepts %s (%s)',(input,_why)=>{
    expect(()=>assertScannableUrl(input)).not.toThrow();
  });
  it('defaults a bare domain to https',()=>{
    expect(assertScannableUrl('example.com').protocol).toBe('https:');
  });
  it('preserves an explicit http scheme',()=>{
    expect(assertScannableUrl('http://example.com').protocol).toBe('http:');
  });
  it('does not silently mangle an unsupported scheme into a hostname',()=>{
    // "ftp://x.com" previously became https://ftp/... because the prefix was added
    // before the scheme was checked.
    expect(()=>assertScannableUrl('ftp://x.com')).toThrow(/http and https/);
  });
  it('gives a message safe to show a non-technical user',()=>{
    try{assertScannableUrl('127.0.0.1');}catch(e){
      expect(String((e as Error).message)).toMatch(/IP addresses/);
    }
  });
});
