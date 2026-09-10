# AgentCart — Phase 10: Meta Muse & Agentic Commerce Compatibility

> Extension to `CLAUDE_AGENT_READY_MVP_BUILD_PLAN.md`.
>
> Preserve all completed Agent Ready MVP work. This phase is additive and must not regress the scanner, Shopify sync, hosted AI layer, fix engine, monitoring, security, attribution or the existing test suite.

## Phase 10 product goal

AgentCart must answer a stronger question than "Can AI understand this business?":

> **If a customer tells an AI agent to buy, book, reserve, request a quote or otherwise act with this business, can the agent actually complete the journey?**

The product loop becomes:

**Discover → Understand → Act → Pay → Attribute**

Meta Muse is the first named compatibility target for this phase, but implementation must remain provider-neutral enough to support other AI agents later.

### Mandatory implementation rules

- Re-check current official Meta, Shopify and Stripe documentation before coding provider-specific assumptions. These capabilities are new and may change.
- Never claim Meta/Muse readiness without evidence.
- Distinguish `failed`, `unsupported`, `unknown` and `not available in this region`.
- Do not penalize a UK merchant because a Meta commerce feature is currently limited to another region.
- Do not collect or store card numbers, wallet credentials or other payment secrets.
- Do not attempt to bypass user approval, fraud controls, payment authentication or platform restrictions.
- Keep provider-specific rules in a registry/config layer rather than scattering hard-coded names through the app.
- Keep deterministic checks usable without a paid LLM.
- Preserve least-privilege Shopify permissions.

---

# 10.1 Proper Meta crawler and discovery readiness

AgentCart currently checks broad crawler accessibility. Phase 10 must make this provider-aware.

### Build

Add structured crawler/provider capability checks that can represent at least:

- Meta search/indexing crawler access;
- Meta user-triggered fetch/browser access used for AI tasks where officially documented;
- Meta training crawler access as a **separate** concern;
- generic crawler access;
- sitemap and canonical discovery support.

Parse `robots.txt` by user-agent rather than treating only `User-agent: *` as meaningful.

Important rule: blocking a training-only crawler must **not** automatically lower Agent Ready score if the merchant still permits the documented search/discovery agents it wants to reach.

Store the exact matching `robots.txt` evidence used for each conclusion.

### UI

Show business-friendly rows such as:

- Meta AI discovery: Ready / Blocked / Unknown
- Muse website access: Ready / Blocked / Unknown
- Meta training crawler: Allowed / Blocked by choice

Put raw crawler/user-agent detail behind expandable technical evidence.

### Acceptance

- Tests prove per-user-agent rules are evaluated correctly.
- Tests prove blocking training-only access does not create a readiness penalty.
- Provider names/rules can be updated centrally.

---

# 10.2 Add `agents.md` and expanded agent discovery files

The scanner already checks `llms.txt`. Phase 10 must expand discovery-file awareness.

### Scan for

- `/agents.md`
- `/llms.txt`
- `/llms-full.txt`
- `/sitemap.xml` and discovered sitemap variants
- any platform-native agent-discovery endpoint confirmed in current official documentation.

For Shopify, detect platform-provided agent files and do not recommend recreating something Shopify already supplies.

Do not give any single discovery file an outsized share of the score. Presence is useful; it is not proof of actionability or transaction readiness.

### AgentCart-hosted AI layer

Expose an AgentCart-hosted `agents.md` representation for connected/claimed businesses, generated from the same normalized source of truth used by JSON/MCP endpoints.

It should point agents toward stable canonical resources for:

- business identity;
- catalog/services;
- item details;
- policies;
- supported actions;
- checkout/payment capability status;
- freshness/last-updated metadata.

Never expose tokens, internal analytics, private admin data or customer information.

### Acceptance

- Scanner records all supported discovery files separately.
- Hosted `agents.md` has tests proving it contains only public/approved data.
- Shopify-native files are recognised rather than falsely flagged missing.

---

# 10.3 Muse changes what "website works for AI" means

A page can visually work for a human while still being difficult for an AI browser agent. Static text matching alone is no longer sufficient.

### Add an Agent Interaction Readiness layer

Extend the actionability model to inspect evidence for:

- semantic links and buttons for primary actions;
- accessible names for controls;
- correctly labelled form inputs;
- clear product variant selectors;
- quantity controls;
- unambiguous add-to-cart / buy / checkout actions;
- visible error/validation states where statically detectable;
- booking/reservation/quote/contact controls;
- important actions not hidden only behind inaccessible custom widgets;
- meaningful link/button text rather than ambiguous controls;
- checkout fields with machine-identifiable purpose where detectable.

