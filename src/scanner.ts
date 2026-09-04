import type { Finding, ScanResult } from "./types";

const yesNo = (key:string,title:string,ok:boolean,maxPoints:number,good:string,bad:string,fix:string):Finding => ({
  key,title,status:ok?"good":"bad",points:ok?maxPoints:0,maxPoints,detail:ok?good:bad,fix:ok?undefined:fix
});

export function scoreHtml(url:string, html:string, extras:{robots?:string;llms?:string;sitemap?:boolean}={}):ScanResult {
  const u = new URL(url);
  const findings:Finding[] = [];
  const jsonLd = /application\/ld\+json/i.test(html) && /"@type"\s*:\s*"(Product|Offer|ItemList)"/i.test(html);
  findings.push(yesNo("structured-data","Structured product data",jsonLd,20,"Product/offer structured data is present.","No clear Product/Offer structured data was detected.","Add valid JSON-LD Product/Offer schema including price, currency, availability, brand and identifiers."));
  findings.push(yesNo("metadata","Rich page metadata",/property=["']og:(title|description|image)["']/i.test(html),10,"Rich metadata is available.","Open Graph metadata is incomplete or missing.","Add og:title, og:description and og:image on important pages."));
  findings.push(yesNo("description","Clear description",/<meta[^>]+name=["']description["'][^>]+content=["'][^"']{30,}["']/i.test(html),8,"A meaningful description is present.","No meaningful meta description was detected.","Write specific descriptions stating what is sold and the important product facts."));
  findings.push(yesNo("canonical","Canonical URLs",/<link[^>]+rel=["']canonical["']/i.test(html),6,"Canonical markup is present.","Canonical markup was not detected.","Add canonical URLs to reduce ambiguity between duplicate or variant pages."));
  findings.push(yesNo("pricing","Explicit pricing",/(?:£|\$|€|USD|GBP|EUR)\s?\d|"price"\s*:/i.test(html),12,"Price signals are present.","No obvious machine-readable price signal was detected.","Expose current price and currency in structured data and visible product content."));
  findings.push(yesNo("availability","Availability",/(in stock|out of stock|preorder|availability|InStock|OutOfStock)/i.test(html),10,"Stock/availability signals were detected.","Availability was not obvious to a machine reader.","Expose availability with schema.org values and clear storefront copy."));

  const images=(html.match(/<img\b/gi)||[]).length;
  const alts=(html.match(/<img\b[^>]*\balt=["'][^"']+["']/gi)||[]).length;
  const altRatio=images===0?1:alts/images;
  findings.push({key:"images",title:"Machine-readable images",status:altRatio>=.8?"good":altRatio>=.5?"warn":"bad",points:Math.round(10*Math.min(1,altRatio)),maxPoints:10,detail:images===0?"No images detected.":`${Math.round(altRatio*100)}% of images have non-empty alt text.`,fix:altRatio>=.8?undefined:"Add factual alt text describing products and important visual attributes."});

  const blocked = extras.robots ? /User-agent:\s*\*[^]*?Disallow:\s*\//i.test(extras.robots) : false;
  findings.push({key:"robots",title:"Crawler accessibility",status:blocked?"warn":"good",points:blocked?3:8,maxPoints:8,detail:blocked?"robots.txt appears to include a broad block.":"No blanket crawler block was detected.",fix:blocked?"Review crawler rules and explicitly allow the agents/search systems you want to reach.":undefined});
  findings.push({key:"llms",title:"AI guidance",status:extras.llms?"good":"warn",points:extras.llms?6:2,maxPoints:6,detail:extras.llms?"An llms.txt file was detected.":"No llms.txt was detected; this is optional but can clarify canonical information for agents.",fix:extras.llms?undefined:"Consider a concise /llms.txt pointing to canonical products, policies and contact information."});
  findings.push({key:"sitemap",title:"Sitemap",status:extras.sitemap?"good":"warn",points:extras.sitemap?6:2,maxPoints:6,detail:extras.sitemap?"A sitemap endpoint responded successfully.":"A sitemap was not confirmed.",fix:extras.sitemap?undefined:"Publish and maintain sitemap.xml."});
  findings.push(yesNo("title","Descriptive page title",/<title>[^<]{3,}<\/title>/i.test(html),10,"A descriptive title is present.","The page title is missing or too weak to detect.","Use specific titles identifying the product/store and user intent."));

  const max=findings.reduce((s,f)=>s+f.maxPoints,0);
  const raw=findings.reduce((s,f)=>s+f.points,0);
  const score=Math.round(raw/max*100);
  const grade:ScanResult["grade"]=score>=85?"Excellent":score>=70?"Good":score>=50?"Needs work":"Poor";
  return {url,domain:u.hostname,score,grade,findings,scannedAt:new Date().toISOString()};
}

export async function scanWebsite(input:string):Promise<ScanResult>{
  let value=input.trim();
  if(!/^https?:\/\//i.test(value)) value=`https://${value}`;
  const url=new URL(value);
  if(!["http:","https:"].includes(url.protocol)) throw new Error("Only public http/https websites can be scanned.");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  const headers={"User-Agent":"AgentCartReadinessScanner/1.0"};
  try{
    const [page,robots,llms,sitemap]=await Promise.allSettled([
      fetch(url.toString(),{signal:controller.signal,headers}),
      fetch(new URL("/robots.txt",url.origin),{signal:controller.signal,headers}),
      fetch(new URL("/llms.txt",url.origin),{signal:controller.signal,headers}),
      fetch(new URL("/sitemap.xml",url.origin),{signal:controller.signal,headers})
    ]);
    if(page.status!=="fulfilled"||!page.value.ok) throw new Error("We could not load that website.");
    const html=(await page.value.text()).slice(0,2_000_000);
    const robotsText=robots.status==="fulfilled"&&robots.value.ok?await robots.value.text():undefined;
    const llmsText=llms.status==="fulfilled"&&llms.value.ok?await llms.value.text():undefined;
    return scoreHtml(url.toString(),html,{robots:robotsText,llms:llmsText,sitemap:sitemap.status==="fulfilled"&&sitemap.value.ok});
  }finally{clearTimeout(timer);}
}
