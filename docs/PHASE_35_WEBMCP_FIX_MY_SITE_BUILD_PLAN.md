# Phase 35 — WebMCP Fix My Site build plan

Updated 2026-09-21.

> **Implementation update — 2026-09-21:** The credential-independent Phase 35 exit gates are implemented on `codex/phases-30-32`, including the action mapper/router, reversible WordPress/WooCommerce plugin, generic versioned browser adapter, PayPal reuse decision, fail-safe security gate, runtime evidence verifier and disable/rollback state. Nothing in this update proves a live installation; the Live gates below remain open.

## Why this belongs in Agent Ready

WebMCP is becoming a practical way for browser AI agents to interact with an existing website through structured tools rather than by visually clicking through every page.

Current primary-source evidence:

- Chrome's current Imperative API registers site tools through `document.modelContext.registerTool(...)`.
- PayPal now has a live WebMCP merchant showcase. For Store Sync merchants, the PayPal JS SDK can expose structured `shopping.*` tools to compatible agents for product discovery, availability, cart building and handoff to secure PayPal checkout.
- PayPal's September 16, 2026 test reported a directional sandbox result of roughly 4.6x lower model-inference cost, about 2x faster median end-to-end checkout, and three structured tool calls instead of more than 30 interface-interaction steps. These results are PayPal's small internal benchmark and must not be presented as universal performance claims.
- PayPal Store Sync currently supports physical goods sold to US customers in USD and requires PayPal merchant eligibility/access. It does not currently cover the full UK/service-business market Agent Ready intends to serve.

Primary sources:

- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://webmcp-store.paypal.com/
- https://developer.paypal.com/community/blog/WebMCP_PayPal_Agent_Ready/
- https://developer.paypal.com/store-sync/overview
- https://developer.paypal.com/store-sync/integrate/

## Current Agent Ready position

Agent Ready already has useful foundations:

1. The readiness scanner knows WebMCP is an emerging capability.
2. Static scanning deliberately reports WebMCP runtime evidence as unknown instead of claiming support it cannot observe.
3. Phase 30 imports Lighthouse Agentic Browsing evidence, including WebMCP-related audits.
4. Phase 32 assesses tool metadata/output as untrusted, separates read and write tools, and checks identity, scope, approval, idempotency, rollback and verification.
5. AgentPulse already has deterministic journey-testing concepts for discovery, product/price/availability, contact/quote, booking and checkout handoff.
6. Agent Ready already has Business Brain data, Shopify/UCP work, a hosted MCP layer, fix previews/approval and continuous monitoring.

What still requires a real authorised environment:

- install and enable the plugin on an authorised development website;
- exercise `document.modelContext` in a compatible real browser/runtime;
- compare tool outputs with the merchant's live system of record;
- prove a safe development cart/booking/quote path where applicable;
- prove incident detection and recovery after deliberate breakage;
- evidence PayPal Store Sync eligibility before selecting that provider route.

Therefore the implementation is Code-ready, while every Live claim remains gated by real environment evidence.

---

# Product promise

Do not sell "WebMCP".

Sell:

**Make your website work with AI customers.**

The customer-facing capability model should stay simple:

- Can AI find you?
- Can AI understand you?
- Can AI choose/recommend you?
- Can AI actually do business with you?

"Fix My Site" should choose the best implementation path automatically. WebMCP is one tool in that toolbox alongside native platform APIs, UCP, MCP, schema/feeds and existing commerce/payment integrations.

---

# 35.1 — Business action mapper

Build an action-planning service that maps Business Brain facts, site type and connected systems to the actions that genuinely apply.

Example templates:

### Ecommerce

- `search_products(query, filters)`
- `get_product(product_id)`
- `check_availability(product_id, variant)`
- `create_or_update_cart(items)`
- `checkout_handoff(cart_id)`

### Trades / local services

- `check_service_area(postcode)`
- `get_quote(job_type, details)` where a deterministic or authorised quoting source exists
- `check_availability(date_or_window)`
- `request_booking(slot, contact_details)`