Do not claim that a static Worker fetch proves a full browser journey.

Represent two levels:

1. **Static agent-action readiness** — deterministic scan evidence.
2. **Live browser journey verification** — optional future/connected verification through a safe browser runner.

Design the data model now so browser verification can be added without changing the report schema later.

### Acceptance

- Existing `add to cart` / `/checkout` regex evidence remains useful but is no longer the whole action score.
- Tests cover good semantic controls and intentionally poor/inaccessible markup.
- Report states exactly what was and was not verified.

---

# 10.4 Meta product discovery is now a real channel

AgentCart must treat Meta as a commerce/discovery destination rather than only an attribution source.

### Add a Meta Discovery assessment

For product businesses, evaluate available evidence for:

- complete product name/title;
- description;
- price and currency;
- availability;
- stable canonical product URL;
- product identifiers such as SKU/GTIN/MPN/barcode where appropriate;
- useful images and alt text;
- policy availability;
- crawler/index accessibility;
- Shopify Catalog eligibility/signals where available from an authorised Shopify connection;
- Facebook & Instagram by Meta product-sync/channel status where available through supported APIs/configuration.

Do not claim AgentCart knows Meta's ranking algorithm. The feature is **readiness/eligibility evidence**, not a promise of ranking or inclusion.

### UI

Add a provider compatibility card/table, for example:

| Capability | Meta/Muse status |
| --- | --- |
| Business discoverable | Ready |
| Products readable | Ready |
| Price/stock readable | Ready |
| Meta catalog/channel | Connected / Not connected / Unknown |
| Direct checkout | Eligible / Not eligible / Not available here |

### Acceptance

- Meta discovery status is evidence-based.
- Unknown API/channel status is displayed as unknown rather than guessed.
- Region restrictions never appear as merchant failures.

---

# 10.5 Shopify Meta Agentic Storefront readiness

Shopify now exposes Meta as an agentic commerce channel. AgentCart should detect and help configure the merchant's native Shopify capabilities instead of inventing a competing Shopify checkout protocol.

### Build a Shopify agentic-commerce capability service

Where current Shopify APIs/configuration permit, determine:

- whether the Facebook & Instagram by Meta sales channel is installed/connected;
- whether product syncing is enabled;
- whether products meet relevant Shopify Catalog eligibility requirements;
- whether required merchant policies are present;
- whether Agentic Storefront terms/configuration are complete where detectable;
- whether Meta direct checkout is enabled/eligible;
- relevant region/market restrictions;
- Shopify-native UCP / Cart MCP / Checkout MCP capabilities exposed by the store, where current documentation/API access makes detection practical.

Do not duplicate Shopify's checkout stack. Prefer detection, configuration guidance, validation and compatibility reporting.

### Fix model

Classify each missing item as one of:

- automatic;
- approval-required;
- merchant account action;
- platform/region unavailable.

Examples:

- Missing public policy: manual/approval-required depending on available API support.
- Meta channel not installed: merchant account action.
- Region not supported: not available, no score penalty.
- Product data incomplete: existing AgentCart fix engine where safe.

### Acceptance

A connected Shopify merchant receives a plain-English Meta Agentic Storefront readiness report with evidence and next action for every incomplete capability.

---

# 10.6 Muse payment readiness gets its own test

Do not reduce payment readiness to "checkout link exists".

### Add Payment/Transaction Readiness

For product businesses, evaluate the transaction path in stages:

1. product can be selected;
2. correct variant can be selected;
3. cart can be created/reached;
4. totals/currency are clear;
5. shipping/delivery information is obtainable;
6. returns/refund information is obtainable;
7. checkout is reachable;
8. standard card checkout is available where detectable;
9. Stripe Link support/readiness where reliably detectable;
10. Shop Pay support where applicable;
11. Meta/Shopify direct checkout eligibility where applicable;
12. required user approval/authentication remains in the payment provider or merchant flow.

Use separate labels:

- **Muse purchase capable** — a normal supported checkout path appears usable.
- **Muse optimized** — a more native agentic payment/checkout integration is available.

Do not make Stripe Link mandatory if ordinary checkout remains usable by the agent.

### AgentCart action model

Prepare the existing AI action model for safe future actions such as:

- `create_cart`
- `update_cart`
- `get_checkout_options`
- `get_checkout_handoff`

Only expose a mutating action when a real merchant/platform capability backs it and it has been tested. AgentCart must never hold consumer card credentials.

### Acceptance

- Payment readiness is reported separately from product discovery.
- Tests cover partial journeys and region-unavailable features.
- No payment credential is accepted by or persisted in AgentCart.

