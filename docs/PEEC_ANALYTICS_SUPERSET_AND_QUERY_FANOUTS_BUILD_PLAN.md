# AgentReady vs Peec AI — Analytics Superset + Query Fanouts Build Plan

> **Implementation update — 2026-09-18:** Phases 25–29 now have atomic prompt observations, visibility/position/SoV/sentiment metrics, observed-vs-synthetic fanouts, source/citation data, crawl/perception evidence, SKU shopping checks, analytics actions, CSV export and authenticated MCP/API foundations on `codex/phases-18-29`. Provider data still remains unavailable until legitimately connected. See `docs/PHASES_18_29_IMPLEMENTATION_STATUS.md`.

Prepared 2026-09-18 against AgentReady current main and Peec AI's public product/documentation.

## Product rule

Peec AI becomes a **mandatory analytics benchmark**.

AgentReady must not knowingly ship materially weaker AI-search analytics than Peec on any legitimate, reproducible capability that matters to customers.

The target is:

> **Peec-level or better measurement + AgentReady execution, verification, reliability, Business Brain, AI Sales Agent and business-outcome proof.**

This document does not require copying Peec's implementation method. It requires matching or exceeding the useful customer capability.

---

# 1. Peec analytics benchmark

Peec currently publicly documents the following major capabilities:

- visibility / mention frequency;
- average brand position;
- sentiment;
- share of voice;
- daily custom-prompt tracking;
- suggested prompts;
- source and citation analytics;
- source-gap analysis;
- query fanouts;
- chat features such as web search, shopping, maps, ads and product comparison;
- brand insights by topic, model, geography and competitor;
- crawlability against 40+ AI bots;
- real AI-bot crawl logs / crawl insights;
- AI shopping analytics at SKU level;
- quoted AI price vs catalogue price;
- product win rate and co-featured competitors;
- shopping query fanouts;
- prioritized Actions;
- referrals / sessions / engagement / conversions / revenue;
- exports, API and MCP access.

AgentReady already has foundations for some of these:

- non-branded visibility query sets;
- mentioned / cited / recommended / selected / task-completed / attributed outcomes;
- average position;
- share of voice;
- competitor configuration;
- observable competitor comparison;
- why-losing report;
- provider provenance;
- AI referral detection;
- signed journeys;
- order / revenue evidence tiers;
- AgentPulse reliability;
- platform and readiness evidence.

The gap is depth, provider coverage, source/citation intelligence, fanouts, sentiment/perception, crawl logs, shopping analytics and richer analytics UX.

---

# 2. Mandatory analytics parity matrix

Maintain a versioned benchmark table exactly as the scanner benchmark does.

Each Peec capability must be one of:

- `stronger`
- `covered`
- `planned`
- `unsupported_by_provider`
- `intentionally_not_applicable`

A capability may not be marked `covered` merely because a database field exists. It must be usable end-to-end in the dashboard/API.

A `planned` Peec capability is a release blocker for the **AI Analytics Superset** milestone.

## Required floor

AgentReady must support at least:

1. Visibility
2. Position
3. Sentiment
4. Share of Voice
5. Prompt tracking
6. Prompt suggestions
7. Citation analytics
8. Source analytics
9. Source gap analysis
10. Query fanouts
11. Chat feature detection
12. Brand perception
13. Cross-model comparison
14. Geography comparison
15. Topic comparison
16. Competitor comparison
17. Crawlability
18. Observed bot crawl analytics
19. AI Shopping visibility
20. Product win rate
21. Quoted price vs canonical price
22. Product competitor co-occurrence
23. Shopping fanouts
24. AI referrals
25. Conversion / revenue reporting
26. Action recommendations
27. API / MCP access
28. Export-ready analytics

Then AgentReady goes beyond this with:

- Fix My Site / Fix My Content execution;
- independent verification;
- AgentPulse;
- Path to 100;
- Business Brain;
- Sales Agent conversation testing;
- signed journeys;
- evidence-tier outcomes;
- controlled experiments.

---

# 3. Query Fanouts — plain-English product definition

A customer might ask:

> "What are the best waterproof walking shoes under £150?"

An AI system may not search the web using that exact sentence once.

It may break the request into several background searches such as:

- "best waterproof trail shoes UK 2026"
- "GTX walking shoes under £150 reviews"
- "waterproof hiking shoes comparison"
- "Trail Runner GTX price"
- "best gore-tex walking shoes"

Those secondary/background searches are **query fanouts**.

They matter because a business can answer the customer's original question perfectly but still fail to appear if its pages do not match the actual sub-queries the AI uses to research the answer.

The useful question for the merchant is therefore not just:

> "What did the customer ask?"

but:

> **"What did the AI go looking for before it decided what to recommend?"**

That fanout data can reveal:

- comparison intent;
- review intent;
- freshness/year terms;
- attributes the AI cares about;
- brands inserted by the AI;
- price thresholds;
- local/geographic terms;
- shopping-specific searches;
- third-party sources the AI expects to find.

---

# 4. Query Fanouts — evidence model

There must be two completely separate fanout types.

## 4.1 Observed provider fanouts

These are fanout/search queries actually exposed by the AI provider, its supported interface, or a legitimately collected provider trace.

Store:

- provider;
- model/surface;
- parent prompt;
- exact observed fanout query;
- type: search / shopping / other;
- geography / locale;
- observed timestamp;
- evidence method;
- evidence reference;
- run id.

These may be called **Observed Fanouts**.

## 4.2 AgentReady synthetic fanouts

AgentReady can generate likely sub-queries itself to help plan content and testing even when a provider does not expose its real fanouts.

These are useful immediately, but they must be labelled:

> **Synthetic / planning fanouts — not observed provider behaviour.**

Never mix observed and synthetic fanouts in one metric.

This gives AgentReady a valuable feature before every provider offers trace access without lying about hidden model behaviour.

---

# 5. Query Fanouts — implementation

## Data model

Add equivalent entities:

```text
visibility_prompt_runs
visibility_fanouts
visibility_sources
visibility_citations
visibility_chat_features
```

A fanout row should include:

```ts
interface FanoutObservation {
  id: string;
  runId: string;
  queryId: string;
  provider: string;
  model?: string;
  source: "observed_provider" | "manual_observed" | "agentready_synthetic";
  type: "search" | "shopping" | "other";
  query: string;
  locale?: string;
  country?: string;
  occurrenceCount: number;
  evidenceRef?: string;
  observedMs: number;
}
```

## Provider adapter capability contract

Extend visibility providers:

```ts
interface VisibilityProviderCapabilities {
  responses: boolean;
  sources: boolean;
  citations: boolean;
  fanouts: boolean;
  sentiment: boolean;
  shopping: boolean;
  chatFeatures: boolean;
}
```

A provider that does not expose fanouts reports `fanouts:false`.

No inferred value is substituted.

## Collection routes

Allowed collection methods:

1. official provider API;
2. provider-supported export / trace data;
3. authorised first-party merchant/server logs;
4. controlled manual evidence;
5. provider UI automation only when terms and access legitimately permit it.

AgentReady must not silently scrape a consumer UI where doing so violates provider terms.

## Synthetic expansion engine

Build a planning engine that derives likely fanout themes from:

- customer prompt;
- Business Brain facts;
- category;
- geography;
- price;
- product attributes;
- comparison intent;
- freshness;
- competitor names;
- purchase stage.

Example synthetic expansion:

```text
Prompt:
best accountant for a small construction company in Brighton

Synthetic planning fanouts:
- construction accountants Brighton
- small business accountant Brighton reviews
- accountant CIS scheme Brighton
- construction industry bookkeeping accountant
- best accountant for trades Brighton 2026
```

These can immediately feed Phase 22 Growth Opportunities.

---

# 6. Fanout analytics dashboard

Provide:

## Fanout coverage

- distinct observed fanout queries;
- total occurrences;
- search vs shopping split;
- provider/model;
- topic;
- prompt.

## Repeated terms

Show terms/phrases commonly injected by AI systems.

Examples:

- "reviews"
- "comparison"
- "2026"
- "near me"
- "best"
- "pricing"

## Brand injection

Show brands that appear in fanouts even when the original prompt did not name them.

## Fanout coverage gap

For every fanout:

```text
Does our business have a strong relevant page/product/source for this search?
```

States:

- covered strongly;
- weak coverage;
- missing;
- competitor stronger;
- third-party source required;
- not applicable.

## Fanout -> action

Each actionable gap creates a Growth Opportunity.

Example:

```text
Observed fanout:
"waterproof trail shoes comparison"

Your coverage:
weak

Competitor coverage:
strong

Action:
Improve category comparison content

AgentReady can:
Create brief -> draft -> fact-check -> preview -> publish -> verify
```

This is where AgentReady should become stronger than Peec.

---

# 7. Visibility Analytics v2

Upgrade the current `src/aeo/` model.

## 7.1 Atomic prompt run

Store every provider execution as an atomic observation:

- prompt;
- provider;
- model;
- country;
- locale;
- device/surface if observable;
- account/personalization state if controlled;
- response timestamp;
- response hash;
- sources;
- citations;
- brands/entities mentioned;
- ordering;
- recommendations;
- sentiment;
- chat features;
- fanouts;
- method/provenance.

Aggregate dashboards must be derived from these rows.

## 7.2 Visibility

```text
responses mentioning subject / valid prompt runs
```

## 7.3 Position

Average position among all brands/entities observed, not merely preselected competitors.

## 7.4 Share of Voice