### Restaurants

- `view_menu(filters)`
- `check_table_availability(date, time, party_size)`
- `reservation_handoff(slot)`

### Professional services

- `list_services()`
- `check_eligibility_or_area(details)`
- `request_consultation(time_window)`

Rules:

- Do not expose an action just because a template exists.
- Every action must have a real source of truth or safe handoff.
- Missing price, availability or eligibility data must remain unknown rather than fabricated.
- Read-only discovery actions should be preferred before consequential write actions.

Exit gate:

Agent Ready can generate an applicability-aware "AI can do business with you" action plan for a connected merchant without installing anything.

---

# 35.2 — Fix My Site implementation router

Extend the existing fix engine so the WebMCP plan chooses the safest existing integration path rather than blindly injecting JavaScript.

Order of preference:

1. Reuse a supported native platform capability when it already solves the problem.
2. Reuse an authorised payment/commerce provider capability such as PayPal Store Sync/WebMCP when appropriate.
3. Reuse existing merchant APIs or booking/inventory systems.
4. Use an Agent Ready WordPress/WooCommerce plugin/bridge.
5. Use an Agent Ready generic WebMCP JavaScript + server bridge when no better native path exists.
6. Fall back to a safe handoff rather than pretending an unsupported mutation is transactional.

The merchant must see a preview of what will be installed/exposed before customer-visible or consequential changes.

---

# 35.3 — WordPress / WooCommerce first-party installer

This is the first direct-install target because it gives Agent Ready a practical SME route that is not dependent on PayPal Store Sync eligibility.

Plugin responsibilities:

- authenticate to Agent Ready without sharing WordPress passwords;
- detect WooCommerce products, variants, prices, stock and cart routes;
- expose read-only WebMCP product/search/availability tools;
- expose cart/checkout handoff only after the security gate passes;
- map service-business forms/booking plugins through approved adapters;
- publish tool version and capability metadata;
- allow disable/rollback from both WordPress and Agent Ready;
- never store payment credentials.

Do not couple the plugin to one payment provider.

---

# 35.4 — WebMCP runtime implementation

Use the current browser standard rather than inventing a private protocol.

For supported browser environments:

- register tools with the current `document.modelContext` WebMCP API;
- provide narrow, descriptive schemas;
- return structured, factual outputs;
- expose stable tool/version identifiers for monitoring;
- keep browser compatibility and standard maturity visible.

Because WebMCP is still evolving, registration code must live behind an adapter/version boundary so API changes do not require rewriting every business connector.

---

# 35.5 — PayPal Store Sync / WebMCP reuse

Add a PayPal capability detector and setup path.

When the merchant is already eligible for PayPal Store Sync:

- detect/record the existing PayPal path;
- tell the merchant when enabling PayPal's WebMCP surface is the lowest-maintenance option;
- validate the exposed `shopping.*` journey from AgentPulse;
- do not create a duplicate checkout stack;
- keep checkout/payment approval inside PayPal;
- record the handoff/outcome evidence Agent Ready is authorised to observe.

Current eligibility limitations must remain explicit:

- Store Sync currently targets physical goods;
- US-based customers;
- USD;
- access/merchant requirements apply.

For UK merchants, services, digital products and other unsupported cases, Agent Ready should choose another adapter rather than falsely report PayPal support.

---

# 35.6 — Service-business WebMCP bridge

This is strategically important because commerce providers naturally focus on products and payments, leaving service businesses underserved.

Build reusable adapters for:

- postcode/service-area checks;
- deterministic quote calculators;
- calendars/availability;
- booking systems;
- reservation systems;
- lead/consultation handoffs.

The bridge must call the merchant's authorised system of record. It must not let an LLM invent a quote, appointment slot or service eligibility.

---

# 35.7 — AgentPulse WebMCP verification

Add a real browser-runtime journey type.

For every installed action:

