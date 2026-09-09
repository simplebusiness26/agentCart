# AgentCart — Agent Ready MVP Master Build Plan

> **Implementation handover for Claude / coding agent**
>
> This is not a brainstorming document. Treat it as the implementation brief for the next AgentCart build. Inspect the repository first, preserve useful existing functionality, then implement the MVP end-to-end. Do not blindly rebuild the application.

## 1. Product direction

AgentCart is becoming:

**“Make your business ready for AI customers.”**

The first customer is a business owner. They should be able to enter their website, understand whether AI systems can understand and act on their business, connect a supported platform, let AgentCart safely fix what it can, and expose a clean AgentCart-hosted AI compatibility layer where changing the original site is unnecessary or undesirable.

The long-term product can also include AI-commerce attribution, agent referrals, commissions and revenue tracking. Those are valuable later, but they must not distract from shipping the Agent Ready MVP.

### MVP customer journey

1. Business owner enters `example.com`.
2. AgentCart scans the site.
3. AgentCart returns an **Agent Ready score out of 100**.
4. The report explains in plain English:
   - what AI can understand;
   - what AI cannot reliably understand;
   - what an AI can do;
   - what it cannot do;
   - what is blocking the business from being more AI-ready.
5. AgentCart detects the platform where possible: Shopify, WooCommerce, WordPress, or Other.
6. For Shopify, the owner can connect the store through proper Shopify OAuth. Never request or store merchant passwords.
7. Once connected, AgentCart imports authoritative store data and identifies fixes.
8. AgentCart separates fixes into:
   - **Safe automatic fixes**;
   - **Approval-required fixes** with a preview;
   - **Manual fixes** that AgentCart cannot safely perform.
9. The merchant applies/approves fixes.
10. AgentCart rescans and shows the before/after score.
11. AgentCart creates an **AI-facing hosted business layer** containing canonical business/catalog/policy/action information.
12. AgentCart continually rechecks connected businesses and records score history.
13. Existing AI-referral attribution remains available and must not be broken.

The minimum compelling demo is:

**Scan → score → plain-English problems → connect Shopify → fix what is safe → rescan → score rises → hosted AI layer active.**

---

## 2. Mandatory working rules

Before changing code:

1. Inspect the entire repository and current architecture.
2. Read at minimum:
   - `README.md`
   - `docs/ARCHITECTURE.md`
   - `docs/SETUP.md`
   - `docs/USER_ACTIONS.md`
   - `src/index.ts`
   - `src/scanner.ts`
   - `src/shopify.ts`
   - `src/db.ts`
   - `src/ui.ts`
   - `src/types.ts`
   - migrations
   - Shopify extensions
   - tests and CI.
3. Run the existing typecheck and tests before major changes.
4. Preserve working functionality unless there is a concrete reason to replace it.
5. Keep Cloudflare Worker + D1 as the MVP runtime unless the current code proves this is impossible.
6. Keep the core scanner deterministic and usable without a paid LLM.
7. Do not introduce a paid dependency that is required for the core MVP.
8. Do not hard-code secrets, API keys or access tokens.
9. Use migrations. Do not destroy existing D1 tables/data to get the new build working.
10. Keep the application mobile-friendly.
11. Do not claim a capability works until there is a test or a repeatable manual verification path for it.
12. At the end, update documentation so the repo describes what actually exists, not the old product direction.

---

## 3. Existing functionality that should be preserved

The current codebase already contains useful foundations:

- Public readiness scanner.
- Readiness score and findings.
- Shopify OAuth flow.
- Encrypted Shopify access token storage.
- Shopify Web Pixel extension.
- Consent-aware commerce events.
- AI referral classification for known sources.
- D1 persistence.
- Merchant dashboard.
- Demo dashboard data.
- Privacy/terms/setup pages.
- Tests for the scanner.
- GitHub Actions CI.

Do not replace these just for architectural cleanliness. Extend/refactor where necessary.

