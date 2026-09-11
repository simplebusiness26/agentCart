# AgentCart Complete Vision Build Plan

## Purpose

Build the complete software foundation for AgentCart before connecting production accounts, enabling billing, or making launch claims.

The final customer promise is:

> **Make your business ready for AI customers.**

The intended journey is:

1. A visitor enters a public website URL. No account or platform questions come first.
2. AgentCart scans the public site and returns a deterministic Agent Ready score and plain-English report.
3. A ready business is told what is already working and can leave.
4. A business needing help clicks **Fix My Site**.
5. The owner creates an account and authorises Shopify, WordPress, WooCommerce, or a later platform without giving AgentCart their password.
6. AgentCart imports the authorised business facts, shows exactly what it intends to change, and installs an AgentCart Site Layer.
7. Safe technical fixes are applied automatically. Customer-facing wording requires explicit approval.
8. AgentCart independently verifies every change, rescans the public site, and shows the real before/after score.
9. AgentCart publishes an AI-facing compatibility layer for information or actions that should not be implemented directly on the original website.
10. AgentCart monitors readiness, detects regressions, tests visibility across supported AI surfaces, and eventually links AI journeys to enquiries, bookings, orders, and verified revenue.

This plan extends the existing scanner, platform adapter, fix engine, hosted AI layer, MCP surface, monitoring, attribution, provider registry, standards diagnostics, and launch gate. **Do not rebuild working modules.**

---

## Non-negotiable product rules

1. **URL first.** A public scan must work without registration.
2. **Plain English first.** Technical evidence is available, but never the main customer experience.
3. **No invented capability.** Unknown, unsupported, unavailable in region, failed, and not applicable remain distinct.
4. **No arbitrary AI score.** Agent Ready scoring remains deterministic, versioned, and explainable.
5. **Readiness and visibility remain separate.** Technical readiness is not proof that ChatGPT or another assistant recommends the business.
6. **No false ranking promise.** AgentCart may say visibility improved only across named, dated, repeatable tracked tests.
7. **No passwords.** Use platform apps, plugins, OAuth, signed installation handshakes, scoped tokens, and explicit consent.
8. **Least privilege.** Request only the permissions needed for enabled fixes.
9. **Automatic does not mean uncontrolled.** Technical, additive, reversible fixes may be automatic. Merchant-visible copy requires approval.
10. **A successful API call is not verification.** Re-read the platform and rescan the public result.
11. **Everything must be reversible.** Store before-state, after-state, provenance, actor, scope, and rollback instructions.
12. **Core data is platform independent.** Shopify, WordPress, WooCommerce, MCP, WebMCP, UCP, ACP, and later standards are adapters.
13. **Build-first is not live-proof.** Mocked adapters and green tests can make code complete; only real infrastructure can make it launch ready.
14. **No autonomous purchasing in this plan.** Expose safe discovery and actions, then hand off to merchant-owned booking or checkout.
15. **No paid dependency is required for the core scanner.** Optional visibility providers and billing remain disabled behind interfaces until chosen.
16. **No spam automation.** Public lead scanning may reuse the scanner later, but outreach is out of scope.

---

## Product state model

The application must enforce these states in code and UI:

| State | AgentCart may do | AgentCart must not claim |
| --- | --- | --- |
| Unconnected | Scan, score, explain, recommend, generate developer instructions | That it changed the website |
| Connected | Read authorised data, preview fixes, apply allowed fixes, publish the Site Layer, rescan, monitor | Capabilities not independently verified |
| Fully integrated | Maintain canonical business information and expose verified safe actions | That AgentCart owns payment, booking, or orders unless a later integration genuinely does |

A connection has independent capability flags, not one broad connected boolean:

- read business
- read catalogue
- write technical metadata
- write merchant-visible content
- publish Site Layer
- read policies
- read availability
- create enquiry
- create quote request
- create booking
- create basket or checkout handoff
- read orders
- read verified revenue

---

# Phase 0 — Stabilise the current fresh branch

## Goal

Correct the issues found during the September 2026 review before extending the product.

## Work

