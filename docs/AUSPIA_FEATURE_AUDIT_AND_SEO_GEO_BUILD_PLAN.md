# AgentReady vs Auspia — Feature Audit + SEO/GEO Growth Engine Build Plan

Prepared 2026-09-18 against AgentReady `main` after Phases 13–17 and the Phase 18–21 AI Sales Agent roadmap.

## Why this document exists

Auspia is one of the closest public products to the readiness/GEO side of AgentReady. Its public product combines:

- agent-readiness diagnostics;
- SEO;
- GEO/AEO;
- keyword and competitor opportunity research;
- content planning;
- article generation;
- CMS publishing;
- search-performance measurement;
- recurring strategy adjustment.

AgentReady already goes materially further in several other directions:

- verified fixes and undo;
- merchant platform integration;
- hosted AI layer;
- MCP runtime behaviour;
- AgentPulse synthetic journeys;
- reliability/drift monitoring;
- signed customer journeys;
- lead/order/revenue evidence;
- AI Sales Agent roadmap.

The goal is **not** to copy Auspia. The goal is to close the SEO/GEO/content gap while keeping AgentReady's stronger "fix -> verify -> monitor -> prove outcome" philosophy.

---

# 1. Auspia Agent Readiness audit against AgentReady today

Sources reviewed:

- https://auspia.ai/solutions/agent-readiness
- https://auspia.ai/agent-readiness/zgts.in
- https://auspia.ai/agent-readiness/www.esdeveniments.cat
- https://auspia.ai/blog/auspia-connected-growth-loop
- https://auspia.ai/landing/geo-autopilot
- https://auspia.ai/landing/seo-autopilot

Auspia's public Agent Readiness reports currently group checks into five areas:

1. Agent Discovery
2. Agent Commerce
3. Discoverability
4. Content Accessibility
5. Bot Access Control

The checks observed publicly are listed below.

## Coverage matrix

| Auspia check | Auspia | AgentReady today | Gap / action |
| --- | --- | --- | --- |
| API Catalog | Yes | **No site check** | Add discovery + validation. |
| OAuth/OIDC discovery | Yes | **No site check** | Add well-known OAuth/OIDC discovery checks. |
| OAuth Protected Resource Metadata | Yes | **Standard understood internally, not scanned on merchant site** | Add site discovery/validation. |
| Auth.md | Yes on some reports | **No** | Add optional discovery check, versioned because this is emerging. |
| MCP Server Card | Yes | **No merchant-site card discovery** | Add discovery, schema validation and runtime link to AgentPulse. |
| A2A Agent Card | Yes | **No** | Add discovery/schema validation. |
| Agent Skills index | Yes | **No** | Add discovery/schema validation. |
| WebMCP | Yes | **No** | Add controlled browser/runtime check; static HTML scanner cannot prove navigator APIs. |
| x402 | Yes | **No** | Add optional commerce discovery; never make mandatory. |
| MPP | Yes | **No** | Add optional commerce discovery; never make mandatory. |
| UCP | Yes | **Yes** | AgentReady already fetches/parses `/.well-known/ucp` and publishes a merchant UCP read layer. |
| ACP | Yes | **Protocol support exists, merchant-site discovery check missing** | Add discovery/validation. |
| AP2 | Yes | **No** | Add optional declaration/discovery check. |
| robots.txt | Yes | **Yes** | AgentReady additionally evaluates provider-specific crawler semantics. |
| XML sitemap | Yes | **Yes** | Existing discovery path + platform awareness. |
| useful Link headers | Yes | **Headers fetched, but no dedicated Link relation audit** | Parse RFC 8288 relations and score/report separately. |
| DNS-AID | Seen in Auspia reports | **No** | Add optional DNS discovery check where current spec is trustworthy. |
| Markdown content negotiation | Yes | **No** | Add `Accept: text/markdown` probe on representative pages. |
| AI-specific robots rules | Yes | **Yes** | AgentReady has a stronger provider-purpose model (discovery vs user fetch vs training). |
| Content Signals | Yes | **No dedicated parser** | Add content-usage signal parsing without conflating it with crawler access. |
| Web Bot Auth / JWKS | Yes | **No** | Add optional discovery/validation, versioned in standards registry. |