Calculate against all recognised relevant brands in the measured answer set, with a separate configured-competitor view.

Do not let a limited competitor list make position look artificially better.

## 7.5 Sentiment

Add positive / neutral / negative and bounded score.

Store the evidence span/theme that drove the classification.

Sentiment is an evaluated metric, not a hard fact.

## 7.6 Recommendation rate

Retain AgentReady's existing distinction between:

- mentioned;
- cited;
- recommended;
- selected;
- task completed;
- attributed.

This is already stronger than collapsing everything into visibility.

---

# 8. Source and Citation Intelligence

## Required views

- top cited domains;
- top cited URLs;
- top accessed source domains where observable;
- owned-domain citation share;
- competitor citation share;
- citation frequency by prompt/topic/provider;
- source freshness;
- source type.

Classify sources:

- owned;
- editorial;
- corporate;
- UGC/community;
- reference/directory;
- marketplace;
- other.

## Source Gap

Find sources that:

- influence target prompts;
- mention/cite competitors;
- do not represent the merchant.

Then create an action category:

- improve owned content;
- PR/editorial outreach;
- directory/reference correction;
- authentic community/review presence;
- product feed/catalog improvement.

Never automate spam or fake reviews.

---

# 9. Chat Feature Analytics

For each observed response, record where supported:

- web search used;
- shopping used;
- product comparison used;
- maps/local used;
- ads shown;
- citations shown.

Dashboard example:

```text
"best emergency plumber Brighton"
82% web search
44% maps/local
0% shopping
18% ads
```

This helps identify what type of surface the business must win.

---

# 10. Brand Perception

Build a perception layer that answers:

- what attributes are repeatedly associated with us?
- what strengths?
- what weaknesses?
- what misconceptions?
- which claims conflict with Business Brain facts?
- how does this differ from competitors?
- how does it change over time?

Separate:

- observed response language;
- model-evaluated theme;
- verified business fact.

Add **Misinformation Alerts** when an AI answer conflicts with an authoritative Business Brain fact.

This is a stronger link than ordinary sentiment.

---

# 11. Crawl Analytics v2

Peec's server-log analytics are an important benchmark.

AgentReady should add first-party bot observation.

## Inputs

Support adapters for:

- Cloudflare logs / Worker integration;
- Vercel log drain;
- generic signed webhook;
- WordPress plugin;
- uploaded CLF/CSV;
- other adapters later.

## Record

- bot/user-agent;
- provider;
- bot purpose;
- URL/path;
- status;
- latency where known;
- timestamp;
- bytes where known;
- error state.

## Correlation view

Connect:

```text
robots allowed?
 -> bot actually visited?
 -> page returned successfully?
 -> page used as an observed source?
 -> page cited?
 -> brand mentioned/recommended?
```

That turns raw crawler logs into a diagnostic chain.

---

# 12. AI Shopping Analytics

For connected catalogues:

## Product metrics

- product visibility;
- win rate;
- position;
- share of voice;
- prompts won;
- prompts lost;
- co-featured competitors;
- observed quoted price;
- canonical Business Brain price;
- price mismatch;
- attributes AI uses in comparison;
- shopping source URLs;
- shopping fanouts.

## AgentReady advantage

A price mismatch should not stop at an alert.

Route it through:

```text
AI quoted £139
Business Brain says £129
 -> identify source carrying stale price
 -> determine whether owned source can be fixed
 -> Fix My Site / feed action
 -> verify new public price
 -> rerun shopping prompt
 -> confirm whether mismatch disappeared
```

---

# 13. AI Referrals and Revenue

Peec now connects GA data to sessions, engagement, conversions and revenue.

AgentReady must match those useful views, but preserve its stronger evidence model.

## Required referral views

- sessions from AI assistants;
- landing pages;
- provider;
- country;
- device where available;
- engagement;
- leads;
- bookings;
- orders;
- revenue.

## Evidence tiers

Continue separating:

- verified platform outcome;
- signed AgentReady journey;
- identifiable referral;
- browser-reported;
- assisted;
- unknown.

Do not combine them into a single number that overstates certainty.

---

# 14. Recommendations -> execution

Peec Actions is a useful baseline.

AgentReady Actions must go further.

Every analytics gap should create one of:

- Fix My Site;
- Fix My Content;
- Business Brain correction;
- citation/source opportunity;
- feed/catalog correction;
- Sales Agent configuration fix;
- platform/provider dependency;
- manual business task.

Each action should include:

- evidence;
- expected metric affected;
- confidence;
- owner;
- preview;
- execution route;
- verification;
- rollback where possible;
- retest.

---

# 15. Analytics dimensions and filters

Match/exceed Peec with filters for:

- provider;
- model;
- prompt;
- topic;
- category;
- funnel stage;
- country;
- locale/language;
- device/surface where observable;
- brand;
- competitor;
- product/SKU;
- source domain;
- source type;
- date range;
- evidence method.

