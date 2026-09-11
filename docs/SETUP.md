# AgentCart setup and deployment

AgentCart is built to validate the product on free tiers first. The application is a Cloudflare Worker with D1 storage plus a Shopify Web Pixel extension.

## 1. Install dependencies

```bash
npm install
```

## 2. Create the D1 database

```bash
npx wrangler d1 create agentcart
```

Cloudflare will return a database ID. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with that ID.

Apply the database schema:

```bash
npm run db:migrate:remote
```

For local development:

```bash
npm run db:migrate:local
npm run dev
```

The demo dashboard is available at:

`http://localhost:8787/dashboard?demo=1`

## 3. Deploy the Worker once

Before Shopify can call AgentCart, it needs a public HTTPS URL.

```bash
npm run deploy
```

Copy the resulting `https://...workers.dev` URL and set it as `APP_URL` in `wrangler.toml`, then deploy again.

Example:

```toml
[vars]
APP_URL = "https://agentcart.example.workers.dev"
SHOPIFY_API_VERSION = "2026-07"
```

## 4. Create the Shopify app

Create an app in the Shopify Dev Dashboard / CLI for AgentCart. The app is intentionally standalone rather than embedded.

Copy:

```bash
cp shopify.app.toml.example shopify.app.toml
```

Replace:

- `REPLACE_WITH_SHOPIFY_CLIENT_ID`
- `REPLACE_WITH_AGENTCART_URL`

The configured scopes are:

- `read_products`
- `write_products` — required by the product metafield and SEO fixes
- `write_pixels`
- `read_customer_events`

The scopes Shopify actually grants are recorded per shop at install (`shops.granted_scopes`,
migration `0016`). A fix declaring a scope that is not in that record is withheld with an
explanation rather than offered and failed. Stores installed before `write_products` was
requested must reconnect before the two product fixes become available; the Fixes tab shows
them under "Needs a reconnection" until they do.

The app config also registers:

- `app/uninstalled`
- `customers/data_request`
- `customers/redact`
- `shop/redact`

All are handled at `/api/shopify/webhooks` with Shopify HMAC verification.

## 5. Add Worker secrets

Do not place real credentials in Git.

```bash
npx wrangler secret put SHOPIFY_API_KEY
npx wrangler secret put SHOPIFY_API_SECRET
npx wrangler secret put TOKEN_ENCRYPTION_KEY
```

For `TOKEN_ENCRYPTION_KEY`, use a long random value. It protects Shopify offline access tokens before they are stored in D1.

## 6. Deploy the Shopify Web Pixel

The Web Pixel extension lives in:

`extensions/agentcart-pixel`

Deploy the Shopify app configuration and extension:

```bash
npx shopify app deploy
```

AgentCart activates the pixel for a store after OAuth by calling `webPixelCreate` with two settings:

- `endpoint`: `${APP_URL}/api/events`
- `shop`: the canonical `*.myshopify.com` domain

The pixel listens for:

- `page_viewed`
- `product_viewed`
- `checkout_started`
- `checkout_completed`

It stores the initial referral source in Shopify's session storage API so the same attribution source can follow the session through checkout.

## 7. Install on a development store

Open AgentCart and enter the development store's canonical domain, for example:

`example-store.myshopify.com`

AgentCart redirects through Shopify OAuth, stores the encrypted token, activates the Web Pixel, sets a signed AgentCart session cookie, and redirects to `/dashboard`.

## 8. Verify the live event loop

On the development store:

1. Open the storefront from a normal browser.
2. View a product.
3. Start a test checkout.
4. Complete a Shopify test order if your development store supports it.
5. Open AgentCart `/dashboard`.

Also verify:

```text
GET /health
```

returns an `ok: true` response.

## 9. Test AI referral attribution

For a controlled test, open the storefront from a page on a domain that AgentCart classifies as an AI source, or temporarily inspect events in D1 while testing referral behavior. The production classifier currently recognizes:

- ChatGPT
- Claude
- Perplexity
- Gemini
- Microsoft Copilot
- Meta AI

Anything else is recorded as `Other referral` or `Direct / unknown` rather than guessed.

## 10. Run verification

```bash
npm run typecheck
npm test
```

GitHub Actions runs these checks on pushes to `main` and on every pull request.

**These prove the logic, not the system.** A green suite and green CI never make AgentCart launch
ready — see §10a. Treat the checks below as the real verification.

