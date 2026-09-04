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
DEMO_MODE = "true"
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
- `write_pixels`
- `read_customer_events`

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

GitHub Actions also runs these checks on pushes and pull requests once the workflow is enabled.

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