1. confirm the expected tool is registered;
2. validate its schema;
3. call safe read-only tools;
4. validate returned facts against the connected source of truth;
5. record latency/errors/schema drift;
6. verify consequential actions only in an explicit sandbox/development flow;
7. never create a real charge/order/booking during ordinary monitoring;
8. create an incident when a previously working action breaks.

Example merchant-facing result:

- Find a black T-shirt under £30: PASS
- Check Medium stock: PASS
- Add Medium to a development cart: PASS
- Reach secure checkout handoff: PASS
- Complete a real payment: NOT RUN in monitoring

---

# 35.8 — Tool security gate

Reuse and extend Phase 32 rather than building separate WebMCP security.

A mutating action cannot become Live until Agent Ready has evidence for the applicable controls:

- trusted merchant identity;
- narrow authorization scope;
- user approval/confirmation for consequential actions;
- input validation;
- prompt-injection resistance for untrusted page/tool content;
- idempotency where repeated calls could duplicate work;
- rollback/cancellation or compensating action where applicable;
- post-action verification;
- rate/abuse controls;
- no exposed secrets or payment credentials.

Read-only brochure sites must not be penalised for transaction controls that do not apply.

---

# 35.9 — Fix My Site customer flow

Target UX:

**SCAN**

Agent Ready reports:

- AI can understand your services — PASS
- AI can understand pricing — PARTIAL
- AI can check availability — FAIL
- AI can request a quote — FAIL
- AI can book — FAIL

**FIX MY SITE**

Agent Ready shows:

- 2 information fixes
- 2 safe AI-action integrations
- 1 action needing merchant approval/system connection

The merchant connects/approves only what is needed.

**VERIFY**

Agent Ready runs the real agent journeys and shows evidence.

**MONITOR**

AgentPulse retests them continuously and alerts on breakage/drift.

No customer-facing screen should require the merchant to understand the phrase "WebMCP" unless they open technical details.

---

# 35.10 — Commercial / analytics connection

Every WebMCP journey should connect to the existing outcome model:

- discovered;
- recommended;
- tool used;
- handoff started;
- checkout/booking/quote started;
- completed outcome where independently verified;
- revenue where evidence supports it.

This lets Agent Ready answer the commercially useful question:

**"Did making the site usable by AI agents produce more successful customer journeys?"**

Do not claim incremental revenue from correlation alone. Before/after experiments and attribution evidence must remain labelled by strength.

---

# 35.11 — Release gates

Phase 35 is Code-ready only when:

- action mapper exists;
- at least one WordPress/WooCommerce install path exists;
- generic adapter/version boundary exists;
- browser WebMCP registration is tested;
- security findings gate writes;
- AgentPulse has browser-runtime verification;
- rollback/disable works;
- provider reuse routing exists.

Phase 35 is Live only after:

- a real authorised development merchant is installed;
- compatible browser/agent discovers the tools;
- read actions return source-of-truth values;
- a safe cart/booking/quote test succeeds where applicable;
- no routine test creates an unintended real transaction;
- monitoring detects a deliberately broken tool and recovers after the fix.

---

# Naming / launch risk discovered during this research

PayPal currently markets an official agentic-commerce service called **Agent Ready**.

That is a material branding/search/confusion risk for this project, even though it does not by itself establish a trademark conflict.

Before public launch:

1. run proper UK/US trademark and brand clearance for "Agent Ready";
2. assess search/discovery confusion with PayPal's product;
3. decide whether the current name remains commercially defensible before investing heavily in branding/listing assets.

This is an owner/legal/brand decision, not a code task.

Primary source:
https://developer.paypal.com/agent-ready/overview/

---

# Scope rule

This phase is part of the existing Agent Ready product.

Do **not** create a separate WebMCP business.

The architecture remains:

Scan -> understand -> recommend -> act -> Fix My Site -> verify -> monitor -> measure outcomes.

WebMCP is an implementation method beneath that customer promise, not the product name.