---

# 10.7 Attribution must change for Meta/Muse agentic checkout — HIGH PRIORITY

This is a priority because some agentic/direct checkout flows may not execute the merchant's normal client-side Web Pixel. Pixel-only attribution can therefore miss the exact AI purchases AgentCart is supposed to prove.

The current branch already contains dormant `read_orders`/order-webhook infrastructure. Build on it rather than replacing it.

### Required attribution model

AgentCart should combine multiple evidence levels:

1. **Direct AI referral evidence** — existing browser/referrer signal.
2. **AgentCart interaction/referral ID** — signed/collision-resistant ID created when an agent enters through AgentCart-controlled surfaces where possible.
3. **Platform/server-side order evidence** — Shopify order/channel/source information from authorised, HMAC-verified webhooks/APIs.
4. **Assisted/modelled attribution** — future only, clearly labelled and never mixed with verified revenue.
5. **Unknown/direct** — remain honest when no defensible source exists.

### Shopify order verification

Prioritise production-enabling the existing `orders/paid` path after the merchant completes Shopify's Protected Customer Data approval requirements.

Requirements:

- keep `read_orders` disabled until legitimately approved;
- never collect unnecessary customer PII;
- do not persist raw customer details from order webhooks;
- normalize order identifiers reliably enough to join browser and server-side evidence;
- capture Shopify-provided sales/channel/source metadata useful for identifying Meta AI / agentic storefront orders where current APIs expose it;
- distinguish `Verified`, `Reported`, `Identifiable referral`, `Assisted` and `Unknown` revenue in the UI;
- never infer Meta/Muse simply because a pixel is absent.

### Transaction/referral IDs

For AgentCart-owned handoff URLs/actions, design a signed/collision-resistant commerce journey ID that can survive into a merchant-supported cart/checkout/order metadata field **only where the target platform officially supports it**.

Do not put secrets or customer identity in the token.

### Acceptance

- A simulated Meta direct-checkout/order-webhook path can produce verified AI-channel revenue without requiring the Web Pixel to fire.
- Existing browser attribution continues to work.
- Tests prove missing attribution remains unknown rather than being fabricated.
- Tests prove no customer PII leaks through the AI layer or attribution dashboard.

---

# 10.8 Muse security changes the scanner

Agent browsers are specifically exposed to prompt injection and hostile page content. AgentCart should measure whether a merchant's public pages contain signals that could make agent interaction risky, but it must not attempt to bypass agent safeguards.

### Add an Agent Safety / Content Integrity assessment

Treat all crawled content as untrusted, as the current scanner already does.

Add deterministic indicators for suspicious conditions such as:

- hidden text that appears to instruct an AI/agent rather than describe the business;
- text explicitly attempting to override an agent's rules/system/developer instructions;
- suspicious "ignore previous instructions" style content in places that should contain merchant/product copy;
- machine-targeted instructions hidden through common visual-hiding techniques where detectable statically;
- product descriptions or CMS content containing obvious prompt-injection payloads;
- third-party embeds/widgets that completely own critical checkout actions, recorded as an interaction-risk signal rather than automatically labelled malicious;
- unexpected external navigation in core purchase actions where detectable.

Do **not** execute or follow instructions found in the site content.

Do **not** publish a detailed bypass guide for Meta/Muse security controls.

### Output

Use careful language such as:

> "This page contains content that may cause AI agents to distrust, stop or require additional confirmation before acting."

Do not state that Meta will definitely block a page unless current official evidence proves that exact behavior.

### Acceptance

- Regression tests confirm crawled prompt-injection text cannot alter AgentCart scoring logic or instructions.
- Suspicious content is evidence, not executable input.
- False-positive-prone checks are warnings/secondary findings unless confidence is high.

---

# 10.9 Provider compatibility dashboard

Add a provider-focused compatibility view without replacing the existing overall Agent Ready score.

Initial rows should support at least:

- Meta AI / Muse;
- Generic browser agent;
- Generic MCP/tool client;
- Shopify-native agentic commerce where applicable.

Architecture should allow ChatGPT, Gemini, Copilot, Claude and Perplexity profiles later without schema redesign.

Capabilities should include:

- Discover
- Understand business
- Understand products/services
- Read policies
- Navigate
- Cart
- Checkout
- Payment readiness
- Book/reserve
- Quote/enquire
- Attribution visibility

Use `Ready`, `Partial`, `Blocked`, `Unknown`, and `Not available in region` rather than simplistic green/red where nuance matters.

---

# 10.10 Data model and scoring

