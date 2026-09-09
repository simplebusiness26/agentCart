import type {PageSignals,PageType} from "./types";

// Everything here is pure string analysis. The Worker must never execute site JavaScript,
// so this is regex/segment based rather than DOM based, and treats all input as untrusted
// data. Nothing extracted here is ever interpreted as an instruction.
//
// IMPORTANT: every quantifier below is bounded. The scanner fetches attacker-chosen URLs,
// so an unbounded greedy or negated class is a denial-of-service vector -- a 512KB page
// with no delimiter made three of these patterns quadratic and hung the scanner for
// minutes. There is a regression test covering the shapes that triggered it.

const stripTags=(html:string)=>html
  .replace(/<script\b[^<>]{0,2000}>[\s\S]{0,500000}?<\/script>/gi," ")
  .replace(/<style\b[^<>]{0,2000}>[\s\S]{0,500000}?<\/style>/gi," ")
  .replace(/<[^<>]{0,4000}>/g," ");

export function jsonLdBlocks(html:string){
  const out:unknown[]=[];
  const re=/<script[^<>]{0,500}type=["']application\/ld\+json["'][^<>]{0,500}>([\s\S]{0,200000}?)<\/script>/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(html))){
    try{
      const parsed=JSON.parse(m[1].trim());
      // A @graph wrapper is common; flatten it so type detection is uniform.
      if(parsed&&typeof parsed==="object"&&Array.isArray((parsed as any)["@graph"]))out.push(...(parsed as any)["@graph"]);
      else if(Array.isArray(parsed))out.push(...parsed);
      else out.push(parsed);
    }catch{/* malformed JSON-LD is a finding, not a crash */}
  }
  return out;
}

export function jsonLdTypes(blocks:unknown[]){
  const types=new Set<string>();
  for(const b of blocks){
    const t=(b as any)?.["@type"];
    if(typeof t==="string")types.add(t);
    else if(Array.isArray(t))for(const x of t)if(typeof x==="string")types.add(x);
  }
  return [...types];
}

const attr=(html:string,re:RegExp)=>{const m=html.match(re);return m?m[1].trim():"";};

export function extractSignals(html:string):PageSignals{
  const blocks=jsonLdBlocks(html);
  const types=jsonLdTypes(blocks).map(t=>t.toLowerCase());
  const text=stripTags(html).replace(/\s+/g," ").trim();
  const images=(html.match(/<img\b/gi)||[]).length;
  const imagesWithAlt=(html.match(/<img\b[^<>]{0,2000}?\balt=["'][^"']{1,500}["']/gi)||[]).length;
  const currencies=new Set<string>();
  for(const m of html.matchAll(/\b(GBP|USD|EUR|CAD|AUD|JPY|NZD|CHF|SEK|DKK|NOK)\b/g))currencies.add(m[1]);
  for(const [sym,code] of [["£","GBP"],["\\$","USD"],["€","EUR"],["¥","JPY"]] as const)
    if(new RegExp(`${sym}\\s?\\d`).test(html))currencies.add(code);

  return {
    hasJsonLd:blocks.length>0,
    jsonLdTypes:types,
    productSchema:types.some(t=>["product","productgroup","offer","itemlist","aggregateoffer"].includes(t)),
    organizationSchema:types.some(t=>["organization","localbusiness","store","corporation","onlinestore"].includes(t)||t.endsWith("business")),
    breadcrumbSchema:types.includes("breadcrumblist"),
    faqSchema:types.some(t=>["faqpage","qapage"].includes(t)),
    openGraph:/property=["']og:(title|description|image)["']/i.test(html),
    metaDescription:attr(html,/<meta[^<>]{0,500}name=["']description["'][^<>]{0,500}content=["']([^"']{0,2000})["']/i),
    canonical:/<link[^<>]{0,500}rel=["']canonical["']/i.test(html),
    title:attr(html,/<title[^<>]{0,200}>([^<]{0,500})<\/title>/i),
    h1:stripTags(attr(html,/<h1[^<>]{0,500}>([\s\S]{0,5000}?)<\/h1>/i)).replace(/\s+/g," ").trim(),
    priceSignals:/(?:£|\$|€|¥)\s?\d|"price"\s*:|\bprice\b[^a-z]{0,12}\d|\d{1,12}\.\d{2}\b/i.test(html),
    currencySignals:[...currencies],
    availabilitySignals:/(in stock|out of stock|sold out|pre-?order|availability|InStock|OutOfStock|BackOrder|low stock)/i.test(html),
    variantSignals:/(variant|size|colour|color|option)\s{0,4}(:|<\/|["'])/i.test(html)||/<select\b/i.test(html),
    skuSignals:/\b(sku|gtin\d{0,3}|mpn|barcode|isbn)\b/i.test(html),
    images,imagesWithAlt,
    emails:[...new Set((html.match(/[a-z0-9._%+-]{1,64}@[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63}){0,4}\.[a-z]{2,24}/gi)||[]).map(e=>e.toLowerCase()))].slice(0,5),
    phones:[...new Set((text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?){2,4}\d{2,4}/g)||[])
      .map(p=>p.trim()).filter(p=>p.replace(/\D/g,"").length>=9&&p.replace(/\D/g,"").length<=15))].slice(0,5),
    addressSignals:/(postalcode|streetaddress|address[_-]?line|\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b|\b\d{5}(-\d{4})?\b)/i.test(html),
    hoursSignals:/(opening hours|openinghours|hours of business|mon(day)?\s{0,3}[-–]\s{0,3}(fri|sat|sun)|we are open|business hours)/i.test(html),
    addToCart:/(add to (cart|bag|basket)|\/cart\/add|name=["']add["']|data-add-to-cart)/i.test(html),
    checkoutLink:/(\/checkout|proceed to checkout|buy it now|buy now)/i.test(html),
    bookingSignals:/(book (now|a|an|your)|make a booking|schedule (a|an|your)|appointment|reserve a table|reservation)/i.test(html),
    quoteSignals:/(get a quote|request a quote|free quote|request a estimate|get an estimate|enquire|inquiry)/i.test(html),
    contactForm:/<form\b[\s\S]{0,600}?(name=["'](email|message|enquiry|name)["']|type=["']email["'])/i.test(html),
    searchForm:/(type=["']search["']|name=["']q["']|role=["']search["'])/i.test(html),
    textLength:text.length,
    bodyTextRatio:html.length?text.length/html.length:0
  };
}

const PAGE_HINTS:Array<[PageType,RegExp]>=[
  ["product",/\/(products?|item|shop\/[^/]{1,200}\/?$|p)\//i],
  ["collection",/\/(collections?|category|categories|shop|catalog(ue)?|product-category)\b/i],
  ["contact",/\/(contact|contact-us|get-in-touch|reach-us)\b/i],
  ["about",/\/(about|about-us|our-story|who-we-are)\b/i],
  ["faq",/\/(faq|faqs|help|support|questions)\b/i],
  ["shipping",/\/(shipping|delivery|postage|shipping-policy)\b/i],
  ["returns",/\/(returns?|refunds?|exchanges?|returns-policy|refund-policy)\b/i],
  ["policy",/\/(policies|privacy|terms|legal|cookie)\b/i],
  ["booking",/\/(book|booking|appointments?|reserve|reservations?|schedule)\b/i]
];

export function classifyPage(url:string,isRoot=false):PageType{
  if(isRoot)return "home";
  let path="/";
  try{path=new URL(url).pathname;}catch{/* fall through to other */}
  if(path==="/"||path==="")return "home";
  for(const [type,re] of PAGE_HINTS)if(re.test(path))return type;
  return "other";
}
