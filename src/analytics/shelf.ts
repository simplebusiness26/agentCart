export type CommerceSourceClass="brand_owned"|"retailer"|"earned_media"|"ugc_social"|"reference"|"other";

export interface ShelfSourceObservation {
  provider?:string|null;
  surface?:string|null;
  url:string;
  source_type?:string|null;
  ownership?:string|null;
  occurrences?:number|string|null;
  citations?:number|string|null;
}

export interface ShelfRecommendationObservation {
  provider?:string|null;
  surface?:string|null;
  category?:string|null;
  subject:string;
  recommended:number|boolean;
}

function host(url:string){
  try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"");}
  catch{return "";}
}

const RETAILER=/^(?:.*\.)?(amazon\.|walmart\.|target\.|bestbuy\.|etsy\.|ebay\.|sephora\.|ulta\.|wayfair\.|carrefour\.|johnlewis\.|shop\.app)/i;
const SOCIAL=/^(?:.*\.)?(reddit\.com|quora\.com|youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|threads\.net|x\.com|twitter\.com|pinterest\.)$/i;

export function commerceSourceClass(row:Pick<ShelfSourceObservation,"url"|"source_type"|"ownership">):CommerceSourceClass{
  const type=String(row.source_type||"").toLowerCase(),ownership=String(row.ownership||"").toLowerCase(),domain=host(row.url);
  if(ownership==="owned"||type==="owned"||type==="brand_owned")return "brand_owned";
  if(type==="marketplace"||type==="retailer"||RETAILER.test(domain))return "retailer";
  if(type==="community"||type==="social"||type==="ugc"||SOCIAL.test(domain))return "ugc_social";
  if(type==="editorial"||type==="corporate"||type==="earned_media")return "earned_media";
  if(type==="reference")return "reference";
  return "other";
}

export function shelfSourceMix(rows:ShelfSourceObservation[]){
  const groups=new Map<string,{provider:string;surface:string;sourceClass:CommerceSourceClass;citations:number;occurrences:number}>();
  const totals=new Map<string,number>();
  for(const row of rows){
    const provider=String(row.provider||"unknown"),surface=String(row.surface||"unknown"),sourceClass=commerceSourceClass(row);
    const key=JSON.stringify([provider,surface,sourceClass]),groupKey=JSON.stringify([provider,surface]);
    const citations=Math.max(0,Number(row.citations||0)),occurrences=Math.max(0,Number(row.occurrences||0));
    const current=groups.get(key)||{provider,surface,sourceClass,citations:0,occurrences:0};
    current.citations+=citations;current.occurrences+=occurrences;groups.set(key,current);
    totals.set(groupKey,(totals.get(groupKey)||0)+citations);
  }
  return [...groups.values()].map(row=>{
    const total=totals.get(JSON.stringify([row.provider,row.surface]))||0;
    return {...row,citationShare:total?row.citations/total:0,totalCitations:total};
  }).sort((a,b)=>a.provider.localeCompare(b.provider)||a.surface.localeCompare(b.surface)||b.citations-a.citations);
}

export function shelfRecommendationShare(rows:ShelfRecommendationObservation[]){
  const groups=new Map<string,Map<string,{subject:string;recommendations:number;observations:number}>>();
  for(const row of rows){
    const provider=String(row.provider||"unknown"),surface=String(row.surface||"unknown"),category=String(row.category||"uncategorised");
    const key=JSON.stringify([provider,surface,category]),subjects=groups.get(key)||new Map();
    const subject=String(row.subject||"").trim();if(!subject)continue;
    const current=subjects.get(subject)||{subject,recommendations:0,observations:0};
    current.observations+=1;current.recommendations+=Number(Boolean(row.recommended));subjects.set(subject,current);groups.set(key,subjects);
  }
  const out=[] as Array<{provider:string;surface:string;category:string;subject:string;recommendations:number;observations:number;recommendationRate:number;recommendationShare:number;totalRecommendations:number;stability:"insufficient_sample"|"early_signal"|"measured"}>;
  for(const [key,subjects] of groups){
    const [provider,surface,category]=JSON.parse(key) as [string,string,string],all=[...subjects.values()];
    const totalRecommendations=all.reduce((n,row)=>n+row.recommendations,0);
    for(const row of all)out.push({provider,surface,category,...row,recommendationRate:row.observations?row.recommendations/row.observations:0,
      recommendationShare:totalRecommendations?row.recommendations/totalRecommendations:0,totalRecommendations,
      stability:row.observations<5?"insufficient_sample":row.observations<20?"early_signal":"measured"});
  }
  return out.sort((a,b)=>a.provider.localeCompare(b.provider)||a.category.localeCompare(b.category)||b.recommendationShare-a.recommendationShare);
}

export function aiShelfAnalytics(input:{sources:ShelfSourceObservation[];recommendations:ShelfRecommendationObservation[]}){
  return {
    sourceMix:shelfSourceMix(input.sources),
    recommendationShare:shelfRecommendationShare(input.recommendations),
    sourceClasses:["brand_owned","retailer","earned_media","ugc_social","reference","other"] as CommerceSourceClass[],
    caveat:"AI Shelf metrics describe the merchant's observed evidence. Published market-wide source mixes are context, not ranking weights; provider, category, country, prompt set and time window can materially change the result."
  };
}
