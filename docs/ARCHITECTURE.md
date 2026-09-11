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

robots.txt ──► provider registry ──► /api/providers  (who can discover, fetch, act)
orders + journeys ──► evidence tiers ──► /api/attribution
launch_checks ──► launch gate ──► /api/launch, /api/launch/checklist
all five layers ──► /api/outcome  (kept separate, never merged)
AI assistants ──► /api/mcp, /agents.md  (public, read-only)
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
- `src/providers/` — provider registry, per-user-agent robots parsing, discovery-file checks.
- `src/attribution.ts` — signed journey ids, order-source classification, evidence tiers.
- `src/agentic/` — idempotency keys, channel capabilities, agent journeys.
- `src/protocol/` — web, UCP and ACP compatibility surfaces.
- `src/launch/` — launch checks, the gate, the runner, calibration, the checklist.
- `src/standards/`, `src/aeo/` — the Agent Standards diagnostic and the visibility framework.
- `src/public/tools.ts` — the public read-only MCP surface and `/agents.md`.
- `src/outcome.ts` — the five-layer outcome view.
- `src/ops.ts`, `src/ownership.ts` — operation records, connection health, publication ownership.
- `extensions/agentcart-pixel/` — Shopify Web Pixel.

## Scoring model

Five categories totalling 100: business understanding (20), catalogue (25), policies (15), access
(15), actions (25). Deterministic, with no LLM in the path.

**"Not applicable" is distinct from "failed."** A check that does not apply contributes no maximum,
suggests no fix, and appears in neither capability list. A service business is not penalised for
having no catalogue. Category scores normalise over applicable checks only.

Every scan records its `scoring_version`. Two scans on different versions are never subtracted from
one another — the UI says they are not comparable instead of manufacturing a change.

## Provider readiness

A registry of AI providers and their crawlers, each entry carrying the date its claims were verified
and a link to the primary source (`docs/PROVIDER_RESEARCH.md`). Readiness is reported per provider
in five states — `pass`, `fail`, `unsupported`, `unknown`, `not_available_in_region` — because
collapsing them to pass/fail forces a lie in three of the five cases.

Three rules keep the report honest:

- **Only discovery and agentic fetch are scored.** Blocking an AI *training* crawler is a legitimate
  business decision and never reduces the score.
- **A Disallow is not proof of a block.** Where a provider documents that its agent may fetch a page
  at a user's request regardless of `robots.txt`, the setting is reported as the merchant's stated
  preference with state `unknown`, not as a successful block.
- **Regional unavailability is not a merchant failure.** A shopping agent that has not launched in
  the merchant's country reports `not_available_in_region`, which is never counted against them.

## Attribution model

Referral source is observed by the Web Pixel and the initial referrer carried through the browser
session. Server-side, an AgentCart-issued signed journey id lets an order be joined back to the
agent that produced it even when the pixel never runs.

Order-source classification matches agentic markers only. `facebook` and `google` are ordinary sales
channels, not AI, and are not treated as agentic traffic.

No analytics product can reconstruct every AI-assisted purchase — some surfaces suppress the
referrer, users switch devices, and a recommendation can lead to a later direct visit. Revenue is
therefore reported in evidence tiers that are **counted separately and never summed**:

| Tier | What backs it |
| --- | --- |
| `verified` | A cryptographically verified platform order record. |
| `identifiable_referral` | Direct technical evidence of an AI referrer. |
| `reported` | The storefront pixel, which a browser can be made to forge. |
| `assisted` | A stated model. No model is implemented, so nothing lands here today. |
| `unknown` | Never falsely attributed. |

Adding a verified figure to a reported one would produce a number with no defensible meaning, so the
dashboard shows the rows and no total.

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

## Protocols

The protocol layer publishes **discovery and read access only**: a web surface, a UCP manifest that
AgentCart serves for a connected business at `/api/ai/<slug>/ucp`, and ACP-shaped descriptions. The manifest deliberately omits the checkout
capability and `payment_handlers`, because AgentCart does not take payment, hold an order, or act as
merchant of record. A test asserts those keys stay absent — an omission is easy to "fix" by
accident, and claiming a checkout capability that does not exist would strand an agent mid-purchase.

Whether a Shopify storefront itself publishes `/.well-known/ucp` is a separate question and is
**unverified**, so it is reported as `unknown` rather than assumed in either direction.

## Launch gate

The single authoritative answer to "is this ready to launch?". Eighteen checks, each carrying a
`whyNotMockable` field naming the real dependency it needs, and each recorded with evidence and a
timestamp when it runs. `readyForLaunch` is true only when every check has a recorded pass against
real infrastructure.

The rule is enforced in code, not documentation: **a green test suite and green CI never make
AgentCart launch ready.** The suite runs against a `node:sqlite` shim, which exercises SQLite
semantics rather than workerd, and no number of passing mocks can establish that a Worker talks to
D1 or that Shopify accepts a webhook. Evidence recorded by the gate is redacted before storage.

Classification is calibrated against six benchmark cases with zero false positives and zero false
negatives, so a change to the scorer that starts flattering merchants fails the suite.

## Answer-engine visibility

A framework with **no live provider behind it**. Every adapter reports `available: () => false`, and
the report carries an explicit caveat. Vanity queries — a merchant searching for their own brand
name — are detected and marked, because they measure nothing about discovery.

This is deliberate. Returning a share-of-voice number sourced from nothing would be worse than
returning none.

## AgentCart as an agent-callable capability

`/api/mcp` exposes `scan_site`, `get_agent_standards`, `get_public_ai_profile` and
`get_supported_protocols` — public, read-only, rate limited, and structurally unable to reach an
authenticated path. `/agents.md` and `/.well-known/agents.md` serve the same surface to assistants
that read instructions rather than call tools.

There is no `get_scan_result`: the scan is synchronous, and advertising an async job that does not
exist would leave an agent polling forever. A test keeps that tool name absent.

## Outcome view

Five layers — readiness, standards, visibility, customers, health — measured separately and
presented together without being merged. A readiness score and a revenue figure are different kinds
of claim, and averaging them would let a strong score in one hide a failure in another.

The north star is **AI customers and verified AI-attributed revenue**, not the score. The score is
diagnostic.

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

## Merchant writes

Every write to a merchant's store passes three gates: the fix must be registered, the scope must be
granted, and anything a customer can read must be approved. Writes are recorded with enough detail
to be undone, and `undoFix` reverses them. Publication of a public AI profile requires verified
ownership of the domain — there is no fuzzy matching, because a near-match is how one merchant ends
up publishing another's catalogue.

## Not built

Assisted-conversion modelling, merchant benchmarks, WooCommerce and WordPress write integrations,
billing, and autonomous purchasing. Platform adapters are structured so the first two commerce
integrations can follow without reworking the scanner or fix engine.