The current scanner primarily checks a single page for structured product data, metadata, descriptions, canonical URL, pricing, availability, image alt text, robots, llms.txt, sitemap and title. This becomes one input into the broader Agent Ready assessment; it is not the finished assessment.

The current Shopify scopes are focused on reading/tracking. The direct-fix system will require a deliberate scope review. Prefer least privilege and avoid unrestricted theme editing.

---

# 4. MVP scope

## 4.1 Multi-page Agent Ready scanner

Replace the idea of “score one HTML page” with a bounded site assessment while retaining reusable scoring helpers.

### Crawl rules

- Accept only public HTTP/HTTPS URLs.
- Normalize the domain.
- Stay same-origin unless explicitly handling a known canonical Shopify domain redirect.
- Prevent SSRF/private-network access.
- Set strict request timeouts.
- Cap response bytes.
- Cap pages per scan, initially around 8–12 pages.
- Avoid infinite redirects/crawl loops.
- Respect sensible crawler behavior.
- Never execute arbitrary site JavaScript inside the Worker.

### Important pages to discover

Attempt to identify representative pages such as:

- homepage;
- product/service page;
- collection/category page;
- contact page;
- about page;
- FAQ;
- shipping/delivery;
- returns/refunds;
- privacy/terms;
- booking/quote page where applicable.

Use links, sitemap hints, common path names and platform knowledge. Do not crawl an entire site.

### Platform detection

Return a confidence-rated platform result:

- Shopify;
- WooCommerce;
- WordPress;
- Other/unknown.

Signals can include headers, HTML markers, script/assets, meta generator values, URL patterns and known platform endpoints. Do not make a confident claim from one weak marker.

Persist detected platform + confidence with the scan.

---

## 4.2 Agent Ready capability model

The report must answer business questions, not only technical SEO questions.

Create a capability model along these lines:

### A. Understand the business

Can an AI reliably determine:

- business name;
- what the business does/sells;
- important locations/service area;
- contact methods;
- opening/availability information where relevant;
- trust/identity information.

### B. Understand products/services

Can an AI reliably determine:

- item/service name;
- description;
- price or pricing method;
- currency;
- availability/stock where applicable;
- variants/options;
- product/service identifiers;
- images and useful alt text;
- canonical URL.

### C. Understand policies

Can an AI find:

- shipping/delivery information;
- returns/refunds;
- terms;
- privacy;
- booking/cancellation policies where applicable.

### D. Access the site

Check:

- crawler accessibility;
- robots restrictions;
- sitemap;
- canonical URLs;
- structured data;
- important metadata;
- whether essential information is only visible after unsupported interaction;
- optional AI guidance such as `llms.txt`.

Do **not** give `llms.txt` an outsized score. Treat it as useful optional guidance, not a universal requirement.

### E. Take useful actions

Determine whether an AI/customer can clearly progress toward:

- product purchase;
- cart/checkout;
- booking;
- quote request;
- contact/enquiry;
- reservation/appointment;
- other clear conversion action.

The scanner does not need to submit real purchases or forms during a public scan. It needs to identify and describe supported actions and blockers.

---

## 4.3 Scoring

Create a documented deterministic scoring model.

Suggested initial categories:

- Business understanding: **20**
- Catalog/service understanding: **25**
- Policies/trust: **15**
- AI/crawler accessibility: **15**
- Actionability: **25**

Total: **100**

The exact weighting can be adjusted if tests show a better model, but it must:

- total 100;
- be deterministic;
- avoid rewarding irrelevant checks;
- distinguish “not applicable” from “failed”;
- produce category scores as well as the headline score;
- retain enough raw evidence to explain every deduction.

Grades should remain simple: Excellent / Good / Needs work / Poor, or a similarly clear scheme.

Store scoring version so future scoring changes do not make historical results impossible to interpret.

---

## 4.4 Plain-English report

The current findings are too technical to be the main product UI.

For every major finding show:

- status: pass / partial / fail;
- plain-English title;
- why it matters;
- evidence;
- what AgentCart can do about it;
- whether the fix is automatic, approval-required, manual or unavailable.

Example:

**Bad primary copy:**
`No Product/Offer JSON-LD detected.`

**Good primary copy:**
`AI customers may not reliably understand your products.`

Secondary detail can say:
`We could not find valid Product/Offer structured data on the product page.`

### Report sections

The main result page should include:

1. Agent Ready score.
2. Platform detected.
3. “What AI can understand”.
4. “What AI struggles with”.
5. “What AI can do”.
6. “What AI cannot currently do”.
7. Highest-impact fixes.
8. Estimated points recoverable from fixes.
9. CTA appropriate to platform:
   - Shopify: Connect Shopify / Fix my store.
   - WooCommerce/WordPress: Join/support coming soon or generate hosted AI layer if supported.
   - Other: Create hosted AI layer / manual recommendations.

---

# 5. Data model upgrade

Add a new non-destructive migration (for example `0002_agent_ready.sql`). Do not remove existing `shops`, `events` or legacy `scans` until migration/compatibility is deliberately handled.

The model should support at minimum:

### businesses

- id
- domain
- canonical_url
- platform
- platform_confidence
- connected_shop_domain nullable
- display_name nullable
- created_at
- updated_at

### scan_runs

- id
- business_id/domain
- score
- grade
- scoring_version
- platform
- category_scores_json
- capabilities_json
- started_at
- completed_at
- status/error

### scan_pages

- id
- scan_run_id
- url
- page_type
- http_status
- title
- evidence_json

### scan_findings

- id
- scan_run_id
- key
- category
- severity/status
- points/max_points
- plain_title
- technical_detail
- evidence_json
- recommended_fix
- fix_type
- estimated_score_gain

### fixes

- id
- business_id
- finding_key
- platform
- fix_type (`automatic`, `approval_required`, `manual`, `hosted_layer`)
- status
- proposed_change_json
- applied_change_json
- before_json
- after_json
- created_at
- approved_at
- applied_at

### ai_profiles

- business_id
- public_slug or stable public identifier
- version
- profile_json
- last_generated_at
- active

### monitor_runs / readiness_history

Could reuse scan_runs, but provide a clean way to distinguish scheduled monitoring from user-requested scans.

Keep the schema pragmatic. If fewer tables can provide the same clean behavior, that is acceptable, but preserve auditability of fixes and score history.

---

# 6. Shopify connector upgrade

Shopify is the only direct integration required to be complete for the first MVP.

## 6.1 Authorization

Continue proper Shopify OAuth.

Never request merchant passwords.

Use least privilege.

The existing application has `read_products`, Web Pixel and customer-event permissions. Upgrade scopes only when a concrete feature requires them.

Likely additions for the MVP include:

- `write_products` for explicit merchant-approved product content/SEO changes;
- potentially `read_content`/`write_content` only if page/policy content editing is actually implemented and required;
- `read_themes` only where needed to detect app-block/app-embed compatibility.

Avoid making `write_themes` a core requirement. Shopify restricts direct theme asset editing for public apps; prefer a **theme app extension/app embed** and merchant deep-link activation rather than editing theme source files.

If scope changes require merchant reauthorization, handle it cleanly and explain it in the UI.

## 6.2 Authoritative store import

After connection, retrieve enough Shopify data to build a reliable readiness picture and AI layer:

- shop/store identity;
- products;
- variants;
- prices;
- availability/inventory signals available under granted scopes;
- product URLs/handles;
- images;
- SEO/title/description fields where available;
- collections if useful;
- public policies/content accessible through appropriate APIs.

Use Shopify GraphQL Admin API for modern app behavior.

Cache normalized data in D1 where appropriate so the public AI layer does not need to hit Shopify for every read request.

## 6.3 Safe fix engine

Create a fix registry rather than scattering mutations through routes.

