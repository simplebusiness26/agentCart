import type {PlatformResult} from "./types";

interface Signal { re:RegExp; weight:number; label:string }

// Weights are calibrated so no single weak marker can produce a confident claim: the
// build plan explicitly forbids that. A result only reports a platform when the combined
// weight clears MIN_CONFIDENCE, and confidence is reported alongside it either way.
const SIGNALS:Record<"shopify"|"woocommerce"|"wordpress",Signal[]>={
  shopify:[
    {re:/cdn\.shopify\.com/i,weight:.5,label:"Shopify CDN assets"},
    {re:/Shopify\.theme|window\.Shopify/i,weight:.45,label:"Shopify theme runtime"},
    {re:/myshopify\.com/i,weight:.4,label:"myshopify.com reference"},
    {re:/shopify-section|shopify-payment-button/i,weight:.3,label:"Shopify section markup"},
    {re:/\/cdn\/shop\/(files|products)\//i,weight:.35,label:"Shopify product CDN paths"}
  ],
  woocommerce:[
    {re:/woocommerce(-|\.)/i,weight:.45,label:"WooCommerce assets"},
    {re:/wp-content\/plugins\/woocommerce/i,weight:.5,label:"WooCommerce plugin path"},
    {re:/wc-ajax|wc_add_to_cart/i,weight:.4,label:"WooCommerce cart endpoints"},
    {re:/class=["'][^"']*\bwoocommerce\b/i,weight:.3,label:"WooCommerce body classes"}
  ],
  wordpress:[
    {re:/wp-content\//i,weight:.4,label:"wp-content assets"},
    {re:/wp-includes\//i,weight:.35,label:"wp-includes assets"},
    {re:/<meta[^>]+name=["']generator["'][^>]+WordPress/i,weight:.5,label:"WordPress generator tag"},
    {re:/\/wp-json\//i,weight:.3,label:"WordPress REST API"}
  ]
};

const MIN_CONFIDENCE=.5;

export function detectPlatform(html:string,headers:Record<string,string>={},url=""):PlatformResult{
  const haystack=`${html}\n${Object.entries(headers).map(([k,v])=>`${k}: ${v}`).join("\n")}\n${url}`;
  const scored=(Object.keys(SIGNALS) as Array<keyof typeof SIGNALS>).map(platform=>{
    const hits=SIGNALS[platform].filter(s=>s.re.test(haystack));
    // Diminishing returns: several corroborating markers should beat one strong marker,
    // without letting a long tail of weak ones reach certainty on its own.
    const confidence=Math.min(.99,hits.reduce((acc,h)=>acc+h.weight*(1-acc),0));
    return {platform,confidence,signals:hits.map(h=>h.label)};
  }).sort((a,b)=>b.confidence-a.confidence);

  const best=scored[0];
  // WooCommerce sits on top of WordPress, so WordPress markers alone must not outrank it.
  const woo=scored.find(s=>s.platform==="woocommerce")!;
  const chosen=woo.confidence>=MIN_CONFIDENCE?woo:best;
  if(!chosen||chosen.confidence<MIN_CONFIDENCE)
    return {platform:"other",confidence:chosen?chosen.confidence:0,signals:chosen?chosen.signals:[]};
  return {platform:chosen.platform,confidence:Number(chosen.confidence.toFixed(2)),signals:chosen.signals};
}