1. Make the production launch gate completable:
   - Add an authenticated API and dashboard flow for recording manual checks.
   - Require evidence, verifier identity, environment, application version, and timestamp.
   - Permit a manual pass only for checks declared manual.
   - Add completion hooks for the real fix lifecycle and before/after rescan checks.
   - Preserve history; never overwrite old evidence.
   - Re-running automated checks must not silently erase a valid manual result unless the underlying version or environment changed.

2. Fix the public standards tool:
   - Remove the accidental empty-list operation from `get_agent_standards`.
   - Return actual standards definitions, groups, applicability, state meanings, and fix paths.
   - Pin the response contract with tests.

3. Fix public scan standards assessment:
   - Stop passing an always-empty home-page value into safety, payment, and interaction checks.
   - Carry a safe extracted evidence representation from the crawl layer.
   - Do not persist or return unnecessary raw HTML.
   - Add rich, sparse, malformed, and hostile fixture tests.

4. Make the tests hermetic:
   - Stub the outbound request made by the public-tool mutation-safety test.
   - Fail tests that unexpectedly access the public internet.
   - Keep separate opt-in live tests for later connection work.

5. Run clean installation, typecheck, all tests, and CI.

## Definition of done

- All current tests pass without public network access.
- The public standards result is non-empty.
- Public scan standards are based on actual extracted evidence.
- A test proves the launch gate can reach green only with valid evidence for all checks.
- PR 3 can be reviewed and merged without the four known defects.

---

# Phase 1 — Canonical Business Graph

## Goal

Create one reliable source of truth that every platform and AI-facing adapter uses.

## Entities

- Business
- Brand
- Location
- ServiceArea
- ContactMethod
- OpeningHours
- Product
- ProductVariant
- Service
- Offer and Price
- Availability
- Policy
- ActionDefinition
- BookingResource
- Cart or CheckoutHandoff
- Connection
- PermissionGrant
- EvidenceRecord
- FixPlan
- FixExecution
- VerificationResult
- VisibilityQuery
- VisibilityObservation
- AgentJourney
- AttributionObservation

## Field-level requirements

Every meaningful value carries:

- canonical value
- source platform
- source record identifier
- public source URL when available
- retrieved time
- confidence
- verification state
- merchant-confirmed flag
- last changed time
- ownership: platform, AgentCart, or merchant
- publication permissions
- locale and currency where relevant

## Conflict rules

- Merchant-confirmed facts outrank inferred facts.
- Platform-authoritative values outrank scraped values.
- Price, inventory, opening hours, availability, legal policies, and action endpoints must never be guessed.
- An AgentCart-generated description may not overwrite merchant-authored text.
- Conflicts become review tasks, not silent overwrites.

## Architecture

Introduce narrow contracts:

- `PlatformAdapter`
- `SiteLayerAdapter`
- `ActionAdapter`
- `VisibilityProvider`
- `ProtocolAdapter`
- `BillingProvider` as a disabled boundary only
- `NotificationProvider` as a disabled boundary only

Each platform declares supported capabilities and required scopes. The core never switches on platform names to perform business logic.

## Storage

Add versioned migrations for:

- canonical records and provenance
- connection capability grants
- desired versus observed Site Layer state
- change sets and rollback data
- verification evidence
- visibility test definitions and observations
- monitor jobs and alerts
- immutable audit events

## Tests

- Adapter contract suite usable by every platform.
- Provenance and conflict tests.
- Currency, locale, multi-location, variant, service-only, and mixed-business tests.
- Migration-forward tests from every existing schema version.
- No platform secret can appear in a public serialization.

---

# Phase 2 — Site Layer compiler and safe change engine

## Goal

Turn scan findings and canonical business facts into an explicit, reviewable, reversible installation plan.

## Build

1. **Desired-state compiler**
   - Inputs: scan findings, business graph, platform capabilities, merchant choices.
   - Output: ordered change set with expected score recovery, risk, scope, evidence, dependencies, and verification method.
   - Same input produces the same plan.
   - Never create a change without a corresponding finding or merchant request.

2. **Artifact generators**
   - Business and organisation structured data.
   - Local business, location, hours, service area, contact methods.
   - Product, offer, price, availability, variant, and policy references.
   - Service and provider information.
   - Action descriptions and safe handoff URLs.
   - Discovery files and links where the platform supports them.
   - AgentCart hosted-profile link and machine-readable alternate links.
   - Sitemap and indexability recommendations.
   - Human-readable fallback for essential facts hidden behind scripts.