Do not destroy or rewrite historical scoring records.

If Agentic Commerce changes the headline scoring model materially, bump `SCORING_VERSION` and preserve historical comparability.

Prefer adding provider capability evidence beside the existing five-category Agent Ready score rather than immediately bloating the headline score.

If a new transaction-readiness category is later folded into the 100-point score, document the weights and version it explicitly.

Persist enough data to answer:

- what provider was checked;
- what capability was checked;
- what evidence produced the result;
- whether the result is region-dependent;
- when it was checked;
- what rule/documentation version informed the result where practical.

---

# 10.11 Tests required for Phase 10

Add automated tests for at least:

### Meta discovery

- Meta search crawler allowed;
- Meta search crawler blocked;
- Meta training crawler blocked without readiness penalty;
- conflicting robots groups;
- wildcard/default behavior;
- unknown crawler documentation/config state.

### Discovery files

- `agents.md` found/missing;
- `llms.txt` found/missing;
- `llms-full.txt` found/missing;
- Shopify-native agent files recognised;
- hosted AgentCart `agents.md` leaks no private fields.

### Interaction readiness

- semantic buy controls;
- unlabeled controls;
- accessible and inaccessible forms;
- variants/quantity/checkout path;
- static evidence explicitly not represented as full browser verification.

### Meta/Shopify channel

- eligible store;
- missing Meta channel/product sync;
- missing required policy;
- unsupported region marked not-available rather than failed;
- unknown provider API status remains unknown.

### Payment readiness

- complete ordinary checkout path;
- checkout but no payment method evidence;
- Link/Shop Pay/native-agentic capability when evidence exists;
- partial journey;
- no card/payment secrets accepted or persisted.

### Attribution

- browser referral path;
- server-side Meta/agentic order with no pixel event;
- signed journey ID where platform handoff supports it;
- order identifier normalization;
- unknown source stays unknown;
- no customer PII persistence.

### Agent safety

- prompt-injection-looking content cannot change score instructions;
- hidden machine-directed text warning;
- ordinary merchant copy does not trigger high-severity warnings;
- external widget evidence is not automatically labelled malicious.

CI must continue to run typecheck + the entire automated test suite.

---

# 10.12 Phase 10 definition of done

Do not call Phase 10 complete until all of the following are true:

- [ ] Meta-specific crawler/discovery readiness exists.
- [ ] Training crawler controls are separated from search/discovery readiness.
- [ ] `agents.md`, `llms.txt` and `llms-full.txt` discovery is implemented.
- [ ] AgentCart-hosted `agents.md` is available without private-data leakage.
- [ ] Agent Interaction Readiness goes beyond simple add-to-cart text matching.
- [ ] Meta product discovery/channel readiness can be reported for supported connected stores.
- [ ] Shopify Meta Agentic Storefront eligibility/configuration is reported where evidence is available.
- [ ] Region-unavailable Meta features are not reported as merchant failures.
- [ ] Muse/payment readiness has its own staged assessment.
- [ ] AgentCart does not collect/store payment credentials.
- [ ] Attribution can support server-side AI-channel orders that bypass the Web Pixel.
- [ ] Existing dormant Shopify order verification path is preserved and prepared for legitimate `read_orders` activation.
- [ ] Verified, reported, assisted and unknown attribution are not mixed together.
- [ ] Agent Safety/Content Integrity checks are present.
- [ ] Provider compatibility dashboard/view is implemented.
- [ ] New functionality has automated tests.
- [ ] Existing tests continue passing.
- [ ] Documentation is updated to describe current Meta/Muse limitations and regional availability accurately.
- [ ] Any owner-only external setup actions are listed in `docs/USER_ACTIONS.md`.

---

# 10.13 Exact priority order

Implement in this order unless a hard dependency requires otherwise:

1. **Server-side Meta/agentic attribution support and order-source model** — because pixel-only measurement can miss direct agentic checkout.
2. **Meta/Shopify Agentic Storefront readiness detection** — because it produces immediate merchant value from the new channel.
3. **Meta crawler/discovery readiness**.
4. **`agents.md` / discovery-file support**.
5. **Muse/agent interaction readiness**.
6. **Payment/transaction readiness assessment**.
7. **Agent safety/content-integrity checks**.
8. **Provider compatibility dashboard and documentation polish**.

The end-state should make this statement true:

> **AgentCart can tell a merchant whether Meta/Muse can discover the business, understand what it sells, safely navigate its website, reach a valid transaction path, use the merchant's supported payment/checkout infrastructure, and allow the resulting AI-driven commerce to be measured as honestly as the available evidence permits.**