### First things to check against real infrastructure

The test suite runs D1 queries against `node:sqlite`, which shares SQLite semantics but is not
workerd. Two assumptions are worth confirming immediately after the first remote migration:

- `INSERT ... ON CONFLICT ... RETURNING` behaves as expected (used by the rate limiter).
- `DB.batch()` is atomic on the hosted service (used when saving scan runs and catalogues).

Also confirm, on the first real store:

- `SELECT DISTINCT json_extract(payload_json,'$.origin') FROM events` — this reveals the real
  `Origin` the Web Pixel sends, which is currently recorded but not enforced. Enforce it from
  evidence, not from a guess.
- `SELECT COUNT(*) FROM events WHERE occurred_ms IS NULL` — should be zero, which confirms the
  pixel timestamp format parses.
- Whether `checkout.order.id` from the pixel matches the order id format the `orders/paid` webhook
  sends, if verified revenue is enabled. `normalizeOrderId` is deliberately tolerant, but the join
  should be confirmed rather than assumed.
- That OAuth HMAC verifies against Shopify's real parameter set. The algorithm is unit tested with a
  synthetic secret; only the parameters Shopify actually sends are unverified.
- Whether your Shopify storefront itself publishes `/.well-known/ucp`. AgentCart reports this as
  `unknown` and asserts in a test that it makes no claim either way. Confirm it by fetching the path
  on the live storefront. (This is separate from the manifest AgentCart serves for the business at
  `/api/ai/<slug>/ucp`, which does exist.)

## 10a. Run the launch gate

The launch gate is the authoritative answer to whether AgentCart is ready to launch. It is eighteen
checks, each recorded with evidence and a timestamp, and `readyForLaunch` is true only when every one
of them has a recorded pass against real infrastructure.

```
GET  /api/launch             the gate's current state
GET  /api/launch/checklist   the checklist, including what only you can do
POST /api/launch/run         run the gate (rate limited)
```

All of it is on the **Launch** tab of `/dashboard`.

Each check declares `whyNotMockable` — the real dependency it needs. That field exists to stop a
future change from satisfying a check with a fixture. A check that a mock can pass is not doing its
job, so make the infrastructure work rather than relaxing the check.

## 10b. New endpoints added in Phases 10-12

```
GET  /api/providers          per provider: can it discover you, fetch you, is it available to you
POST /api/providers/channel  record detected agentic-commerce channel capabilities
GET  /api/protocols          web / UCP / ACP support, and what is explicitly not supported
GET  /api/attribution        orders and revenue by evidence tier (never summed)
POST /api/journey            start a signed agent journey
POST /api/journey/verify     verify a returned journey id
GET  /api/health/connection  connection health and recent operations
GET  /api/outcome            the five-layer outcome view
GET  /api/launch*            the launch gate (see §10a)

Public, read-only, no session required:
POST /api/mcp                scan_site, get_agent_standards, get_public_ai_profile,
                             get_supported_protocols
GET  /agents.md              the same surface for assistants that read instead of calling tools
GET  /.well-known/agents.md

Per connected business, on AgentCart's hosted AI layer:
GET  /api/ai/<slug>/ucp      the UCP manifest (discovery and read only)
GET  /api/ai/<slug>/agents.md
```

The UCP manifest is served by AgentCart for a business it hosts. It is **not** the same thing as the
merchant's own storefront publishing `/.well-known/ucp` — whether Shopify does that is unverified,
and AgentCart reports it as `unknown`.

The public MCP surface is rate limited and structurally cannot reach an authenticated path. It has no
`get_scan_result`, because the scan is synchronous and advertising a background job that does not
exist would leave an agent polling forever.

## 11. Before a public Shopify App Store submission

The technical handlers are present, but the business/account material still needs to be real and approved:

- production support email
- final business/privacy contact details
- final Privacy Policy and Terms reviewed for the business and jurisdictions served
- app icon, screenshots, listing copy and pricing
- Shopify App Store review answers
- protected customer-data review if future features request protected fields
- production monitoring / alert destination

AgentCart deliberately does **not** request customer email, phone, address or payment-card data for the current attribution product.

## Cost-control rule

The core scanner is deterministic and does not require a paid LLM. Keep the initial product inside Cloudflare/Shopify development free allowances where available. Do not add a paid AI/data dependency until real usage demonstrates a reason for it.