3. **Risk policy**
   - Automatic: additive technical metadata, AgentCart namespace records, hosted-profile publication, safe discovery references.
   - Approval required: public wording, titles, descriptions, visible blocks, links shown to customers.
   - Manual only: price changes, stock changes, legal policy changes, checkout configuration, domain/DNS changes, destructive replacement.
   - Unsupported: anything the adapter cannot safely and independently verify.

4. **Lifecycle**
   - Detect existing implementation.
   - Prevent duplicate structured data.
   - Preview exact before and after.
   - Apply idempotently.
   - Verify by reading both the platform and public page.
   - Rescan with the same scoring version.
   - Offer rollback.
   - Record partial failure without claiming success.

5. **Developer handoff**
   - Every unfixed issue generates a copyable, platform-aware coding-agent brief.
   - Also provide short manual instructions.
   - Never label a handoff as applied.

## Tests

- Idempotency and repeat-apply tests.
- Duplicate schema and plugin-conflict tests.
- Rollback after partial failure.
- Existing merchant content is preserved.
- Fabricated business facts are rejected.
- Public verification must fail when an API mutation succeeds but the page does not change.

---

# Phase 3 — Shopify direct Site Layer

## Goal

Make Shopify the first complete **Fix My Site** integration.

## Installation design

Use Shopify OAuth and scoped permissions. Do not request merchant passwords.

Build:

- Theme app extension with an app embed for non-visible metadata and optional merchant-visible blocks.
- App proxy for business-owned storefront paths that serve AgentCart profile, catalogue, discovery, and supported-action information through the shop domain.
- Metafield and metaobject definitions in the AgentCart namespace.
- GraphQL Admin API adapter for canonical sync and supported writes.
- Webhooks for product, inventory, shop, publication, uninstall, privacy, and relevant configuration changes.
- Current Web Pixel remains an attribution component and is not treated as the readiness installer.

Shopify theme extensions are preferred because they avoid editing merchant Liquid files directly. The extension must detect unsupported or legacy themes and give precise fallback instructions.

## Shopify safe fixes

- Publish the AgentCart app embed.
- Inject deduplicated structured data generated from authoritative Shopify records.
- Add AgentCart-owned metadata and discovery links.
- Publish the proxied AI profile and catalogue.
- Improve genuinely empty search descriptions with approval.
- Add optional visible business/action block with approval.
- Maintain canonical product, variant, price, availability, policy, and storefront URL data.
- Describe cart/checkout handoff only when tested; do not own the transaction.

## Shopify protections

- Scope-by-feature permission screen.
- No theme-file writes for the primary path.
- Do not overwrite theme or SEO-app structured data.
- Detect common duplicate-schema sources.
- Uninstall revokes sessions, stops publishing, and marks AgentCart-owned data for documented cleanup.
- App proxy requests must be authenticated according to Shopify's signed request rules.
- All writes include an operation key for idempotency.

## Build-first deliverables

- Extension source and configuration.
- Mock Shopify server and recorded fixtures.
- Contract tests for install, reinstall, permissions, sync, apply, verify, rollback, and uninstall.
- Development-store runbook.
- Package/build validation in CI.

## Live verification later

Remain `not_run` until a real Shopify development store proves OAuth, app embed activation, app proxy, Web Pixel origin, product sync, mutation persistence, public rendering, checkout handoff, webhooks, cron, and uninstall.

---

# Phase 4 — WordPress AgentCart plugin

## Goal

Provide a first-class WordPress installation that can fix service and local-business sites, not just shops.

## Plugin responsibilities

- A WordPress admin setup wizard.
- One-time pairing flow initiated by an authorised administrator.
- Short-lived pairing code exchanged for revocable scoped credentials.
- Signed AgentCart-to-plugin requests and signed plugin-to-AgentCart webhooks.
- No WordPress password collection or storage.
- Capability checks and WordPress nonces for local actions.
- Settings screen showing connection, enabled fixes, last sync, last verification, and disconnect.
- REST endpoints in an AgentCart namespace.
- Scheduled health heartbeat and change notifications.
- Proper activation, deactivation, uninstall, privacy export, and erasure behaviour.

