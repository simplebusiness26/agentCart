# AgentCart — Phase 12: Agent Standards, AEO & Agent-Callable AgentCart

> Mandatory strategic continuation after `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE.md`, `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE_ADDITIONS.md`, and `CLAUDE_AGENT_READY_MVP_PHASE_11_PRODUCTION_LAUNCH_GATE.md`.
>
> Phase 10 proves deeper agentic-commerce compatibility. Phase 11 proves the MVP on real infrastructure. Phase 12 must widen AgentCart from a readiness scanner into the business operating layer for AI customers.
>
> **Do not turn AgentCart into a smaller copy of Cloudflare Agent Readiness.** Use public/open agent standards as compatibility targets, but keep AgentCart differentiated around business outcomes: can AI find the business, understand it, recommend it, act with it, and produce measurable customers/revenue?

---

# 12.0 Product position — NON-NEGOTIABLE

AgentCart's product promise remains:

> **Make your business ready for AI customers.**

The core questions are, in this order:

1. **Can AI find me?**
2. **Can AI understand me?**
3. **Can AI recommend me?**
4. **Can AI buy, book, reserve, enquire or otherwise act with me?**
5. **Can AgentCart fix what is preventing that?**
6. **Can AgentCart prove whether AI produced customers and revenue?**

Technical standards are evidence that helps answer those questions. They are not the product by themselves.

### Product layers

Keep these as distinct but connected layers rather than forcing every signal into one confusing score:

1. **Business Readiness** — existing Agent Ready business-focused score and capability model.
2. **Agent Standards** — protocol/discovery/content/authentication compatibility.
3. **AI Visibility / AEO** — whether real assistants mention, cite, rank or recommend the business.
4. **Verified Agent Journeys** — whether safe real/test agent journeys actually succeed.
5. **AI Customers & Revenue** — attributable traffic, enquiries, bookings, purchases and verified revenue.

The dashboard may summarize these together, but the data and scoring must stay separable and versioned.

---

# 12.1 Preserve the existing business-first scanner

Do not replace the current scanner with a generic standards checklist.

The existing business-focused checks remain the primary owner-facing readiness layer because they answer practical questions such as:

- Can AI identify the business?
- Can AI understand products/services?
- Can AI read price, stock and variants?
- Can AI find delivery, returns, cancellation and other policies?
- Can AI find contact, quote and booking routes?
- Can AI reach cart/checkout or another relevant action?

### Mandatory scoring rule

Continue to distinguish `pass`, `partial`, `fail`, `unknown`, `not applicable`, `unsupported`, and `not available in region` where appropriate.

A roofer, cleaner or hairdresser must not be penalized because it does not expose ecommerce-only protocols. An ordinary store must not fail simply because it lacks a protocol that is optional while a genuinely usable browser-agent journey works.

Do not let Phase 12 make the original Agent Ready score less understandable.

---

# 12.2 Add a separate Agent Standards diagnostic layer

Build a provider-neutral standards registry and scanner that can evaluate public/open agent-facing standards independently from Business Readiness.

Before implementing any version-specific rule, re-check current official specifications and authoritative provider documentation. These standards are moving quickly.

### Initial diagnostic groups

#### Discoverability

Support evidence-based checks for at least:

- `robots.txt`;
- sitemap discovery;
- HTTP `Link` response headers relevant to machine discovery;
- DNS-based AI discovery / DNS-AID where a current public specification exists and is implementable;
- canonical discovery signals already used by AgentCart.

#### Agent-friendly content

Support at least:

- Markdown content negotiation using `Accept: text/markdown`;
- useful machine-readable content returned for that negotiation;
- `llms.txt` as an optional discovery/content aid;
- `llms-full.txt` where applicable;
- `agents.md` from Phase 10.

Do not treat `llms.txt` alone as proof of agent readiness.

#### Bot access and identity

Support at least:

- provider/user-agent-specific crawler rules;
- AI usage/content signals where a current public standard is available;
- Web Bot Auth or equivalent cryptographic bot/agent verification where officially specified;
- separation of search/discovery access from training-only access.

Blocking an AI training crawler by merchant choice must not automatically mean the business is not ready for AI customers.

#### API, authentication and protocol discovery

Support evidence-based checks for at least:

