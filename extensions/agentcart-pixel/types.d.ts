// Local ambient declarations for the subset of @shopify/web-pixels-extension that
// AgentCart actually consumes. This is deliberately loose (every field optional) and
// is NOT a description of the full SDK surface — it exists so the extension is covered
// by `tsc --noEmit` without adding the SDK to the root install, which would re-couple
// the Worker and extension dependency trees.
declare module "@shopify/web-pixels-extension" {
  export interface PixelBrowserStorage {
    getItem(key:string):Promise<string|null>;
    setItem(key:string,value:string):Promise<void>;
  }
  export interface PixelBrowser { sessionStorage:PixelBrowserStorage; localStorage?:PixelBrowserStorage }
  export interface PixelEvent {
    id?:string;
    name?:string;
    seq?:number;
    timestamp?:string;
    clientId?:string;
    context?:{document?:{referrer?:string;location?:{href?:string}}};
    data?:Record<string,any>;
  }
  export interface PixelAnalytics { subscribe(event:string,handler:(event:PixelEvent)=>void):void }
  export interface PixelApi {
    analytics:PixelAnalytics;
    browser:PixelBrowser;
    settings:Record<string,unknown>;
    init?:unknown;
  }
  export function register(fn:(api:PixelApi)=>void):void;
}