## Audit result

### AgentReady already covers well

- `robots.txt` with provider-specific user-agent interpretation.
- sitemap discovery.
- UCP discovery and validation.
- `agents.md`, `llms.txt`, and `llms-full.txt` discovery — useful checks Auspia's public Agent Readiness examples do not emphasize in the same way.
- business type applicability so a service business is not penalised for ecommerce protocols.
- page-level product/service/policy/action signals.
- static interaction quality: semantic controls, labels, forms, variants, cart controls, booking/contact controls.
- staged payment/checkout readiness.
- provider region states and honest `unsupported / unknown / not_available_in_region`.
- current MCP runtime compatibility and version handling.
- live/synthetic MCP verification through AgentPulse.
- Fix My Site lifecycle: preview -> approve -> apply -> independently verify -> rescan -> undo.
- platform capability registry.
- Algolia-aware audit.
- signed journey and outcome proof.

### Auspia currently has broader emerging-standard coverage

AgentReady should close these scanner gaps:

1. API Catalog
2. OAuth/OIDC discovery
3. OAuth Protected Resource Metadata
4. Auth.md
5. MCP Server Card
6. A2A Agent Card
7. Agent Skills
8. WebMCP
9. x402
10. MPP
11. ACP discovery
12. AP2
13. Link headers
14. DNS-AID
15. Markdown content negotiation
16. Content Signals
17. Web Bot Auth

### Important design rule

Do **not** copy Auspia by simply adding 17 pass/fail boxes to the Agent Ready score.

AgentReady's stronger model remains:

- is this applicable to this business?
- is it merely declared or actually usable?
- can AgentReady test it?
- can AgentReady fix it?
- can AgentReady verify the fix?
- does it improve a real agent/customer journey?

Presence of a file or protocol is **evidence**, not the business outcome.

---

# 2. Standards Coverage Upgrade

## Goal

Match or exceed Auspia's current public agent-readiness standards coverage without weakening AgentReady's evidence model.

## New discovery module

Add a versioned discovery registry rather than hard-coding every emerging path into the crawler.

Suggested structure:

```ts
interface DiscoveryStandard {
  key: string;
  family: "agent_discovery" | "commerce" | "auth" | "content" | "bot_control";
  currentVersion?: string;
  officialSource: string;
  verifiedOn: string;
  staleAfterDays: number;
  applicability: string[];
  probe: "http" | "header" | "dns" | "browser";
  paths?: string[];
  validator: string;
}
```

The standards registry decides whether a fact is current enough to test confidently.

## Probe classes

### HTTP well-known probes

Add safe bounded probes for supported paths such as:

- API catalog;
- OAuth/OIDC metadata;
- protected-resource metadata;
- Auth.md;
- MCP server cards;
- A2A agent cards;
- agent skill indexes;
- ACP/UCP/AP2/x402/MPP discovery where documented.

### HTTP header probes

Parse:

- RFC 8288 `Link` relations;
- supported content types;
- cache/content-negotiation signals where relevant.

### Markdown negotiation

For the home page plus a small representative sample:

```http
Accept: text/markdown
```

Record:

- status;
- content type;
- whether a meaningful Markdown body is returned;
- whether it corresponds to the canonical page;
- body size;
- no content copied into instructions.

### DNS probes

Only for standards in the versioned registry.

DNS absence remains optional/unsupported unless the business explicitly uses that standard.

### Browser/runtime probes

WebMCP cannot be proven by static HTML alone.

Add a browser/runtime adapter later that records:

- API present/absent;
- advertised tools;
- safe read-only invocation if permitted;
- evidence timestamp.

Until a supported runtime exists, report `unknown`, not fail.

## Definition of done

- Every Auspia public readiness check above has a corresponding AgentReady state or a documented reason it is not currently safe/legitimate to test.
- Optional standards do not reduce the business-first score just for being absent.
- Declared support is separate from runtime-verified support.
- Current specs and evidence dates live in `src/standards/registry.ts`.
- Any stale standard becomes `unknown`.
- Where AgentReady can safely fix a missing artefact, the finding links into Fix My Site.
- Every new check has regression tests and malformed-input tests.

