# Agent Ready market refresh — Phases 33–35

Updated 2026-09-21.

This document records market changes found after the Phase 30–32 implementation and the credential-independent implementation completed from them.

> **Implementation update — 2026-09-21:** Phases 33–35 are now code-ready on `codex/phases-30-32`. Production/provider/browser evidence is still required and no surface is Live. See `docs/PHASES_33_35_IMPLEMENTATION_STATUS.md` and `docs/MUST_COMPLETE_BEFORE_LIVE.md`.

## Phase 33 — AI Shelf Analytics

### Why

Azoma announced investment from dunnhumby Ventures on 2026-09-18 and says its customers include major consumer brands including L'Oréal, Unilever and Mars. Its research over tens of millions of Q2 2026 AI responses found that recommendation evidence differs materially by shopping agent. Azoma reports earned/social citations at 86.5% for Alexa for Shopping and 76% for Walmart Sparky, while ChatGPT drew more heavily on retailer sources.

Primary sources:

- https://www.azoma.ai/insights/azoma-receives-investment-from-dunnhumby-ventures-to-accelerate-its-agentic-commerce-optimization-platform
- https://www.azoma.ai/insights/agentic-commerce-optimisation-azoma-on-what-ai-shopping-agents-check-before-recommending-a-brand

### Agent Ready decision

Do not treat those published percentages as universal ranking weights. They are market evidence that source mix matters and varies by agent.

Agent Ready should measure each merchant's own observed shelf:

- recommendation share by provider/surface/category;
- competitor recommendation share;
- citation source mix by provider/surface;
- source classes: brand-owned, retailer, earned media, UGC/social, reference and other;
- SKU visibility/position/price/source evidence;
- action routing from evidence to owned-site, catalogue or legitimate source opportunity;
- before/after outcome measurement.

### Current status

The credential-independent analytics foundation is now present on the current PR branch:

- `src/analytics/shelf.ts`;
- provider/surface/category recommendation-share aggregation;
- provider/surface-specific source-mix aggregation;
- source classes and explicit caveat against converting market-wide percentages into merchant ranking weights;
- output connected to the existing analytics report.

This is not a claim that Agent Ready already has live automated observations from every shopping agent. Live provider evidence still requires a real authorised/available collection method and production verification.

---

# Phase 34 — Native merchant AI-channel evidence

## 34.1 Google Merchant Center AI Performance

Google now exposes AI performance insights for eligible Merchant Center accounts, including:

- share of voice;
- competitor average share;
- frequency;
- products showing;
- discovery/evaluation/ready-to-buy stages;
- top conversational terms;
- popular attributes;
- search intent.

Current availability is limited by country/language and the report covers organic AI traffic.

Primary source:
https://support.google.com/merchants/answer/17200695

### Required work

- authorised Merchant Center evidence import;
- preserve Google's account/category/country/time-window scope;
- map shopping stages into Agent Ready without pretending Google and Agent Ready metrics are identical;
- route high-frequency terms/missing attributes into catalogue/content actions;
- keep paid and organic evidence separate.

Status: **Code-ready** through a scoped, authorised organic export importer. A live Merchant Center API connection is not claimed.

## 34.2 Conversational product attributes

Google now documents product attributes aimed specifically at conversational shopping experiences, including document links and richer variant data.

Examples:
- https://support.google.com/merchants/answer/17084656
- https://support.google.com/merchants/answer/17085214
- https://support.google.com/merchants/answer/17085297

### Required work

- extend product-data readiness for supported conversational attributes;
- generate recommendations only from verified catalogue/business facts;
- preview changes before authorised Merchant Center writes;
- verify feed acceptance after writes.

Status: **Code-ready** as a verified-fact readiness report and download-free preview. No Merchant Center write is performed.

## 34.3 Shopify Agentic Storefront channel state

Shopify now exposes agentic storefront channels across ChatGPT, Google, Microsoft Copilot and Meta. Some channels support discovery only; some support Shopify-powered direct checkout.

Meta direct checkout has important measurement behaviour: third-party/client-side analytics pixels do not fire in the direct checkout; Shopify records channel attribution and server-side checkout events.

Primary sources:

- https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts
- https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/meta

### Required work

- observe the merchant's Agentic sales-channel state where authorised;
- distinguish discovery vs direct-checkout capability;
- do not infer direct-checkout outcomes from browser pixels that cannot fire;
- use Shopify/channel/server evidence for attribution;
- surface unsupported product/checkout features before enabling a channel.

Status: **Code-ready** for authorised channel-state observations and correct direct-checkout attribution rules. Live channel outcomes are not claimed.

---

# Phase 35 — WebMCP Fix My Site

Detailed plan:

`docs/PHASE_35_WEBMCP_FIX_MY_SITE_BUILD_PLAN.md`

Key product decision:

**WebMCP is not a separate Agent Ready product.**

It becomes one implementation route beneath:

Scan -> Can AI find me? -> Can AI understand me? -> Can AI choose me? -> Can AI do business with me? -> Fix My Site -> Test -> Monitor.

PayPal's current implementation makes this especially concrete: Store Sync + PayPal JS SDK can expose `shopping.*` tools to compatible browser agents while checkout remains with PayPal. Chrome's current WebMCP Imperative API uses `document.modelContext.registerTool(...)`.

Primary sources:

- https://webmcp-store.paypal.com/
- https://developer.paypal.com/community/blog/WebMCP_PayPal_Agent_Ready/
- https://developer.paypal.com/store-sync/overview
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/docs/ai/webmcp/secure-tools

Status: **Code-ready, not Live**. The action mapper, implementation router, reversible WordPress/WooCommerce plugin, generic adapter boundary, PayPal reuse routing, security gate and authorised browser-runtime verification boundary are implemented. A real authorised development-site installation and browser run remain production evidence.

---

# Branding issue discovered

PayPal currently markets an agentic-commerce service named **Agent Ready**.

Primary source:
https://developer.paypal.com/agent-ready/overview/

This creates a real search/brand-confusion risk for this project's current name. It is not, by itself, a legal conclusion.

Before public launch, complete proper trademark/brand clearance and decide whether retaining the name is commercially sensible before spending heavily on public branding and app-store assets.

---

# Current market gate

Completed historical phases remain complete when viewed through their phase-scoped benchmark.

The unscoped current-market benchmark has no remaining credential-independent planned gap through Phase 35. That does not make the release Live: deployment, authorised connections, development-store/site verification and the separate production checklist remain blocking.