Each fix definition should declare:

- finding it addresses;
- supported platform;
- permissions required;
- risk level;
- preview builder;
- apply function;
- verification function;
- rollback data if practical;
- whether explicit approval is required.

### First Shopify fixes

Prioritize a small number that can actually be completed and verified.

Examples:

1. Generate/improve missing product SEO descriptions **only with explicit preview and approval**.
2. Generate/improve missing product descriptions **only with explicit preview and approval**.
3. Populate safe AgentCart-specific metafields needed by the AI layer where appropriate.
4. Provide and deploy a Shopify **theme app extension/app embed** that can expose additional machine-readable metadata without directly rewriting merchant theme files.
5. Generate a deep link that lets the merchant activate the app embed in Shopify's theme editor when Shopify requires merchant activation.
6. Hosted-layer fixes that require no store mutation can be marked safe automatic and enabled immediately after connection.

Do not automatically overwrite good merchant copy. Never change price, inventory, variants, checkout configuration, legal policies or customer-facing claims without an explicit feature and explicit merchant approval.

### Fix lifecycle

`detected -> proposed -> approved if required -> applying -> applied -> verified`

On failure:

`applying -> failed`

Store the reason and never show a score increase simply because an API mutation returned 200. Verification must confirm the intended result.

## 6.4 Re-scan after fixes

After applying fixes:

- rerun the relevant checks;
- ideally run a full readiness scan;
- persist the new score;
- show before/after;
- show which problems remain.

The dashboard should make the value obvious:

**Agent Ready 54 → 82 (+28)**

---

# 7. AgentCart-hosted AI compatibility layer

This is a core MVP feature, not an optional future note.

The reason for this layer is simple: AgentCart cannot and should not rewrite every customer website. The hosted layer gives AI systems a clean, stable, machine-readable source even when the original site cannot be changed safely.

## 7.1 Canonical profile

For each connected/claimed business create a normalized profile containing only public or merchant-approved information, for example:

- business identity;
- canonical website;
- business description;
- contact methods intended to be public;
- locations/service areas;
- hours where known;
- catalog/services;
- prices/currency;
- availability signals;
- product/service URLs;
- policies;
- supported actions;
- last updated timestamp;
- data provenance where useful.

Never expose Shopify access tokens, private admin information, customer data or internal analytics.

## 7.2 Public endpoints

Provide stable endpoints such as:

- `/ai/:slug`
- `/api/ai/:slug/profile`
- `/api/ai/:slug/catalog`
- `/api/ai/:slug/items/:id`
- `/api/ai/:slug/actions`

Exact route names can differ, but keep them stable, documented and machine-readable.

Return JSON with a small documented schema and useful caching headers/ETags where appropriate.

Add a human-readable version so a merchant can see exactly what AI systems are being told.

## 7.3 Minimal MCP/tool adapter

Expose the same normalized service layer through a small read-only MCP-compatible/tool interface if practical in the Worker architecture.

Initial tools should be read-only and low-risk:

- `get_business`
- `search_catalog`
- `get_item`
- `get_policies`
- `get_supported_actions`

The MCP/tool layer must not invent actions. If purchasing, booking or quoting is not supported, return that clearly.

Build MCP as an adapter over the same business/catalog service functions used by the JSON endpoints. Do not create a second source of truth.

If full MCP transport support materially jeopardizes shipping the rest of the MVP, keep the normalized JSON/tool contract complete and document MCP as the next thin adapter. However, make a best effort to ship a working read-only MCP surface because it is important to the Agent Ready proposition.

## 7.4 Action model

For the MVP, supported actions can primarily be safe links/instructions rather than AgentCart directly spending money or placing orders.

Examples:

- view product;
- add/continue to merchant cart where a reliable public URL exists;
- continue to checkout via merchant-controlled flow;
- open booking page;
- open quote/contact flow;
- call/email using merchant-approved public contact details.

Represent each action with:

- type;
- supported/unsupported;
- target URL or required fields where applicable;
- human-readable description;
- source/provenance;
- limitations.

Do not claim autonomous transaction execution unless it actually exists and has been tested.

---

# 8. Monitoring

Connected businesses should not receive a one-time static score forever.

Add scheduled monitoring using Cloudflare-native scheduling if suitable.

MVP behavior:

- periodically rescan connected businesses;
- persist the new scan;
- compare with previous score and important capabilities;
- surface changes in the dashboard;
- avoid scanning too aggressively on free-tier infrastructure.

Initial cadence can be daily or weekly depending on free-tier limits. The design should support configuration.

Dashboard examples:

- `Score unchanged: 82`
- `Score fell 82 → 68`
- `Price information is no longer machine-readable on 4 products.`
- `AgentCart fixed 3 issues; score improved 54 → 81.`

Email/SMS notifications are not required for MVP if they introduce paid dependencies. Dashboard alerts/history are enough initially.

---

# 9. Dashboard / UX

Keep the interface simple enough for a non-technical small-business owner.

Suggested navigation:

- Overview
- Agent Ready
- Fixes
- AI Layer
- AI Traffic / Revenue (existing attribution)
- Settings

### Overview

Show:

- current score;
- score trend;
- platform/connection status;
- number of important problems;
- fixable problems;
- AI layer status;
- existing AI referral/revenue summary if available.

### Agent Ready

Show category breakdown, capabilities and findings.

### Fixes

Group:

- Fix automatically;
- Needs your approval;
- Needs manual work.

Every write should have a clear preview when it changes merchant content.

### AI Layer

Show:

- Active/inactive;
- public AI profile URL;
- last sync;
- what information it exposes;
- supported actions;
- raw JSON/profile preview for developers if desired.

The product copy should lead with business outcomes, not protocol names.

---

# 10. Existing attribution functionality

Do not remove the existing AI-referral tracking.

It should become an additional benefit of connecting AgentCart:

**Readiness tells the merchant whether AI can understand/use the business. Attribution helps show whether identifiable AI referrals are actually producing traffic/orders/revenue.**

Keep the current honest limitation: not every AI-assisted visit exposes a referrer, and AgentCart must not fabricate attribution.

It is acceptable for attribution to remain Shopify-only during this MVP.

---

# 11. Security and privacy requirements

Mandatory:

- No merchant passwords.
- Keep OAuth state one-time and expiring.
- Keep Shopify HMAC verification.
- Keep encrypted access tokens.
- Keep signed secure merchant sessions.
- Verify webhooks.
- Never expose access tokens to browser/public endpoints.
- Do not store card data.
- Do not unnecessarily collect customer PII.
- Validate all public inputs.
- Add SSRF protection to the expanded scanner.
- Apply request size limits.
- Escape all user/site-derived text inserted into HTML.
- Treat crawled website content as untrusted data, never as executable instructions.
- Add rate limiting/abuse protection where sensible for the public scanner.
- Ensure public AI profiles contain only public/merchant-approved fields.
- Add auditability for merchant-approved writes.

Do a security review before calling the MVP launchable.

---

# 12. Testing plan

The current scanner tests are not enough for the expanded application.

Add tests for at least:

### Scanner

- excellent machine-readable storefront;
- weak storefront;
- service business without products;
- missing price;
- missing availability;
- crawler block;
- sitemap discovery;
- optional llms.txt behavior;
- multi-page evidence;
- platform detection;
- not-applicable scoring;
- timeout/fetch failure;
- redirects;
- SSRF/private-network rejection;
- huge response truncation/limits.

### Scoring

- deterministic score;
- category scores total correctly;
- headline score out of 100;
- scoring version saved;
- no penalty for checks marked not applicable.

### Shopify

- valid/invalid shop domains;
- OAuth HMAC;
- OAuth state expiration/one-time use;
- token encryption/decryption;
- webhook HMAC;
- scope/reauthorization behavior where testable;
- API error handling;
- fix preview;
- explicit approval enforcement;
- successful fix lifecycle;
- failed fix lifecycle;
- verification before marking fixed.