---

# 3. The bigger gap: SEO/GEO Content Optimization

## Current AgentReady position

AgentReady already extracts useful page signals:

- title;
- H1;
- meta description;
- canonical;
- Open Graph;
- JSON-LD and schema types;
- product schema;
- organisation schema;
- breadcrumbs;
- FAQ/Q&A schema;
- text volume;
- image alt coverage;
- price, availability, SKU and variant signals;
- business contact/hours/location evidence;
- action signals.

That is a useful **technical/on-page foundation**.

It is not yet a growth/content system.

AgentReady currently lacks the major capabilities Auspia markets publicly:

- search-demand research;
- keyword opportunity discovery;
- competitor keyword gaps;
- buyer-intent prioritisation;
- prompt research;
- topical clusters;
- content briefs;
- content generation;
- content review workflow;
- CMS publishing;
- Google Search Console measurement;
- indexing/rank/click feedback;
- recurring strategy adjustment;
- citability/evidence optimisation;
- systematic internal-link planning.

This is the area AgentReady needs to upgrade substantially.

---

# 4. How AgentReady can become stronger than Auspia here

Trying to beat Auspia by publishing **more AI articles** is the wrong target.

AgentReady should build an **AI Customer Growth Engine** where SEO/GEO content is connected to the actual commercial journey.

The differentiator:

```text
SEARCH / AI DEMAND
        ↓
BUYER INTENT
        ↓
CONTENT GAP
        ↓
BUSINESS FACTS + REAL OFFER
        ↓
DRAFT / FIX
        ↓
MERCHANT APPROVAL
        ↓
PUBLISH
        ↓
VERIFY INDEXING + AI CITABILITY
        ↓
MEASURE SEARCH + AI VISIBILITY
        ↓
MEASURE LEAD / BOOKING / ORDER
        ↓
LEARN WHAT CONTENT ACTUALLY PRODUCES BUSINESS
```

Auspia publicly emphasizes keyword -> content -> publishing -> rankings/clicks.

AgentReady should extend that to:

> **prompt/keyword -> content -> AI citation/mention -> agent/customer journey -> lead/order/revenue evidence.**

That makes content optimisation part of the same AgentReady control loop.

---

# Phase 22 — SEO + GEO Opportunity Intelligence

## Goal

Identify **what the business should improve or publish next**, prioritised by buyer intent and business value rather than raw traffic volume.

## 22.1 Search opportunity model

Create a normalized opportunity:

```ts
interface GrowthOpportunity {
  id: string;
  shopDomain: string;
  source: "search" | "ai_prompt" | "competitor" | "site_gap" | "customer_question";
  query: string;
  intent: "informational" | "commercial" | "transactional" | "local" | "support";
  funnelStage: "discover" | "compare" | "decide" | "buy" | "support";
  targetEntity?: string;
  targetPage?: string;
  currentCoverage: "good" | "weak" | "missing";
  businessRelevance: number;
  buyerIntent: number;
  evidenceStrength: number;
  opportunityConfidence: number;
  estimatedDifficulty?: number;
  measuredDemand?: number;
}
```

Do not fabricate keyword volume or difficulty.

If no legitimate data source is connected, those values remain unknown.

## 22.2 Prompt research

Reuse Phase 15 AI Visibility query generation.

Expand it into buyer prompt maps:

- "best X for Y";
- "X vs Y";
- "how much does X cost";
- "does X work with Y";
- "who provides X near me";
- "can I get X by Friday";
- "what happens if...";
- service qualification questions;
- purchase objections;
- post-purchase support questions.

This means SEO and AI Sales Agent testing use the **same customer-intent language**.

## 22.3 Keyword/search data connectors

Design adapters, not a hard dependency on one vendor.

Potential legitimate sources:

- Google Search Console for actual impressions/clicks/queries on the merchant's own property;
- optional external SEO data provider;
- merchant-imported CSV;
- public SERP evidence where legally/technically supported;
- manual data.