## WordPress Site Layer

- Publish canonical business, location, service, price, hours, policy, and action data.
- Inject deduplicated JSON-LD using normal WordPress hooks.
- Publish supported discovery resources through rewrite routes.
- Add hosted-profile discovery links.
- Add an optional visible contact/quote/booking information block with approval.
- Support common SEO plugins by detecting their output and extending rather than duplicating it.
- Work with classic themes and block themes.
- Preserve caches and trigger safe cache invalidation after a change.

## Content rules

- Technical additions may be automatic.
- Draft improvements to weak service text require approval.
- Never invent qualifications, coverage, prices, guarantees, reviews, opening hours, locations, or availability.
- Never rewrite legal pages automatically.

## Packaging and tests

- Build a reproducible installable plugin ZIP in CI.
- WordPress coding standards and static analysis.
- Automated tests against supported PHP and WordPress versions.
- Disposable WordPress test environment with hostile themes/plugins, caching, multisite awareness, and REST disabled cases.
- Pair, disconnect, rotate credential, uninstall, update, rollback, and permission tests.

---

# Phase 5 — WooCommerce adapter

## Goal

Extend the WordPress plugin with commerce capabilities while sharing the canonical graph and Site Layer.

## Build

- Detect WooCommerce and negotiate additional permissions.
- Sync products, variations, categories, prices, stock state, shipping summary, returns links, and checkout routes.
- Register WooCommerce webhooks or plugin events for changes.
- Publish product and offer structured data without duplicating WooCommerce or SEO-plugin output.
- Describe search, product detail, add-to-cart, basket, and checkout handoff based on verified store behaviour.
- Never complete payment in AgentCart.
- Preserve tax, currency, sale-price, stock-management, and variation semantics.
- Support service-only WordPress sites when WooCommerce is absent.

## Tests

- Simple, variable, digital, subscription-like unsupported, out-of-stock, sale, tax-inclusive, tax-exclusive, multi-currency, and malformed product cases.
- Cart and checkout handoff verification without placing a real order.
- Plugin conflicts and duplicate structured data.
- Webhook replay, signature, ordering, and deletion handling.
- Store remains functional after AgentCart is disabled or removed.

---

# Phase 6 — Hosted AI compatibility layer

## Goal

Make every connected business understandable to agents even when the original platform cannot expose a feature cleanly.

## Build

- Stable public business URL.
- Human-readable profile.
- Versioned JSON profile.
- Catalogue and service search.
- Item and service detail.
- Locations, hours, policies, contacts, and service areas.
- Supported actions with verified handoff URLs.
- `agents.md`, `llms.txt`, and supported well-known resources.
- Read-only MCP adapter.
- Protocol adapter registry for Web, MCP, WebMCP, UCP, ACP, A2A, and future standards.
- Standards are optional adapters; the canonical graph remains independent.
- ETags, caching, pagination, locale/currency support, and tombstones for removed records.
- Merchant switch to pause or unpublish immediately.

## Discovery bridge

The platform Site Layer must publish a verifiable relationship between the merchant website and its AgentCart profile where the platform permits it. AgentCart must test that the link is publicly visible. A hosted profile without a discoverable relationship is reported as hosted but not proven discoverable.

## Action boundary

- Read/search/get actions can be public.
- Enquiry, quote, booking, basket, and checkout handoff require per-action security designs.
- Every action declares whether it is descriptive, linked, requested, reserved, or completed.
- Unsupported actions return a reason; they never pretend to work.

---

# Phase 7 — Optimization engine

## Goal

Move from “we added technical files” to “we improved the business's chance of being understood and recommended.”

## Optimization areas

- Business identity consistency.
- Clear product and service naming.
- Complete descriptions grounded in merchant facts.
- Price and availability clarity.
- Location and service-area clarity.
- Opening hours and contact clarity.
- Policy discoverability.
- Category and internal-link structure.
- Crawl and index access for discovery agents.
- Machine-readable relationships between business, offer, location, policy, and action.
- Clear evidence for differentiators the merchant has confirmed.
- Action completion and fallback quality.
- Duplicate, contradictory, stale, or hidden information.
- Provider-specific blockers kept in a dated registry.

## Recommendation engine

Each recommendation includes:

- what is wrong
- why it matters
- evidence
- expected readiness gain
- confidence
- affected pages/items
- whether AgentCart can apply it
- approval requirement
- verification method
- rollback method
- visibility hypotheses it may influence

Use deterministic rules first. Any later generative model produces a draft from canonical facts and must pass factual-grounding checks before merchant approval.

## Competitor context

Allow a merchant to name competitors or discover comparable public sites. Compare public facts and capabilities, not private data. Do not copy competitor text. Do not turn competitor performance directly into Agent Ready points.

---

# Phase 8 — AI Visibility Lab

## Goal

Provide defensible before/after evidence of whether supported AI systems mention, cite, recommend, or correctly describe the business.

## Measurement model

Keep these separate from the Agent Ready score:

- mention rate
- citation/link rate
- recommendation rate
- top-three mention rate
- factual accuracy
- action availability
- competitor share of tested answers
- unknown/no-answer rate

A result must record:

- provider and surface
- model/product identifier when available
- exact query
- query category and intent
- branded or non-branded
- country/region and language
- execution time
- repetition number
- response evidence
- cited URLs
- business mention position
- competitors mentioned
- evaluator version
- provider limitations

## Query set

Generate a merchant-reviewable test set covering:

- discovery
- product or service comparison
- price
- location
- availability
- trust and policy
- enquiry/quote
- booking
- basket/checkout handoff

Branded questions are shown but excluded from the primary non-branded visibility measure. The query set is versioned so a before/after comparison cannot silently change the questions.

## Provider adapter design

- Manual evidence adapter: free starting path for recording controlled tests.
- Official API adapters when an owner later supplies credentials and accepts cost.
- Specialist visibility-data adapter later.
- No automated scraping of authenticated consumer interfaces when it breaches terms.
- Unsupported providers show no score.

## Honest claims

Allowed:

> “Across 25 tracked UK customer questions, this business was mentioned in 11 after the changes, compared with 4 before.”

Not allowed:

> “AgentCart guarantees number-one ranking in ChatGPT.”

Use “after AgentCart changes” unless a valid experimental design proves causation. Store enough evidence to audit every displayed percentage.

## Tests

- Repeated-answer variability.
- No-citation and multiple-business answers.
- Name collision and false-positive matching.
- Regional and language separation.
- Query-version comparison rules.
- Provider outage versus zero visibility.
- Unsupported adapter returns no fabricated measurement.
- Evidence redaction and retention controls.

---

# Phase 9 — Verified agent journeys and outcomes

## Goal

Prove what an agent can actually accomplish, not only what the page advertises.

## Journey types

- find business
- find product
- find service
- obtain price
- check stated availability
- contact business
- request quote
- reach booking provider
- reach product cart
- reach merchant checkout
- complete a test-mode booking/order later when explicitly configured

## Safety and honesty

- Journey runner stops before real payment by default.
- Do not create bookings, enquiries, baskets, or orders without explicit test configuration and idempotency.
- Record reached step, failed step, evidence, duration, and reason.
- A discovered button is not a completed action.
- Separate merchant-site results from AgentCart-hosted-layer results.

## Outcome layers

Keep five independent views:

1. Business Readiness
2. Agent Standards
3. AI Visibility
4. Verified Agent Journeys
5. AI Customers and Revenue

Never compress all five into one misleading number.

---

# Phase 10 — Complete “Fix My Site” product journey

## Goal

Make the entire experience understandable and usable on a phone.

## Screens

1. URL-first landing page.
2. Scan progress with honest bounded steps.
3. Simple report:
   - Agent Ready score
   - what AI understands
   - what AI cannot understand
   - what AI can do
   - what AI cannot do
   - biggest recoverable improvements
4. **Fix My Site** explanation and supported-platform detection.
5. Account creation boundary.
6. Platform authorisation.
7. Imported-facts review.
8. Fix plan with:
   - automatic
   - approval required
   - manual/developer
   - unavailable
9. Installation progress.
10. Verification and rescan.
11. Before/after report.
12. Monitoring dashboard.
13. Visibility Lab.
14. Connections and permissions.
15. Audit history and rollback.
16. Launch/readiness checklist.

## UX rules

