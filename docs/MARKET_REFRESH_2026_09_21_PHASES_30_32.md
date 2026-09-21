# Agent Ready market refresh — 2026-09-21

This is a delta review against the Phase 18–29 implementation completed from the 2026-09-18
benchmark. It does **not** invalidate completed phases. It records standards/provider changes and
new competitor capabilities that appeared or were confirmed after that benchmark.

## Executive decision

Keep Phases 18–29 intact. Add three follow-on phases:

- **Phase 30 — Commerce and standards refresh**
- **Phase 31 — Analytics / competitor parity refresh**
- **Phase 32 — Agent-interaction security and validation**

The only immediate code corrections are provider/standard facts that are now objectively stale.
The larger items below are new capability work and must not be represented as already live.

---

# Phase 30 — Commerce and standards refresh

## 30.1 Shopify native UCP 2026-08-25

Primary sources:

- https://shopify.dev/changelog/08-25-is-now-supported
- https://shopify.dev/docs/agents/get-started/profile
- https://shopify.dev/docs/agents/catalog/storefront-catalog
- https://shopify.dev/docs/agents/carts-and-checkout/cart-mcp
- https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp
- https://ucp.dev/documentation/announcements/

Verified change:

- Shopify storefronts publish discovery at `/.well-known/ucp`.
- Shopify now advertises UCP `2026-08-25`.
- Shopify's native UCP MCP transport is `https://{shop-domain}/api/ucp/mcp`.
- Catalogue, cart, checkout and order capabilities are negotiated from the storefront profile.

Required Agent Ready work:

1. Parse the live UCP profile instead of recording Shopify-native publication as `unknown`.
2. Record `ucp.version`, supported versions, service transport/endpoint and each capability version.
3. Treat capability presence as observed evidence, not an assumption about every Shopify store.
4. Add safe native-UCP AgentPulse checks:
   - discovery;
   - catalogue search/lookup;
   - schema/version compatibility;
   - read-only order/tool discovery where authorization permits.
5. Never create or complete a real cart/checkout/order during an ordinary readiness scan.
6. On a development store, add explicit opt-in synthetic tests for cart and checkout negotiation.
7. Review AgentCart's own hosted `/api/ai/:slug/ucp` surface. It currently advertises a historical
   `draft` shape. Either upgrade it to genuine UCP 2026-08-25 conformance or label it as an
   Agent Ready compatibility manifest rather than claiming current UCP conformance.

Exit gate:

- A Shopify store's actual native UCP surface is discovered, versioned and reported correctly.
- No current-UCP claim is made for a non-conforming Agent Ready hosted manifest.

## 30.2 OpenAI search, Ads and product-feed readiness

Primary sources:

- https://developers.openai.com/api/docs/bots
- https://developers.openai.com/commerce/specs/file-upload/overview
- https://developers.openai.com/commerce/specs/file-upload/products
- https://openai.com/policies/merchant-feed-terms-of-service/

Verified changes / clarifications:

- `OAI-SearchBot` controls automatic search discovery.
- `OAI-AdsBot` is a separate crawler for ChatGPT ad landing-page validation/relevance.
- `ChatGPT-User` is user-triggered and OpenAI says robots.txt rules may not apply.
- The stable OpenAI discovery feed has nine core required fields:
  `item_id`, `title`, `description`, `url`, `brand`, `seller_name`, `image_url`,
  `availability`, `price`.
- Search eligibility can be controlled separately; checkout and Ads have additional requirements.
- Merchant feed data must remain correct/current and comply with OpenAI commerce policies.

Required Agent Ready work:

1. Keep search, user-fetch, training and advertising crawler states separate.
2. Add an **OpenAI Commerce Feed Readiness** check for ecommerce businesses.
3. Validate the nine core fields from the canonical connected catalogue.
4. Validate variant identity/grouping and explicit availability.
5. Validate feed freshness and price/stock drift against the connected source of truth.
6. Generate a previewable OpenAI feed export; do not upload it without merchant authorization and
   provider credentials.