Every datum stores source + observed date.

## 22.4 Competitor gap

Extend existing observable competitor work.

Compare:

- which questions competitors answer;
- which commercial topics/pages they cover;
- comparison/alternative pages;
- service/location pages;
- product/category coverage;
- FAQ/help content;
- evidence/citations;
- structured data;
- freshness;
- internal linking;
- agent usability.

Do not copy competitor text.

## 22.5 Opportunity prioritisation

Recommended priority inputs:

- buyer intent;
- business relevance;
- existing visibility;
- content gap size;
- AI Visibility gap;
- product/service margin/value where merchant chooses to provide it;
- existing conversion evidence;
- implementation effort;
- freshness urgency.

Do not rank opportunities on search volume alone.

## Phase 22 definition of done

- [ ] One combined keyword + prompt + competitor opportunity queue.
- [ ] Every opportunity has evidence and source/date.
- [ ] Buyer/commercial intent is explicit.
- [ ] No invented search volume/difficulty.
- [ ] AI Visibility queries and SEO opportunities share one intent model.
- [ ] Merchant can approve/ignore opportunities.
- [ ] Existing pages are preferred for improvement when creating another page would cause cannibalisation.

---

# Phase 23 — Content Intelligence, Generation and Fix My Content

## Goal

Turn an approved opportunity into **better existing content or a new page**, grounded in merchant facts, optimised for both classic search and AI answer systems.

## 23.1 Page intelligence audit

Add page-level checks for:

### Search intent

- page type matches query intent;
- title/H1/topic alignment;
- duplicate/cannibalising pages;
- useful internal links;
- canonical/indexability;
- content freshness.

### Answer readiness / GEO

- direct answer block where appropriate;
- concise definitional answer;
- question/answer coverage;
- clear entity names;
- explicit prices/constraints where authoritative;
- comparison tables where useful;
- structured lists;
- citeable factual statements;
- source/provenance links where applicable;
- dates/freshness;
- unsupported marketing claims;
- contradictions with canonical Business Brain.

### Trust

- business identity;
- author/editor attribution where relevant;
- first-party evidence;
- case studies/results only when supportable;
- policy/support/contact links;
- qualifications/accreditations only when verified.

### Conversion

- relevant next action;
- product/service link;
- quote/book/contact/cart handoff;
- no dead-end informational content.

## 23.2 Content Brief Engine

Before generating copy, produce a structured brief:

- target query/prompt cluster;
- intent;
- customer problem;
- existing page vs new page decision;
- canonical merchant facts;
- entities/products/services to include;
- questions to answer;
- evidence/citations available;
- prohibited/unverified claims;
- internal links;
- desired conversion action;
- schema suggestions;
- verification plan.

The brief is the contract. The writer cannot invent facts outside it.

## 23.3 Grounded content generation

Use the future Business Brain from Phase 18 as the factual source.

Generated content must retain a fact map:

```text
sentence/claim -> business fact/source -> confidence -> approval status
```

Any unsupported factual claim is flagged before publishing.

## 23.4 Content types

Support more than blog posts:

- existing-page refresh;
- product/category content;
- service landing pages;
- local/service-area pages when genuinely served;
- comparison pages;
- alternative pages;
- buyer guides;
- FAQ/help;
- integration/setup guides;
- use-case pages;
- glossary/definition pages;
- evidence/case-study pages;
- policy/support improvements.

Do not create doorway pages or fake local pages.

## 23.5 Fix My Content lifecycle

Reuse Fix My Site principles:

```text
Opportunity
 -> Brief
 -> Draft
 -> Fact check
 -> SEO/GEO validation
 -> Preview
 -> Merchant approval
 -> Publish
 -> Fetch live page
 -> Verify exact publication
 -> Rescan
 -> Measure
 -> Undo/version restore
```

## 23.6 CMS adapters

Extend the existing platform registry.

Priority:

1. WordPress/WooCommerce
2. Shopify pages/blog
3. Webflow
4. supported custom CMS/API
5. manual export where no safe write integration exists.