- Mobile-first at 320px and above.
- One main action per screen.
- Short sentences and plain labels.
- No technical acronym without an explanation.
- Progress survives refresh.
- Failures say what happened, what was preserved, and what to do next.
- Accessible touch targets, contrast, focus order, error summary, and screen-reader labels.
- Never show “fixed” until verified.
- Demo mode must demonstrate the whole journey without external accounts and clearly label simulated evidence.

## Payment boundary

Build entitlement and plan interfaces, but keep billing disabled:

- free scan entitlement
- connection/fix entitlement
- monitoring entitlement
- visibility testing allowance
- billing-customer and subscription placeholders
- webhook/event interface
- no chosen payment provider
- no checkout button that cannot work

Payment is a later business decision and must not block product validation.

---

# Phase 11 — Monitoring, drift, alerts, and lead-ready scanning

## Monitoring

- Scheduled bounded rescans.
- Connection health.
- Site Layer desired-versus-observed drift.
- Product/service change sync.
- Score changes only within the same scoring version.
- Broken actions and dead links.
- Structured-data disappearance or duplication.
- Crawler access changes.
- Provider registry staleness.
- Visibility changes with sample-size context.
- Verification expiry for facts such as hours and availability.
- Retry policy, dead-letter state, and failure isolation.

## Alerts

Build an internal alert/outbox model now. Email/SMS providers remain adapters until connected. The dashboard must always show alerts even with no external notification provider.

## Lead-generation preparation

Allow scans to carry a source and campaign identifier so the same public scanner can later support prospect research. Do not build bulk crawling, contact harvesting, or outreach automation in this phase.

---

# Phase 12 — Security, privacy, and operational hardening

## Website scanning

- Validate URLs before DNS resolution and after every redirect.
- Block loopback, private, link-local, reserved, metadata, non-standard-port, and rebinding targets.
- Resolve and pin permitted addresses appropriately for the runtime.
- Same-origin crawl by default.
- Strict page count, byte, time, redirect, concurrency, and decompression limits.
- Accepted content types only.
- No arbitrary server-side JavaScript execution.
- Treat webpage text as untrusted evidence, never instructions.
- Bounded parsers and regexes.
- Per-IP and per-business rate limits.
- Public MCP scan limit must account for pages fetched, not only RPC calls.

## Platform security

- HMAC/signature verification before processing.
- Single-use OAuth/pairing state.
- Encrypted scoped tokens at rest.
- Token rotation and revocation.
- Explicit connection capability grants.
- Replay-resistant webhooks and operation idempotency.
- Audit all merchant writes.
- Never log tokens, secrets, raw authorization headers, or unnecessary customer data.
- Disconnect/uninstall revokes access immediately.

## Content safety

- Merchant-visible generated content is always a draft.
- Reject unsupported claims.
- No hidden text, keyword stuffing, cloaking, fake reviews, fake prices, fake stock, or doorway pages.
- The human page and machine-readable layer must not contradict each other.

## Privacy

- Data inventory and retention schedule.
- Merchant export and deletion.
- Platform compliance webhooks.
- Separate public business data from private operational data.
- No customer email, phone, address, or payment data unless a future capability explicitly requires it and is approved.
- Revenue stays “reported” until verified server-side evidence exists.

## Operations

- Structured logs with redaction.
- Health and readiness endpoints.
- Connection-operation history.
- Durable job state and safe retries.
- Versioned migrations and rollback documentation.
- Cost caps and scan quotas.
- Provider registry review reminders.

---

# Phase 13 — Complete build-first test programme

## Unit and property tests

- URL normalization and SSRF.
- Crawling and hostile content.
- Extraction and evidence confidence.
- Scoring determinism and applicability.
- Canonical graph validation and conflict rules.
- Site Layer compilation.
- Fix risk classification, approval, idempotency, verification, and rollback.
- Visibility calculations and honest unknown states.
- Attribution evidence tiers.
- Secret redaction.

## Adapter contract suites

Every platform adapter must pass the same read, plan, apply, verify, rollback, revoke, and error-semantics contract.

## Integration environments

Build disposable automated environments for:

- generic static business site
- service business
- multi-location business
- catalogue without checkout
- Shopify mock
- WordPress
- WordPress plus WooCommerce
- JavaScript-heavy and partially inaccessible sites
- sites with existing SEO/schema plugins
- malformed and malicious sites