Add AgentReady-specific filters:

- readiness score range;
- fix state;
- AgentPulse health;
- Business Brain freshness;
- Sales Agent scenario;
- outcome evidence tier.

---

# 16. Analytics dashboard structure

Recommended merchant tabs:

## AI Visibility

- visibility;
- position;
- share of voice;
- sentiment;
- recommendations.

## Prompts

- tracked prompts;
- topics;
- prompt suggestions;
- volume/demand where legitimately sourced;
- fanouts.

## Sources

- domains;
- URLs;
- citations;
- source gaps.

## Perception

- strengths;
- weaknesses;
- misinformation;
- competitor perception.

## Shopping

- SKU visibility;
- win rate;
- quoted price;
- competitors;
- shopping fanouts.

## Crawlers

- allowed bots;
- actual bot visits;
- errors;
- paths;
- source/citation correlation.

## Referrals

- sessions;
- landing pages;
- conversions;
- revenue.

## Actions

- what AgentReady recommends;
- what it can fix;
- what is waiting;
- impact after fix.

---

# 17. Statistical honesty / noise

AI answers vary.

Do not treat one run as a stable ranking.

Store repeated observations over time and surface:

- sample size;
- run frequency;
- provider/model;
- geography;
- variability;
- confidence band or stability indicator where statistically defensible.

Do not claim a change from 41% to 44% is meaningful if run noise is larger than the movement.

---

# 18. How AgentReady becomes better than Peec

Peec's analytics should be treated as the **floor**, not the differentiator.

AgentReady should win by connecting every layer:

```text
Visibility falls
 -> find affected prompts
 -> inspect fanouts
 -> inspect source/citation gaps
 -> check crawler access and real bot visits
 -> compare business/content/readiness
 -> identify exact cause candidates
 -> create executable fix
 -> merchant approves where needed
 -> publish/apply
 -> independently verify
 -> rerun the same prompts
 -> measure visibility lift
 -> observe customer journeys
 -> prove leads/orders/revenue where possible
```

Additional AgentReady advantages:

1. **Path to 100** technical readiness.
2. **Fix My Site**.
3. **Fix My Content**.
4. **Business Brain** factual grounding.
5. **AgentPulse** runtime reliability.
6. **AI Sales Agent**.
7. **Conversation regression tests**.
8. **Signed journey attribution**.
9. **Evidence-tier revenue**.
10. **Controlled experiments**.

---

# 19. Implementation phases

## Phase 25 — Visibility Analytics v2

- atomic prompt-run store;
- all-brand entity extraction;
- visibility / position / SoV;
- sentiment;
- source/citation tables;
- provider/model/geography filters;
- trend history;
- API + MCP analytics tools.

## Phase 26 — Query Fanouts + Source Intelligence

- observed fanout ingestion contract;
- synthetic planning fanouts;
- Search / Shopping / Other classification;
- topic clustering;
- repeated terms;
- brand injection;
- source gap;
- fanout -> Growth Opportunity integration.

## Phase 27 — Crawl Insights + Perception

- first-party server-log adapters;
- crawler visits/failures;
- crawler -> source -> citation chain;
- perception themes;
- misinformation detection against Business Brain.

## Phase 28 — AI Shopping Analytics

- SKU-level metrics;
- win rate;
- position;
- quoted price mismatch;
- competitor co-occurrence;
- product attributes;
- shopping sources;
- shopping fanouts;
- fix/retest loop.

## Phase 29 — Referral + Analytics Action Engine

- richer referral/session dimensions;
- GA connector where useful;
- retain first-party AgentReady attribution;
- analytics Actions;
- route Actions to Fix My Site / Fix My Content / Sales Agent;
- before/after measurement;
- controlled experiments.

---

# 20. Definition of done — Analytics Superset milestone

The milestone is complete only when:

- every legitimate current Peec analytics capability is `covered` or `stronger`;
- no benchmark item remains `planned`;
- AgentReady can track visibility, position, sentiment and SoV;
- source/citation intelligence is URL-level and domain-level;
- query fanouts have observed vs synthetic provenance;
- chat features are recorded where observable;
- crawlability and observed crawler traffic are separate;
- product/SKU analytics exist for ecommerce;
- quoted AI prices are checked against canonical price;
- referrals and downstream outcomes are visible;
- every recommendation has an execution/remediation route;
- fixes can be verified and retested;
- analytics data is accessible in dashboard, API and MCP;
- sample size/provenance/noise are visible;
- AgentReady can show before/after measurements without claiming causation where it cannot prove it.

The final objective is:

> **Anything Peec can tell you, AgentReady should be able to tell you too — where legitimate access exists — and then AgentReady should help you actually change the business, verify the change and measure whether it produced customers.**