A CMS connection is not permission to publish without the merchant's configured approval policy.

## Phase 23 definition of done

- [ ] Existing-page improvement is supported before defaulting to new articles.
- [ ] Briefs are grounded in canonical business facts.
- [ ] Unsupported claims are blocked before publication.
- [ ] Merchant preview/approval exists.
- [ ] Publishing is adapter-based and reversible/versioned.
- [ ] Live page is independently fetched after publication.
- [ ] SEO/GEO checks rerun on the real published page.
- [ ] Internal links and conversion actions are validated.
- [ ] No fabricated local/service pages or fake evidence.

---

# Phase 24 — Search + AI Growth Measurement and Learning Loop

## Goal

Prove whether content improvements produce **visibility and business outcomes**, then choose the next action from evidence.

## 24.1 Search Console integration

Where the merchant authorizes it, ingest page/query metrics:

- impressions;
- clicks;
- CTR;
- average position;
- indexing status where supported;
- page/query mapping;
- date window.

Keep Search Console observations separate from external rank-provider estimates.

## 24.2 AI visibility integration

Reuse Phase 15:

- mention rate;
- citation rate;
- recommendation rate;
- factual accuracy;
- selected/task-completed evidence where available.

Track content version/time so before/after comparisons are valid.

## 24.3 Content outcome linkage

Attach content/page context to signed journeys where possible.

Report separately:

- search impressions;
- search clicks;
- AI mentions/citations;
- page visits;
- AI agent interactions;
- enquiries;
- bookings;
- orders;
- verified revenue.

Never claim a page caused revenue merely because it existed in the path.

Use evidence tiers and controlled experiments for stronger claims.

## 24.4 Learning engine

Classify content into observable states such as:

- not indexed / unknown;
- indexed but no impressions;
- impressions but weak clicks;
- traffic but low engagement/outcome;
- AI-visible but no handoff;
- converting;
- stale/declining;
- cannibalising another page;
- unsupported measurement.

Suggested actions:

- technical fix;
- title/description improvement;
- answer-block improvement;
- add missing factual evidence;
- internal-link improvement;
- refresh;
- merge pages;
- redirect;
- expand topic;
- stop investing.

No automatic deletion or redirect without merchant approval.

## 24.5 Controlled growth experiments

Use Phase 17 experiment infrastructure.

Examples:

- add a direct-answer block;
- improve comparison table;
- add verified pricing;
- strengthen internal linking;
- rewrite title;
- add structured FAQ;
- add a clearer quote/book CTA.

Record hypothesis, page set, time window, metric and result.

## Phase 24 definition of done

- [ ] Search performance connected where merchant authorizes it.
- [ ] Search and AI visibility remain separate evidence types.
- [ ] Content versions map to measurement windows.
- [ ] Page-level leads/orders can be attached where defensible.
- [ ] Learning recommendations explain why they exist.
- [ ] No causation without experimental evidence.
- [ ] Winning topics can inform new opportunity discovery.
- [ ] Weak content is improved/merged before endless article production.

---

# 5. How this becomes stronger than Auspia

The target is not "more features on a checklist."

AgentReady should compete on the closed loop.

## Auspia public loop

```text
Discover
 -> Ground
 -> Create/review
 -> Publish
 -> Measure
 -> Improve
```

## AgentReady target loop

```text
Understand the business
 -> Find search + AI buyer demand
 -> Find content/readiness gaps
 -> Ground in the canonical Business Brain
 -> Improve existing page OR create the right page
 -> Fact-check every business claim
 -> Merchant preview/approval
 -> Publish
 -> Independently verify the live page
 -> Rescan SEO + GEO + Agent Readiness
 -> Test AI visibility
 -> Test agent/customer journeys
 -> Measure search + AI + lead/order/revenue evidence
 -> Learn what actually works
 -> Feed the result into the next opportunity
```

## Specific areas where AgentReady can be stronger

### 1. One Business Brain

SEO content, AI-facing data and the AI Sales Agent all use the same approved facts.

This reduces contradictions between:

- website content;
- product catalogue;
- policies;
- AI profile;
- sales agent;
- generated content.

### 2. Fix + verify rather than "recommend"

A recommendation is not complete until AgentReady can show:

- what changed;
- the live page contains it;
- the relevant check improved;
- it did not break other checks;
- it can be undone/versioned.

### 3. Content tied to AI Sales behaviour

If customers repeatedly ask the Sales Agent a question the website cannot answer, that becomes a content opportunity.

Real conversation gaps can create SEO/GEO work.

Example:

```text
27 customers ask: "Do you cover Brighton?"
 -> Business Brain says yes
 -> site has no Brighton service page / service-area explanation
 -> growth opportunity created
 -> merchant-approved service-area content
 -> publish
 -> AI visibility + lead outcome tracked
```

This is a stronger feedback loop than generic keyword generation.

### 4. Business outcomes, not just clicks

Content success should eventually include:

- qualified lead;
- quote;
- booking;
- cart/order;
- verified revenue;

while preserving honest evidence tiers.

### 5. Existing-page-first optimization

Do not win by producing 30+ generic posts a month.

Prefer:

- fix the page already ranking;
- resolve contradictions;
- improve direct answers;
- add evidence;
- improve internal links;
- improve conversion path;
- consolidate cannibalising pages.

Only create a new page when there is a genuine intent/content gap.

### 6. SEO + GEO + Agent readiness + Sales Agent in one intent model

One customer question can drive:

- an SEO opportunity;
- a GEO visibility query;
- a Sales Agent scenario;
- a content brief;
- a conversion journey test.

That shared intent graph is a meaningful architectural advantage.

---

# 6. Recommended implementation order

Do not let SEO/GEO work derail the current production gate or the Business Brain foundation.

Recommended sequence:

1. Finish Phase 13–17 production verification.
2. Build Phase 18A Business Brain.
3. Add the **Standards Coverage Upgrade** so AgentReady matches/exceeds Auspia's scanner breadth.
4. Build Phase 22 opportunity intelligence.
5. Build Phase 23 page/content audit + briefs + existing-page fixes first.
6. Add WordPress/WooCommerce publishing adapter.
7. Add Shopify content publishing where safe.
8. Build Phase 24 Search Console + AI Visibility measurement loop.
9. Connect Phase 19 conversation failures/customer questions into Phase 22 opportunities.
10. Add optional automated publishing policies only after the review/fact-check/rollback system is proven.

---

# 7. Immediate first PRs

## PR A — readiness parity

Implement the lowest-risk missing checks first:

- Link header parsing;
- Markdown content negotiation;
- OAuth/OIDC discovery;
- protected-resource metadata;
- MCP Server Card;
- API Catalog;
- A2A Agent Card;
- Agent Skills.

Then add:

- content signals;
- Web Bot Auth;
- ACP/AP2/x402/MPP;
- DNS-AID;
- runtime WebMCP.

Every standard needs a verified source/date in the registry before it can produce a confident result.

## PR B — SEO/GEO Page Intelligence v1

Add deterministic page diagnostics for:

- intent/topic alignment;
- title/H1/meta quality;
- canonical/indexability;
- structured data;
- direct-answer readiness;
- question coverage;
- explicit factual claims vs Business Brain;
- evidence/source links;
- freshness;
- internal links;
- useful conversion action;
- duplicate/cannibalisation candidates.

No LLM required for the deterministic first layer.

## PR C — Growth Opportunity model

Unify:

- Phase 15 AI prompts;
- site content gaps;
- merchant customer questions;
- competitor observable gaps;
- Search Console queries when later connected.

This becomes the queue that drives content work.

---

# Final product direction

AgentReady should not become "Auspia plus one more scanner."

The stronger destination is:

> **AgentReady finds where a business is losing AI/search customers, fixes the underlying website/business information, creates or improves the content that is actually missing, verifies the live change, tests whether humans and AI agents can use it, and measures whether it produced visibility, leads, bookings, orders or revenue.**

That keeps SEO/GEO content optimisation inside the same product thesis:

> **Make the business work as an AI customer-acquisition channel — then prove it.**