## End-to-end flows

- URL → report.
- Report → Fix My Site.
- Simulated authorisation → facts review.
- Fix preview → approval → apply → independent verification.
- Rescan → valid score comparison.
- Site Layer discovery.
- Hosted profile and MCP.
- Visibility baseline → fixes → later observation.
- Monitor detects removal and proposes restoration.
- Disconnect and rollback.

## Mobile and accessibility

Use automated browser tests at representative Android widths and desktop. Test slow connections, refresh during operations, large text, keyboard navigation, touch targets, contrast, and screen-reader naming.

## CI artifacts

- Worker build.
- WordPress plugin ZIP.
- Shopify extension validation package.
- migration check.
- test and coverage reports.
- software bill of materials.
- security scan.
- demo screenshots or trace artifacts where reliable.

## Live tests

Keep live test suites opt-in and clearly separated. They must skip with “not configured,” never pass through mocks.

---

# Phase 14 — Documentation and completion gates

Update the documentation so it separately describes:

- implemented and unit-tested
- packaged but not connected
- connected and verified on development infrastructure
- verified in production
- planned only

Required documents:

- product overview
- architecture
- scoring
- Site Layer design
- canonical data model
- Shopify setup
- WordPress/WooCommerce plugin setup
- security and threat model
- privacy/data inventory
- adapter authoring guide
- visibility methodology
- test instructions
- connection checklist
- rollback/uninstall guide
- owner actions
- roadmap
- limitations and prohibited claims

---

## Build-first completion definition

The infrastructure is **code complete before connection** only when:

- The current known defects are fixed.
- Scanner, reports, canonical graph, desired-state compiler, fix engine, Shopify Site Layer, WordPress plugin, WooCommerce adapter, hosted AI layer, optimization engine, Visibility Lab, journeys, monitoring, audit, and mobile customer journey are implemented.
- All adapters pass their contract tests.
- The Shopify extension and WordPress plugin produce installable CI artifacts.
- Demo mode completes the entire journey without external accounts and labels simulation clearly.
- Clean install, typecheck, automated tests, security tests, and end-to-end tests are green.
- Documentation separates simulated from live evidence.
- No dashboard or README says launch ready.
- Every real-infrastructure check remains `not_run` until later connection work.

This does **not** mean the product is live or proven.

---

## Later connection and proof sequence

When the code-first build is complete, connect in this order:

1. Cloudflare D1 and deployed Worker.
2. Shopify development app and store.
3. Run every Shopify installation, fix, rescan, monitoring, attribution, and launch-gate check.
4. Disposable public WordPress test site.
5. WooCommerce test store.
6. Run cross-platform contract and uninstall tests against real systems.
7. Connect one compliant visibility provider or run the controlled manual evidence workflow.
8. Pilot with three to five real businesses.
9. Calibrate false positives, fix success rates, visibility wording, and mobile usability.
10. Decide pricing and payment provider only after the product demonstrates value.

---

## Recommended implementation order

Execute the phases in order:

1. Phase 0 defects.
2. Canonical Business Graph.
3. Site Layer compiler.
4. Shopify complete flow.
5. WordPress plugin.
6. WooCommerce adapter.
7. Hosted discovery bridge.
8. Optimization engine.
9. Visibility Lab.
10. Verified journeys and outcomes.
11. Complete mobile Fix My Site journey.
12. Monitoring and alerts.
13. Security and full test programme.
14. Documentation and build-first completion review.

Do not begin a later platform by bypassing an unfinished core contract. Do not delete or weaken existing AgentCart features to make a new phase pass.

---

## Final handoff format

At the end of implementation, provide:

1. Existing functionality preserved.
2. Every file/module added or changed.
3. What works in automated tests.
4. What is only simulated.
5. What requires Shopify, WordPress, WooCommerce, Cloudflare, AI-provider, notification, or payment credentials.
6. Test commands and exact results.
7. Known limitations and security risks.
8. Installation artifacts and where to obtain them.
9. The ordered phone-friendly owner checklist.
10. Recommended first real pilot.

Never claim a platform connection, website change, AI recommendation improvement, enquiry, booking, order, or revenue result unless it was actually observed and recorded.
