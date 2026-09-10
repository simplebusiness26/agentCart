// The Agent Ready model. Deliberately platform-neutral: nothing here knows about
// Shopify. Platform adapters plug in via detectPlatform and the fix registry.

export type CheckStatus="pass"|"partial"|"fail"|"na";
export type FixType="automatic"|"approval_required"|"manual"|"hosted_layer"|"unavailable";

export type Category="business"|"catalog"|"policies"|"access"|"actions";

// Weights sum to 100. A category's points only count when at least one of its checks
// applies, so a business with no catalog is not punished for lacking one.
export const CATEGORY_WEIGHTS:Record<Category,number>={
  business:20,catalog:25,policies:15,access:15,actions:25
};

export const CATEGORY_LABELS:Record<Category,string>={
  business:"Understanding your business",
  catalog:"Understanding what you sell",
  policies:"Finding your policies",
  access:"Reaching your site",
  actions:"Taking action"
};

export type PageType="home"|"product"|"collection"|"contact"|"about"|"faq"|"shipping"|"returns"|"policy"|"booking"|"other";

export interface PageEvidence {
  url:string;
  pageType:PageType;
  status:number;
  title:string;
  // Raw signals extracted from one page. Everything the scoring layer reads lives here,
  // so scoring stays pure and testable without any network.
  signals:PageSignals;
}

export interface PageSignals {
  hasJsonLd:boolean;
  jsonLdTypes:string[];
  productSchema:boolean;
  organizationSchema:boolean;
  breadcrumbSchema:boolean;
  faqSchema:boolean;
  openGraph:boolean;
  metaDescription:string;
  canonical:boolean;
  title:string;
  h1:string;
  priceSignals:boolean;
  currencySignals:string[];
  availabilitySignals:boolean;
  variantSignals:boolean;
  skuSignals:boolean;
  images:number;
  imagesWithAlt:number;
  emails:string[];
  phones:string[];
  addressSignals:boolean;
  hoursSignals:boolean;
  addToCart:boolean;
  checkoutLink:boolean;
  bookingSignals:boolean;
  quoteSignals:boolean;
  contactForm:boolean;
  searchForm:boolean;
  textLength:number;
  // Content that only appears after interaction is invisible to most agents.
  bodyTextRatio:number;
}

export interface Check {
  key:string;
  category:Category;
  status:CheckStatus;
  points:number;
  maxPoints:number;
  // Plain-English first. The technical string is secondary detail, per the build plan.
  plainTitle:string;
  whyItMatters:string;
  evidence:string;
  technicalDetail:string;
  recommendedFix:string;
  fixType:FixType;
  estimatedGain:number;
}

export interface CapabilitySummary {
  canUnderstand:string[];
  cannotUnderstand:string[];
  canDo:string[];
  cannotDo:string[];
}

export interface PlatformResult {
  platform:"shopify"|"woocommerce"|"wordpress"|"other";
  confidence:number;
  signals:string[];
}

export interface AgentReadyReport {
  url:string;
  domain:string;
  score:number;
  grade:"Excellent"|"Good"|"Needs work"|"Poor";
  scoringVersion:string;
  platform:PlatformResult;
  categories:Array<{category:Category;label:string;score:number;points:number;maxPoints:number}>;
  capabilities:CapabilitySummary;
  checks:Check[];
  pages:PageEvidence[];
  pointsRecoverable:number;
  scannedAt:string;
}
