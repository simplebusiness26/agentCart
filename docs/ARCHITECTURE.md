# AgentCart architecture

## Product promise

A business owner gives AgentCart a website and quickly learns whether AI customers can understand
and use the business. If they connect Shopify, AgentCart improves what it safely can, asks approval
for anything customers read, provides a clean AI-facing layer for the rest, then proves the
improvement with a new score.

## Runtime

```
Business website ──► Agent Ready scanner ──► scan_runs / scan_findings ──► report page
                          (bounded crawl)

Shopify Admin API ──► platform adapter ──► catalog_items / business_profiles
                                                │
                                                ├──► fix engine ──► Shopify mutations ──► verify
                                                └──► hosted AI layer ──► /ai/:slug, /api/ai/:slug/*
                                                                          + read-only MCP

Storefront ──► Web Pixel ──► /api/events ──► events ──► /api/dashboard
Shopify webhooks ──► /api/shopify/webhooks ──► orders, compliance, uninstall
Cron ──► scheduled() ──► monitor pass ──► scan_runs (trigger='monitor')
```

## Modules

- `src/index.ts` — routing, OAuth, ingestion, webhooks, cron entrypoint.
- `src/agentready/` — crawler, signal extraction, platform detection, scoring, persistence.
- `src/report.ts` — the plain-English Agent Ready report.
- `src/platform/` — platform-neutral adapter contract; Shopify GraphQL implementation; catalogue cache.
- `src/fixes/` — fix registry and lifecycle engine.
- `src/ailayer/` — public AI profile service and MCP adapter.
- `src/monitor.ts` — scheduled rescans and history.
- `src/shopify.ts` — OAuth, HMAC, token encryption, sessions.
- `src/db.ts` — D1 persistence for stores, events, compliance, rate limiting.
- `src/ui.ts` — server-rendered pages.
- `extensions/agentcart-pixel/` — Shopify Web Pixel.

## Scoring model

Five categories totalling 100: business understanding (20), catalogue (25), policies (15), access
(15), actions (25). Deterministic, with no LLM in the path.

**"Not applicable" is distinct from "failed."** A check that does not apply contributes no maximum,
suggests no fix, and appears in neither capability list. A service business is not penalised for
having no catalogue. Category scores normalise over applicable checks only.

Every scan records its `scoring_version`. Two scans on different versions are never subtracted from
one another — the UI says they are not comparable instead of manufacturing a change.

## Attribution model

Referral source is observed by the Web Pixel and the initial referrer carried through the browser
session. Recognised sources: ChatGPT, Claude, Perplexity, Gemini, Microsoft Copilot, Meta AI.
Anything else is `Other referral` or `Direct / unknown`.

No analytics product can reconstruct every AI-assisted purchase — some surfaces suppress the
referrer, users switch devices, and a recommendation can lead to a later direct visit. AgentCart
therefore distinguishes:

1. **Identifiable AI referral** — direct technical evidence.
2. **Assisted / modelled attribution** — not implemented; would need a stated methodology.
3. **Unknown / direct** — never falsely attributed.

## What each ingestion control actually guarantees

Stated plainly, because it is easy to imply more than is true:

| Layer | Guarantee | Non-guarantee |
| --- | --- | --- |
| HMAC-verified `orders/paid` webhook | Revenue and order counts cannot be forged without `SHOPIFY_API_SECRET`. The only hard guarantee. | Dormant until `read_orders` is granted. Gross revenue only; refunds are not deducted. |
| Per-shop ingest token | None cryptographically. The pixel runs in the browser, so the token is extractable by anyone who loads the storefront. | Raises attacker effort from "know a `.myshopify.com` domain" to "visit the store once". Kills drive-by spraying; nothing more. |
| `Origin` header | None against non-browser clients, which can set any value. | Recorded but **not enforced**. The pixel runs sandboxed and its real `Origin` cannot be confirmed without a live store; enforcing a guess would silently zero every dashboard. |
| Per-shop rate limit | Caps pollution magnitude and D1 write spend. | Does not prevent forgery. |
| `access-control-allow-origin: *` | Nothing. CORS is a browser policy, not an authorization control. | Required for the pixel to post at all. |

The dashboard therefore labels revenue **Reported** until verified order records exist, and
**Verified** once they do.

## Fix engine

Fixes are registry entries declaring their finding, platform, required scopes, risk, approval rule,
and their own preview, apply and verify functions. Routes contain no platform mutations.

Two rules are load-bearing:

- **A successful mutation is not verification.** `verify()` independently re-reads the platform. A
  fix reaches `verified` only if the change is observable there; otherwise it is `failed` with a
  reason, and it does not count as an improvement.
- **Merchant content is never changed without approval.** Anything a customer reads is
  `approval_required`, enforced in the engine rather than the UI. Existing merchant copy is never
  overwritten — fixes only fill genuinely empty fields.

Price, inventory, variants, checkout configuration and legal policy text are out of scope and must
not be added without their own feature and explicit approval.

## Hosted AI layer

`/ai/:slug` (human) and `/api/ai/:slug/*` (JSON) expose a business profile, catalogue, item detail,
search, policies and supported actions. A read-only MCP surface exposes the same data through
`get_business`, `search_catalog`, `get_item`, `get_policies` and `get_supported_actions`.

Both are thin wrappers over one service module, so there is no second source of truth. Only fields
that module emits are ever public: access tokens, ingest tokens, sessions, analytics and anything
customer-derived are absent by construction, and a test asserts it against a seeded database. The
public slug is not the myshopify domain.

The action model describes and links. `add_to_cart` and `purchase` are reported unsupported with a
reason, because AgentCart does not transact for customers.

## Security

- OAuth state is short-lived and single-use; expired states are swept on each install attempt.
- OAuth and webhook HMAC are verified before any work is done, and the shop domain is validated
  before any deletion.
- Access tokens are AES-GCM encrypted at rest and never leave the platform layer.
- Sessions carry a signed issued-at, require a live store record, and are invalidated by reinstall —
  three independent revocation paths.
- All three Shopify compliance webhooks are genuinely handled, not merely acknowledged.
- The scanner refuses IP literals, loopback, private and internal hostnames, and non-standard ports
  before making any request, and is rate limited per client IP.
- Crawled website content is untrusted data. It is escaped at every interpolation and never treated
  as an instruction. Regex quantifiers in extraction are bounded, because unbounded ones were a
  denial-of-service vector on attacker-chosen pages.
- No card data. No customer email, phone or address is requested or stored.

## Privacy

The Web Pixel is configured for analytics consent; Shopify controls when it executes. AgentCart
stores only what source, funnel and revenue measurement need. Compliance webhooks delete store and
customer data on request; `customers/data_request` is recorded with a matched-row count for merchant
fulfilment, documented in `docs/USER_ACTIONS.md`.

## Cost model

Deterministic scanning with no required LLM. Monitoring processes a bounded batch per firing.
Cost centres are Cloudflare usage and, later, any billing/email/monitoring services.

## Not built

Assisted-conversion modelling, merchant benchmarks, WooCommerce and WordPress write integrations,
billing, and autonomous purchasing. Platform adapters are structured so the first two commerce
integrations can follow without reworking the scanner or fix engine.