### AI layer

- no secret/internal data leaks;
- stable business profile schema;
- catalog search;
- item lookup;
- supported actions;
- unsupported actions are honest;
- unknown business returns appropriate error;
- caching/version behavior.

### Events/attribution regression

- existing event ingestion;
- unknown shop rejection;
- event dedupe;
- AI source classification;
- dashboard aggregation.

### UI/routes

At least smoke-test important routes and error states.

CI must run typecheck + full automated test suite.

---

# 13. Implementation phases

Work in this order unless repository inspection uncovers a strong dependency reason to reorder.

## Phase 0 — Baseline

- inspect repo;
- run current tests/typecheck;
- document any pre-existing failures;
- verify current route map and data model.

**Exit:** existing behavior understood and baseline recorded.

## Phase 1 — Scanner v2 + capability model

- multi-page bounded crawler;
- platform detection;
- normalized page evidence;
- category scoring;
- capabilities;
- plain-language findings;
- tests.

**Exit:** arbitrary public business URL produces a useful Agent Ready report without needing Shopify.

## Phase 2 — Persistence + history

- non-destructive migration;
- businesses;
- scan runs/pages/findings;
- scoring version;
- report/history APIs.

**Exit:** repeat scans can be compared reliably.

## Phase 3 — New report/dashboard UX

- score categories;
- can/cannot understand;
- can/cannot do;
- priority fixes;
- points recoverable;
- platform-specific CTA.

**Exit:** non-technical owner can understand the result without reading technical terms.

## Phase 4 — Shopify authoritative sync

- review scopes;
- update app config;
- GraphQL client/service layer;
- store/product/policy sync;
- reauthorization handling;
- tests/mocks.

**Exit:** connected Shopify store has a normalized AgentCart business/catalog profile.

## Phase 5 — Hosted AI layer

- profile generator;
- catalog normalization;
- public JSON endpoints;
- human-readable preview;
- supported action model;
- read-only MCP/tool adapter where practical;
- security tests.

**Exit:** an external AI/developer can retrieve clean structured information about a connected merchant without scraping the merchant site.

## Phase 6 — Fix engine

- fix registry;
- lifecycle/audit storage;
- safe hosted-layer automatic fixes;
- Shopify approval-required product/SEO fixes;
- theme app extension/app embed for machine-readable enhancements where useful;
- Shopify deep-link activation path;
- verification + rescan;
- before/after UI.

**Exit:** at least several real scanner failures can be fixed through AgentCart and verified.

## Phase 7 — Monitoring

- scheduled rescans;
- comparisons;
- dashboard history/alerts;
- free-tier-conscious scheduling.

**Exit:** connected store readiness is no longer a one-time snapshot.

## Phase 8 — Production hardening

- route/security review;
- rate/size limits;
- error handling;
- empty/loading/error states;
- mobile checks;
- docs;
- CI green;
- remove misleading old copy;
- end-to-end verification checklist.

**Exit:** repo is ready for owner account setup and real Shopify development-store testing.

---

# 14. Definition of MVP done

Do not call the new Agent Ready MVP complete until all of the following are true:

- [ ] A public URL can be scanned.
- [ ] Scan covers multiple representative pages rather than only one HTML response.
- [ ] Platform detection is present.
- [ ] Score is out of 100 with category breakdown.
- [ ] Report clearly says what AI can and cannot understand.
- [ ] Report clearly says what AI can and cannot do.
- [ ] Findings are primarily plain English with technical evidence secondary.
- [ ] Shopify connection works through OAuth without passwords.
- [ ] Connected Shopify data can be normalized into AgentCart.
- [ ] Hosted AI profile is generated.
- [ ] Public structured AI profile/catalog endpoints work.
- [ ] At least a minimal read-only tool/MCP surface works, or a very clearly documented thin adapter remains if transport compatibility blocks shipment.
- [ ] Fixes are categorized automatic / approval-required / manual / hosted-layer.
- [ ] At least several useful fixes can actually be applied.
- [ ] Merchant content is never overwritten without required approval.
- [ ] Applied fixes are verified.
- [ ] A rescan shows the new score and before/after difference.
- [ ] Historical scans are persisted.
- [ ] Scheduled monitoring is present for connected businesses.
- [ ] Existing AI attribution is not broken.
- [ ] No merchant/customer secrets leak to public AI endpoints.
- [ ] Typecheck passes.
- [ ] Automated tests pass.
- [ ] Documentation matches the shipped architecture.
- [ ] Remaining owner/manual external-account actions are listed clearly.

---

# 15. Explicit non-goals for this MVP

Do not delay the MVP for:

- billing/subscriptions;
- commission settlement between AI agents and merchants;
- a full affiliate network;
- perfect probabilistic AI-assisted attribution;
- WordPress direct-write integration;
- WooCommerce direct-write integration;
- dozens of commerce platforms;
- placing autonomous purchases on behalf of users;
- paid LLM features;
- complex benchmark datasets;
- native mobile apps.

Keep extension points clean so these can follow later.

---

# 16. WordPress / WooCommerce after Shopify MVP

Architect platform adapters so Shopify-specific code does not leak throughout the scanner/fix engine.

Target conceptual interfaces such as:

- `detectPlatform()`
- `connectPlatform()`
- `syncBusiness()`
- `syncCatalog()`
- `listAvailableFixes()`
- `previewFix()`
- `applyFix()`
- `verifyFix()`

After Shopify proves the end-to-end loop, implement WordPress/WooCommerce using proper plugin/API authorization. Do not request or store WordPress admin passwords.

---

# 17. Owner actions Claude cannot complete alone

Code as much as possible so these are the only remaining manual/account tasks.

Likely owner actions include:

1. Create/configure the real Cloudflare D1 database if not already done.
2. Apply remote migrations.
3. Deploy the Worker and set the production `APP_URL`.
4. Create/configure the Shopify app in the owner's Shopify developer account.
5. Approve final required Shopify scopes and app configuration.
6. Add Shopify client credentials and encryption key to Cloudflare secrets.
7. Deploy Shopify extensions through authenticated Shopify CLI/account access.
8. Install AgentCart on a Shopify development store.
9. Activate the AgentCart theme app embed through Shopify's theme editor if required by Shopify.
10. Complete real test checkout/event journeys.
11. Supply real support/business contact details for legal/support pages.
12. Review privacy/terms before taking public paying customers.
13. Submit for Shopify review later if public App Store distribution is required.

Do not use missing external credentials as a reason to leave code paths as stubs. Build and test with mocks/local fixtures, then document the exact live verification step.

---

# 18. Required final handover from Claude

When implementation is finished, provide a concise final report containing:

1. What was already present and preserved.
2. What was built.
3. Important architecture decisions.
4. Database migrations added.
5. Shopify scopes required and why.
6. Routes/endpoints added.
7. Automatic fixes implemented.
8. Approval-required fixes implemented.
9. AI-layer/MCP tools implemented.
10. Tests added and results.
11. Typecheck/build results.
12. Known limitations.
13. Exact external actions the owner still needs to perform.
14. Exact steps to test the MVP on the first real Shopify development store.

If anything is incomplete, say exactly what and why. Do not mark placeholder/demo behavior as production-complete.

---

# 19. Product principle to keep throughout the build

The MVP should make this statement true:

> **A business owner can give AgentCart a website and quickly discover whether AI customers can understand and use the business. If the owner connects Shopify, AgentCart should automatically improve everything it can safely improve, ask approval for changes that affect merchant content, provide a clean AI-facing compatibility layer for the rest, then prove the improvement with a new score.**

That loop is the product. Everything else is secondary for this release.
