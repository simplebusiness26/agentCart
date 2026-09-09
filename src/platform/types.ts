// Platform-neutral contracts. Shopify is the only implementation today; WooCommerce and
// WordPress adapters plug in here rather than by threading platform checks through the
// scanner, the fix engine or the AI layer.

export interface NormalizedItem {
  id:string;
  handle:string;
  title:string;
  description:string;
  productType:string;
  vendor:string;
  url:string;
  imageUrl:string;
  imageAlt:string;
  priceMin:number|null;
  priceMax:number|null;
  currency:string;
  available:boolean;
  variants:Array<{id:string;title:string;price:number|null;available:boolean;sku:string}>;
  seoTitle:string;
  seoDescription:string;
  identifiers:{sku:string;barcode:string};
  status:string;
}

export interface NormalizedBusiness {
  name:string;
  description:string;
  contactEmail:string;
  contactPhone:string;
  address:Record<string,string>;
  currency:string;
  primaryUrl:string;
  policies:Array<{type:string;title:string;url:string;body:string}>;
}

export interface PlatformAdapter {
  readonly platform:string;
  syncBusiness(shop:string,token:string):Promise<NormalizedBusiness>;
  syncCatalog(shop:string,token:string,limit?:number):Promise<NormalizedItem[]>;
}
