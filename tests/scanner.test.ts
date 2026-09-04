import {describe,expect,it} from 'vitest';
import {scoreHtml} from '../src/scanner';

describe('AgentCart readiness scanner',()=>{
  it('scores a machine-readable commerce page highly',()=>{
    const html=`<!doctype html><html><head>
      <title>Example Store - Product</title>
      <meta name="description" content="A detailed product description with useful purchase information for shoppers.">
      <meta property="og:title" content="Example Product">
      <link rel="canonical" href="https://example.com/products/item">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Item","offers":{"@type":"Offer","price":"29.99","priceCurrency":"GBP","availability":"https://schema.org/InStock"}}</script>
      </head><body><img src="item.jpg" alt="Example product front view"><p>£29.99 - In stock</p></body></html>`;
    const result=scoreHtml('https://example.com/products/item',html,{robots:'User-agent: *\nAllow: /',llms:'# Example',sitemap:true});
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.grade).not.toBe('Poor');
  });

  it('surfaces missing commerce signals',()=>{
    const result=scoreHtml('https://example.com','<html><head><title>X</title></head><body><img src="x.jpg"></body></html>',{sitemap:false});
    expect(result.score).toBeLessThan(60);
    expect(result.findings.some(f=>f.status==='bad')).toBe(true);
  });

  it('never scores outside 0-100',()=>{
    const result=scoreHtml('https://example.com','<html></html>');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