- API Catalog discovery where standardized;
- OAuth Authorization Server Metadata;
- OAuth Protected Resource Metadata;
- `auth.md` where a current public convention/specification exists;
- MCP Server Card / well-known MCP discovery;
- A2A Agent Card;
- Agent Skills discovery/index;
- WebMCP;
- ARD/agent-resource-discovery manifest where current documentation supports it.

#### Commerce

Keep Phase 10/11 UCP and ACP support and extend the registry to detect, where current public standards permit:

- x402;
- MPP;
- UCP;
- ACP;
- provider-native agentic storefront capabilities;
- ordinary browser/web checkout as the important fallback.

### Architecture

Create one versioned standards registry with fields such as:

- standard/check id;
- display name;
- category;
- applicable business/site types;
- discovery method;
- current supported versions;
- evidence parser/validator;
- severity/business impact;
- fix type;
- official reference metadata/version/date where practical;
- scoring participation flag.

Do not scatter names/version assumptions across route handlers.

### Output

Each check should return:

- status;
- evidence;
- what it means in plain English;
- business impact;
- technical detail;
- fix path;
- whether AgentCart can fix it;
- documentation/rule version where useful.

---

# 12.3 Business/site-type profiles and applicability

A generic `All checks` mode may exist, but normal users should get a profile suited to the business.

Support at least these initial profiles:

- **Local / service business**;
- **Ecommerce / retail**;
- **Content / publisher**;
- **SaaS / API / application**;
- **Custom / all checks**.

Where possible, infer a likely profile from the existing multi-page crawl and platform evidence, then let the owner correct it.

### Rules

- Applicability must affect the denominator rather than creating fake failures.
- Technical standards that provide optional optimization should be labelled as such.
- A standards check must not dominate the business score simply because it is fashionable/new.
- Region-locked capabilities remain neutral where unavailable.

### UX

Keep the first interaction simple:

**Enter website → Scan → See result.**

Do not require account creation before a public scan.

Show profile/customization after or alongside the first result, not as a large onboarding barrier.

---

# 12.4 Three fix paths for every actionable finding

Every actionable finding should clearly expose the appropriate route:

1. **Fix with AgentCart** — automatic or approval-required where AgentCart has authorized access and a verified implementation.
2. **Give this to my developer / coding agent** — generate a precise implementation prompt/instructions based on the evidence.
3. **Show me how to fix it manually** — concise owner/developer steps where automation is unavailable.

### Coding-agent instructions

Add a safe `Copy fix instructions` capability inspired by the useful interaction pattern now common in readiness tools, but generate instructions from AgentCart's own evidence and rules.

Requirements:

- include exact failed check and observed evidence;
- explain desired end-state;
- include verification criteria/tests;
- avoid exposing secrets;
- avoid inventing platform access the user does not have;
- tell the coding agent to preserve existing behavior;
- for new/emerging standards, instruct it to confirm the current official spec before implementation;
- never represent generated instructions as already applied.

### AgentCart fix advantage

Where AgentCart can safely fix the issue itself, `Fix with AgentCart` should be the primary CTA and the copy-prompt path secondary.

After every automated fix:

**Apply → independently verify → rescan/recheck → show evidence and score/capability change.**

---

# 12.5 AI Visibility / AEO measurement

Agent readiness and AI recommendation are different questions. Build a separate AI Visibility/AEO model.

The product must be able to answer:

> **Even if AI can understand and use this business, is it actually mentioning or recommending it?**

### Initial metrics

Design the data model to support at least:

- **Mention rate** — how often the business is named in relevant test queries;
- **Citation rate** — how often the business/site is cited or linked where the assistant exposes sources;
- **Prominence** — approximate position/importance of the business within the answer;
- **Recommendation rate** — how often it is explicitly recommended for a relevant intent;
- **Share of voice** — how often the business appears relative to selected competitors;
- **Query coverage** — performance across tracked customer intents/topics;
- provider/model/test-run provenance;
- timestamp and repeatability metadata.

### Query sets

A merchant should be able to maintain an intent/query set such as:

- category + location queries;
- product/problem queries;
- service + urgency queries;
- comparison queries;
- brand-vs-competitor queries;
- informational queries that should lead to the merchant.

