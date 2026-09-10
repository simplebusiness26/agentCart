// The eighteen real-infrastructure checks from Phase 11.2.
//
// These are DECLARATIONS, not results. Nothing here can be satisfied by a unit test: each names
// what must be proven against a deployed Worker, real D1 and a real Shopify development store.
// Every check starts at "not_run" and only a real run against real infrastructure can change it.

export type LaunchStatus="pass"|"fail"|"blocked"|"not_run";

export interface LaunchCheck {
  key:string;
  title:string;
  /** What must be true, in terms a person can verify. */
  proves:string;
  /** Why a mocked test cannot establish it. */
  whyNotMockable:string;
  requires:Array<"cloudflare"|"d1"|"shopify_app"|"dev_store"|"pixel"|"public_url"|"test_order">;
  mode:"automated"|"manual";
}

export const LAUNCH_CHECKS:LaunchCheck[]=[
  {key:"d1-migrations",title:"D1 migrations apply cleanly",
   proves:"Every migration in migrations/ applies in order to a real D1 database.",
   whyNotMockable:"The test suite applies migrations to node:sqlite, which shares SQL syntax but is not D1.",
   requires:["cloudflare","d1"],mode:"automated"},
  {key:"d1-returning",title:"INSERT ... ON CONFLICT ... RETURNING works on hosted D1",
   proves:"The rate limiter's upsert returns the updated count on the real service.",
   whyNotMockable:"RETURNING support is a property of the hosted engine, not of SQLite generally.",
   requires:["cloudflare","d1"],mode:"automated"},
  {key:"d1-batch",title:"DB.batch() is safe on hosted D1",
   proves:"Batched writes used for scan runs and catalogue sync behave atomically enough to rely on.",
   whyNotMockable:"The shim executes batches sequentially; hosted transactionality can differ.",
   requires:["cloudflare","d1"],mode:"automated"},
  {key:"oauth-hmac",title:"OAuth HMAC verifies against Shopify's real callback",
   proves:"verifyOAuthHmac accepts a genuine Shopify callback with the exact parameter set Shopify sends.",
   whyNotMockable:"Unit tests sign with a synthetic secret; only Shopify knows which parameters it actually sends.",
   requires:["shopify_app","dev_store","public_url"],mode:"manual"},
  {key:"oauth-lifecycle",title:"Install, dashboard, uninstall and reinstall all work",
   proves:"A session survives install, grants dashboard access, dies on uninstall and is replaced on reinstall.",
   whyNotMockable:"Requires Shopify to drive the real OAuth redirect and webhook sequence.",
   requires:["shopify_app","dev_store","public_url"],mode:"manual"},
  {key:"pixel-install",title:"The Web Pixel installs and updates",
   proves:"webPixelCreate succeeds on first install and webPixelUpdate succeeds on reinstall.",
   whyNotMockable:"Shopify's real error codes for a duplicate pixel are undocumented and were assumed.",
   requires:["shopify_app","dev_store","pixel"],mode:"manual"},
  {key:"pixel-origin",title:"The pixel's real Origin header is observed",
   proves:"The actual Origin the sandboxed pixel sends, so any enforcement rule is based on evidence.",
   whyNotMockable:"The sandbox's Origin cannot be known without a live storefront; enforcing a guess would zero every dashboard.",
   requires:["dev_store","pixel","public_url"],mode:"automated"},
  {key:"pixel-timestamps",title:"Pixel timestamps parse",
   proves:"Every ingested event has a non-null occurred_ms, so the pixel's timestamp format matches Date.parse.",
   whyNotMockable:"The real timestamp format is emitted by Shopify's runtime, not by our fixtures.",
   requires:["dev_store","pixel"],mode:"automated"},
  {key:"catalog-sync",title:"Catalogue sync works against the real Admin API",
   proves:"Products, variants, prices and SEO fields sync from a real store through the GraphQL Admin API.",
   whyNotMockable:"Field availability and pagination behaviour come from the live API.",
   requires:["shopify_app","dev_store"],mode:"automated"},
  {key:"fix-lifecycle",title:"A real fix previews, approves, applies and verifies",
   proves:"An actual Shopify mutation lands and is independently confirmed by re-reading the platform.",
   whyNotMockable:"The fake Shopify in tests cannot prove a real mutation persists.",
   requires:["shopify_app","dev_store"],mode:"automated"},
  {key:"rescan-delta",title:"A rescan shows the real before/after without fabricating gains",
   proves:"Score movement after a real fix reflects an actual change on the live site.",
   whyNotMockable:"Requires a real site to change and be re-crawled.",
   requires:["dev_store","public_url"],mode:"automated"},
  {key:"ai-layer-live",title:"Public AI endpoints serve real connected-store data",
   proves:"profile, catalog, items, search, policies and actions return real merchant data.",
   whyNotMockable:"Requires a real synced catalogue behind the public endpoints.",
   requires:["public_url","dev_store"],mode:"automated"},
  {key:"mcp-live",title:"MCP works against the real merchant profile",
   proves:"tools/list and tools/call succeed against live data from a real MCP client.",
   whyNotMockable:"Only a real client proves transport compatibility.",
   requires:["public_url","dev_store"],mode:"manual"},
  {key:"discovery-live",title:"Discovery files behave correctly against the real store",
   proves:"agents.md, llms.txt, llms-full.txt and /.well-known/ucp detection is correct on a live storefront.",
   whyNotMockable:"Whether Shopify serves any of these natively is unverified and must be observed.",
   requires:["dev_store","public_url"],mode:"automated"},
  {key:"journey-live",title:"A safe live agent journey reaches the checkout handoff",
   proves:"A real journey reaches checkout and stops there without a charge.",
   whyNotMockable:"Requires a real storefront to walk.",
   requires:["dev_store","public_url"],mode:"automated"},
  {key:"order-join",title:"Pixel and server-side order identifiers actually join",
   proves:"checkout.order.id from the pixel normalizes to the same value as the orders webhook id.",
   whyNotMockable:"The pixel's real order id format is unverifiable without a completed test order.",
   requires:["dev_store","pixel","test_order"],mode:"manual"},
  {key:"cron-live",title:"The monitoring cron runs in real Cloudflare",
   proves:"The scheduled handler fires and creates a real subsequent scan history entry.",
   whyNotMockable:"Cron triggers only exist on the deployed Worker.",
   requires:["cloudflare","public_url"],mode:"manual"},
  {key:"uninstall-revokes",title:"Uninstall revokes the session immediately",
   proves:"After uninstall, a previously valid session cookie no longer grants dashboard access.",
   whyNotMockable:"Requires Shopify to send the real app/uninstalled webhook.",
   requires:["shopify_app","dev_store"],mode:"manual"}
];

export function checkByKey(key:string){return LAUNCH_CHECKS.find(c=>c.key===key)||null;}