7. Add OAI-AdsBot robots/WAF/CDN reachability diagnostics as an Ads-readiness check, not a core
   organic-readiness deduction.
8. Add optional Ads measurement readiness for OpenAI Measurement Pixel / Conversions API when a
   merchant actually wants ChatGPT Ads. Keep consent and browser/server event deduplication explicit.

Exit gate:

- Agent Ready can say whether a merchant's catalogue is structurally ready for OpenAI product
  discovery without claiming that OpenAI will display it.
- Ads readiness is reported separately from organic/search readiness.

## 30.3 Algolia MCP / retrieval readiness

Primary source:

- https://www.algolia.com/about/news/algolia-launches-production-grade-mcp-for-agentic-commerce

Verified change:

Algolia launched a production-grade MCP Server for agentic commerce on 2026-09-15. It exposes
product search, facet discovery, catalogue context and retrieval as MCP tools and is intended for
ChatGPT, Claude, Gemini and custom agents. Agent Studio adds safety, domain, rate, tool and token
controls around the same retrieval foundation.

Required Agent Ready work:

1. Detect an existing merchant Algolia integration without requesting permanent admin credentials.
2. Offer an optional authorised Algolia MCP connector when the merchant already uses Algolia.
3. Add AgentPulse read-only discovery/list/search checks against the authorised MCP endpoint.
4. Verify production controls relevant to exposure: approved domains, request/tool limits and
   read/write scope.
5. Do **not** make Algolia a requirement for an Agent Ready score. It is an optional high-quality
   retrieval path, not a universal web standard.

Exit gate:

- Existing Algolia merchants can reuse their live retrieval layer instead of duplicating it in
  Agent Ready.

## 30.4 Google Lighthouse Agentic Browsing

Primary sources:

- https://developer.chrome.com/blog/agent-ready-toolkit
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/registered-webmcp-tools
- https://developer.chrome.com/docs/lighthouse/agentic-browsing/webmcp-schema-validity

Verified change:

Chrome/Lighthouse now exposes an experimental deterministic **Agentic Browsing** category. It checks
agent-relevant accessibility, WebMCP registration/schema quality, layout stability and llms.txt.
Google deliberately reports a fractional pass ratio rather than a 0–100 score while the standard
is still emerging.

Required Agent Ready work:

1. Add a Lighthouse Agentic Browsing adapter where the environment supports it.
2. Import individual audit evidence; do not copy the Lighthouse fraction into Agent Ready's 0–100
   business-readiness score as if they were the same metric.
3. Surface WebMCP registration/schema failures, agent-relevant accessibility failures and CLS as
   separate evidence.
4. Preserve `unknown` when runtime/browser evidence cannot be collected.

Exit gate:

- Agent Ready can compare its result with Google's deterministic agentic-browser checks without
  conflating the two scoring systems.

---

# Phase 31 — Analytics / competitor parity refresh

## 31.1 Cloudflare AEO

Primary source:

- https://blog.cloudflare.com/aeo/

Cloudflare's dashboard now combines Agent Readiness and AEO. Publicly documented AEO metrics include
Citation Rate, Prominence, Mention Rate, Share of Voice and Industry Fit.

Agent Ready already covers citation/mention/share-of-voice style signals. Two meaningful gaps remain:

- **Prominence** — not only whether a brand/source appears, but how early and how much of the answer
  substance is attributable to it.
- **Industry Fit** — category-level co-occurrence/benchmark evidence for whether models place the
  merchant alongside the relevant competitive set.

Required implementation:

1. Store answer-level source spans/coverage sufficient to calculate prominence honestly.
2. Build reusable category benchmark panels instead of rerunning an identical baseline for every
   merchant.
3. Derive Industry Fit only from a sufficiently sized category corpus.
4. Show sample size, model/provider, country and observation window next to both metrics.

## 31.2 Peec Brand Perception

Primary source:

- https://peec.ai/blog/introducing-brand-perception