Do not generate misleading vanity queries that simply ask an assistant to mention the merchant by name.

### Provider adapters

Keep AEO execution provider-neutral. Provider adapters may be added for assistants/models where legitimate programmatic testing is available.

Do not scrape private user interfaces or bypass provider restrictions. If a provider cannot be tested programmatically and reproducibly, mark it unsupported/manual rather than faking a metric.

### Evidence and honesty

- Store exact query, provider/model identifier where available, run time, parsed outcome and safe evidence.
- Distinguish measured results from inferred/estimated visibility.
- Never promise ranking or recommendation.
- Avoid claiming that one synthetic prompt suite exactly predicts all real customer behavior.

---

# 12.6 Competitive AI share-of-voice

Extend AEO so a merchant can compare itself with a small explicit competitor set.

### Capabilities

- owner enters/selects competitors;
- AgentCart runs the same intent set fairly across the market;
- results show which businesses are mentioned/cited/recommended;
- surface repeated reasons/evidence when assistants appear to favor competitors;
- connect those reasons back to fixable Business Readiness / Agent Standards findings where defensible.

### Example merchant output

- Your business was recommended in 3/10 tests.
- Competitor A appeared in 7/10.
- The strongest repeated gap was missing/unclear delivery and stock information.
- AgentCart can fix 2 of the 3 underlying readiness problems.

Do not state causal certainty unless the experiment actually supports it. Use language such as `associated with`, `likely contributor`, or `observed difference` where appropriate.

---

# 12.7 Expand Live Agent Journey Verification into Customer Intent Tests

Phase 10/11 already establishes safe Live Agent Journey Verification. Phase 12 should make it merchant-meaningful rather than only protocol-meaningful.

Build reusable customer-intent scenarios such as:

### Ecommerce

- find an appropriate product;
- confirm price/stock;
- compare variants;
- answer delivery/returns questions;
- add/select a product;
- reach cart/checkout handoff;
- stop before real payment except in an explicit sandbox/test transaction.

### Service business

- understand what service is offered;
- determine service area;
- find price/quote rules where published;
- reach an enquiry/quote path;
- reach booking/availability handoff where supported;
- never create unwanted real bookings/messages during automated verification.

### Result format

Report:

- intent;
- steps;
- successful steps;
- failure point;
- protocol/browser/provider used;
- freshness at test time;
- whether result was static, simulated/test, or live verified;
- exact safe evidence.

This becomes the strongest proof behind claims such as:

> **AI customer journey verified today.**

Do not show that statement from static checks alone.

---

# 12.8 Make AgentCart itself callable by AI agents

AgentCart should not only prepare merchants for agents. Agents should be able to call AgentCart as an infrastructure capability.

### Add an AgentCart readiness tool/API

Expose a safe, rate-limited, stateless public capability that can accept a public business URL and return an appropriate readiness/capability summary.

Initial tool shape may include operations such as:

- `scan_site`;
- `get_scan_result` only if asynchronous execution is later genuinely supported by the deployed architecture;
- `get_public_business_capabilities` for claimed/connected merchants;
- `get_agent_standards` / current supported checks;
- `get_public_ai_profile`.

Prefer synchronous/stateless behavior for the public scanner where practical. Do not pretend a background scan exists if it does not.

### Discovery

Make AgentCart itself a good example of an agent-ready service by publishing the applicable standards AgentCart supports, such as:

- MCP discovery/server card;
- Agent Skills documentation/index;
- API/auth discovery where relevant;
- Markdown-friendly documentation/content where practical;
- appropriate agent/discovery files;
- current commerce protocols only where AgentCart truly backs them.

### Safety/abuse controls

- public URL scanning remains subject to SSRF/private-network protection;
- enforce size/time/rate limits;
- never expose private merchant data;
- do not allow public tools to trigger merchant mutations;
- mutating merchant actions remain authenticated/authorized and separate.

---

# 12.9 Hosted AI layer becomes the compatibility/action layer

Continue investing in the AgentCart-hosted AI layer. It is a core differentiator, not a fallback to hide.

The hosted layer should become a stable AI-facing compatibility/action layer for businesses whose original sites cannot safely expose everything agents need.

### Extend normalized public capability data

Where legitimately supported, expose:

- business identity;
- products/services;
- current price/currency/availability with freshness;
- locations/service areas;
- policies;
- public FAQs;
- supported actions;
- action requirements/limitations;
- protocol/provider capability status;
- checkout/booking/enquiry handoff;
- last verified timestamps;
- provenance.

### Critical rule

The hosted layer must never advertise an action merely to improve a score. It can only advertise capabilities backed by a real merchant/platform action and tested according to the existing verification model.

---

# 12.10 Outcome dashboard: from scores to AI customers

The dashboard should progressively shift from `your score is X` toward `here is what AI can do for your business and what it produced`.

Suggested high-level owner view:

### AI Readiness

- Business Readiness score;
- key can/cannot understand/do statements;
- highest-value fixes;
- verified journey status.

### Agent Standards

- standards level/status;
- quick wins;
- advanced/native capabilities;
- optional/not-applicable clearly separated.

### AI Visibility

- mention rate;
- recommendation rate;
- citation rate;
- competitor/share-of-voice trend;
- strongest visibility gaps.

### AI Customers

- identifiable AI visits;
- enquiries/bookings where integrated;
- purchases/orders where verified;
- reported vs verified revenue;
- unknown/unattributed kept honest.

The commercial north-star metric should eventually be:

> **AI customers and verified AI-attributed business value/revenue**

Scores are diagnostic tools that help move that metric; they are not the final value proposition.

---

# 12.11 Data model additions

Add versioned entities/tables as appropriate for:

### Standards

- standard definitions/registry version;
- scan/check results;
- applicability profile;
- evidence;
- rule/spec version;
- fix mapping.

### AEO

- businesses/projects;
- tracked intents/query sets;
- competitors;
- providers/models;
- visibility runs;
- per-query outcomes;
- mentions/citations/recommendations/prominence;
- parsed evidence;
- run/version metadata.

### Journey tests

Build on Phase 10/11 live-verification storage rather than duplicating it. Add merchant/customer-intent labels and comparable outcome fields if missing.

### Metrics

Keep static readiness, standards, visibility, journey success and revenue as separate dimensions with explicit versions/provenance.

---

# 12.12 Scoring model

Do **not** immediately collapse everything into one 100-point score.

For Phase 12, prefer separate headline dimensions such as:

- **Business Readiness** — existing 0–100 score;
- **Agent Standards** — separate percentage/level based only on applicable checks;
- **AI Visibility** — measured AEO metrics, not a fake readiness score;
- **Journey Verification** — verified/partial/failed/untested with scenario counts;
- **AI Revenue** — reported/verified/unknown monetary or conversion outcomes.

If a combined `AgentCart Index` is ever introduced later, it must have a documented rationale, versioning, and evidence showing the combination is useful. Do not create one just for marketing.

---

# 12.13 Recommended implementation order

Implement Phase 12 in this order unless repository inspection proves a dependency requires adjustment:

1. **Create the versioned Agent Standards registry and applicability model.**
2. **Add standards diagnostics missing from Phases 10/11**: Link headers, Markdown negotiation, DNS-AID, Content Signals, Web Bot Auth, API Catalog, OAuth discovery/protected-resource metadata, Auth.md, A2A Agent Card, Agent Skills, WebMCP, ARD, x402/MPP where current specs permit.
3. **Add business/site-type profiles** and ensure N/A/optional checks do not distort scores.
4. **Add the three fix paths**: AgentCart fix / copy coding-agent instructions / manual guidance.
5. **Make AgentCart itself agent-callable** with a safe public `scan_site` capability and proper discovery/documentation.
6. **Build the AEO/AI Visibility data model and query-set UX.**
7. **Add the first legitimate provider adapter(s)** for repeatable mention/citation/recommendation testing.
8. **Add competitor/share-of-voice comparisons.**
9. **Extend Phase 10/11 Live Agent Journey Verification into merchant-facing customer-intent tests.**
10. **Connect readiness/standards/visibility/journey gaps to the existing fix engine.**
11. **Upgrade the dashboard around outcomes**: readiness → visibility → verified journeys → AI customers/revenue.
12. **Calibrate, document and security-review the whole Phase 12 loop.**

---

# 12.14 Automated test requirements

Add deterministic automated coverage for at least:

### Standards

- each supported standard present/valid;
- missing/invalid/malformed cases;
- unknown/new versions fail safely;
- standards registry updates do not corrupt historical results;
- site-type applicability and denominator behavior;
- region-unavailable stays neutral;
- training crawler block remains separate from customer-discovery readiness.

### Markdown/content discovery

- `Accept: text/markdown` negotiation success;
- HTML fallback does not falsely pass;
- malformed/empty Markdown response;
- `llms.txt`/`llms-full.txt`/`agents.md` tracked independently.

### Auth/protocol discovery

- valid and invalid OAuth metadata;
- protected-resource metadata;
- valid/invalid MCP, A2A and Agent Skills discovery;
- unknown versions do not crash;
- no capability invented from a discovery document alone.

### Fix instructions

- generated instruction contains the real evidence/check;
- no secret/private data appears;
- no unsupported access is claimed;
- verification criteria included;
- automatic fix remains preferred where AgentCart can safely apply it.

### AEO

- stable parser fixtures for mention/no-mention;
- citations correctly associated;
- prominence/recommendation extraction rules versioned;
- competitor results use identical query sets;
- provider errors/unsupported providers do not become false zero scores;
- repeated runs preserve provenance.

### AgentCart public tool

- public `scan_site` rejects private/internal network targets;
- rate/size/time limits;
- only public-safe data returned;
- public tools cannot trigger merchant mutation;
- AgentCart discovery manifests/cards contain no secrets.

### Customer-intent journeys

- ecommerce success and each key failure stage;
- service-business handoff success/failure;
- no real payment boundary;
- no unwanted booking/message boundary;
- live verified status cannot be produced by static evidence.

CI must continue to run the full pre-existing Phase 1–11 suite plus Phase 12 tests.

---

# 12.15 Phase 12 definition of done

Do not call Phase 12 complete until all of the following are true:

- [ ] Existing Business Readiness remains intact and understandable.
- [ ] Agent Standards exists as a separate versioned diagnostic layer.
- [ ] Standards applicability profiles exist for service, ecommerce, content and API/application sites.
- [ ] Applicable Cloudflare-style/open standards gaps not already covered by Phase 10/11 have been implemented where current public specifications allow.
- [ ] Missing optional standards do not falsely imply a business is unusable by AI.
- [ ] Every actionable finding can route to AgentCart fix, coding-agent/developer instructions, or manual guidance as appropriate.
- [ ] Automatic/approval-required AgentCart fixes still independently verify before claiming success.
- [ ] AgentCart exposes a safe agent-callable public readiness capability such as `scan_site`.
- [ ] AgentCart itself publishes the appropriate agent discovery/documentation standards it genuinely supports.
- [ ] AI Visibility/AEO has a real data model and repeatable query-set workflow.
- [ ] At least one legitimate provider/model path can produce measured mention/recommendation/citation results, or the feature remains explicitly experimental/unsupported until legitimate access exists.
- [ ] Competitor/share-of-voice comparison works from the same query set without biased prompts.
- [ ] Live Agent Journey Verification is exposed as customer-intent tests rather than only technical protocol checks.
- [ ] Static, simulated/test and live-verified evidence are never conflated.
- [ ] Dashboard separates Business Readiness, Agent Standards, AI Visibility, Journey Verification and AI Customers/Revenue.
- [ ] AI revenue remains split into verified/reported/unknown evidence levels.
- [ ] No public tool or hosted AI endpoint leaks tokens, customer data, private order data or merchant admin data.
- [ ] Full CI is green and Phase 12 security/privacy review passes.

---

# Phase 12 final product statement

The combined Phase 1–12 product should make this statement defensible:

> **AgentCart can scan a business, explain in plain English whether AI can find and understand it, measure relevant agent-standard compatibility without penalizing irrelevant protocols, connect to supported business systems, safely fix and verify problems, provide a clean AI-facing compatibility/action layer, test whether real/safe agent customer journeys work, measure whether AI assistants actually mention or recommend the business, and show the AI-driven customers/revenue that can be attributed honestly.**

That is the differentiation. AgentCart is not merely an agent standards score. It is the system that moves a business from **AI invisible → AI understandable → AI usable → AI recommended → AI customer/revenue producing**.