Peec launched Brand Perception on 2026-09-16. It reports:

- attribute association for a brand;
- market prominence for an attribute;
- evidence/terms behind the association;
- competitor shape/comparison views.

Agent Ready's current perception module detects simple themes and factual conflicts, but that is not
the same capability.

Required implementation:

1. Store extracted brand attributes per atomic prompt run with evidence spans.
2. Calculate an attribute-association score only over a defined corpus/window.
3. Calculate market prominence for the same attribute across competitors.
4. Add competitor comparison/shape output.
5. Keep factual misinformation detection separate; "known for X" and "X is factually true" are
   different questions.

## 31.3 Peec AI referrals / authorised analytics import

Primary source:

- https://peec.ai/blog/introducing-ai-referrals

Peec's AI referrals can connect Google Analytics and show AI-assistant sessions, engagement,
conversions and revenue by assistant, landing page, country and device.

Agent Ready has first-party signed journeys and attribution evidence, which is valuable, but a new
merchant cannot automatically see historical GA traffic and the current analytics layer does not
match all of those referral dimensions.

Required implementation:

1. Add optional GA4 OAuth/import as an **authorised external evidence source**.
2. Normalize assistant/source, session, landing page, country/device, engagement, conversion and
   revenue dimensions.
3. Keep imported analytics provenance separate from signed Agent Ready journey evidence.
4. Never double-count imported GA conversions and verified platform orders.
5. The product should prefer higher-confidence first-party evidence for transaction attribution,
   while still using GA import for historical/referral visibility.

---

# Phase 32 — Agent-interaction security and validation

Primary sources:

- https://developer.chrome.com/docs/agents/security
- https://auspia.ai/blog/agentic-ai-security-website-readiness-model

The market is moving from "can an agent read this?" toward "can an agent safely act here?".

Required Agent Ready work:

1. Extend the existing safety/authorization checks to treat tool names, descriptions, schemas and
   tool outputs as untrusted input.
2. Flag prompt-injection-like instructions inside WebMCP/MCP metadata and returned third-party text.
3. Distinguish read-only tools from mutating tools and require explicit authorization/confirmation
   evidence for consequential actions.
4. Report identity, scope, approval, idempotency and rollback/verification evidence separately.
5. Keep security checks out of the business-readiness score where applicability is unknown; do not
   punish a simple brochure site for lacking transactional security controls it does not need.

Exit gate:

- A site is not called "action ready" merely because a callable tool exists; Agent Ready also has
  evidence that the action boundary is appropriately controlled.

---

# Competitor/status conclusion

## Peec AI

New since the earlier benchmark:

- AI Referrals — 2026-09-11
- Brand Perception — 2026-09-16

Agent Ready already has stronger first-party signed journey concepts and a broader scanner/action
layer, but Peec currently has clearer packaged analytics for GA referrals and brand-attribute market
perception. Those are real parity gaps and are now follow-on build requirements.

## Cloudflare

Cloudflare's August Agent Readiness + AEO expansion is a larger competitive move than a standalone
scanner. Agent Ready covers much of the same ground, but Prominence and Industry Fit should be added
before claiming an analytics superset over Cloudflare as well as Peec.

## Auspia

No September product change found that invalidates the existing SEO/GEO growth-engine plan. Its
recent public material reinforces two directions already in Agent Ready: task-based readiness and
supervised/reviewable growth automation. Its newer security framing supports Phase 32 rather than a
wholesale product change.

## Algolia

This is the most important new infrastructure integration opportunity. The MCP Server release means
Agent Ready should reuse Algolia as an authorised retrieval foundation for merchants that already
have it rather than rebuilding a second search stack.

---

# Release honesty

Phases 18–29 remain implemented against the 2026-09-18 benchmark. The items in this document are
**new post-benchmark work**. They must be shown as `planned` / `not yet live` until code,
tests and production evidence exist.

The Phase 18–29 PR still requires its existing owner actions: remote migration, deployment, real
merchant/provider authorisation and live production verification.
