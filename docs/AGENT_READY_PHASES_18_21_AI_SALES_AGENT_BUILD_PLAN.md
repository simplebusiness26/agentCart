# AgentReady Phases 18–21 — Business AI Sales Agent Build Plan

> **Implementation update — 2026-09-18:** The credential-independent Business Brain, structured Sales Agent, grounded preview, regression suite, provider-neutral packaging and privacy-minimised conversation-event foundations are implemented on `codex/phases-18-29`. Production/provider verification remains separate. See `docs/PHASES_18_29_IMPLEMENTATION_STATUS.md`.

Prepared 2026-09-18 from `main` at `0fbe3aa90775b1fb79b5111ea83b4089a5fb6c40`.

## Product direction

AgentReady already answers four important questions:

1. Can AI systems find and understand this business?
2. Can an agent reliably use the business's published information and handoff paths?
3. Can AgentReady safely fix and verify readiness problems?
4. Did AI produce a measurable customer or business outcome?

Phases 18–21 add the missing commercial layer:

> **Give the business its own trustworthy AI representative, continuously test and improve that representative, distribute it through supported conversational channels, and prove what happens from conversation to customer and revenue.**

The product direction becomes:

```text
SCAN
  -> CONNECT
  -> FIX
  -> VERIFY
  -> MONITOR
  -> GET FOUND
  -> GET RECOMMENDED
  -> BUSINESS AI AGENT
  -> CONVERSATION OPTIMIZATION
  -> DISTRIBUTION / SPONSORED AGENT READINESS
  -> CUSTOMER / REVENUE PROOF
```

The commercial promise is not "we build chatbots."

It is:

> **AgentReady makes a business ready to acquire and serve customers through AI.**

---

## Non-negotiable rules

1. **One business truth.** The AI Sales Agent, hosted AI layer, MCP, website fixes and future provider adapters must consume the same canonical business facts.
2. **Never invent a business fact.** Price, availability, policy, location, qualification, delivery, guarantee, promotion and legal claims must come from an authoritative or merchant-approved source.
3. **Conversation quality is separate from website readiness.** Do not roll Business Readiness, Agent Standards, AI Visibility, AgentPulse reliability or Sales Agent performance into one misleading score.
4. **Provider independence.** OpenAI Sponsored Agents are a distribution adapter, not the core product.
5. **No false access claim.** A merchant cannot be told AgentReady can activate a Sponsored Agent unless that advertiser account is actually eligible and the current provider interface supports it.
6. **No hidden persuasion tricks.** Optimization means accurate, useful, relevant customer assistance and better task completion, not deceptive or manipulative behaviour.
7. **Merchant control.** The merchant can inspect, pause and change what the agent knows, what it may say, and what actions it may expose.
8. **Least privilege.** Read-only by default. Any write or business action must use a declared capability, scoped authorization and existing approval/safety boundaries.
9. **Human-visible copy requires approval.** Generated descriptions, sales language, FAQs or scripts are drafts until approved unless they are strictly machine-only and reversible.
10. **No autonomous real purchase by default.** Test journeys stop at safe handoff unless an explicit test environment and idempotent action path are configured.
11. **Evidence over claims.** "Improved" requires a comparable baseline/post-change test. "Converted" requires an observed outcome. "Revenue" keeps the existing evidence tiers.
12. **No provider scraping that violates terms.** Use official APIs, provider-approved integrations, controlled manual evidence, or mark unsupported.
13. **Provider facts expire.** Sponsored Agent availability, ads APIs, supported actions and platform capabilities belong in a versioned provider registry with verified dates.
14. **Phone-first merchant UX.** The owner should be able to understand and control the agent from a small mobile screen.
15. **Build-first is not production proof.** Green tests do not make a provider integration live.
16. **Unavailable channels still get a truthful skeleton.** If an emerging provider capability is not generally available, build the business logic, provider boundary, readiness checks and a clearly labelled demo/sandbox where enough is known to do so safely. Never present a demo as provider-live.

## Demo -> Ready -> Live delivery model

Emerging channels must use three distinct states:

### Demo

AgentReady may simulate the customer experience using its own Business Brain, Sales Agent, safe actions and outcome instrumentation.

A demo must:

- be visibly labelled as simulated;
- avoid provider logos/branding that would imply approval unless permitted;
- use test/demo business data or clearly identified merchant preview data;
- never claim native provider distribution;
- never submit a real purchase unless an explicit test environment supports it;
- exercise as much of the real AgentReady stack as possible so the demo is not a disposable mock.

### Ready

The merchant's real business configuration is prepared and tested for the provider/channel as far as AgentReady can legitimately verify.

Ready can include:

- approved business facts;
- provider package/compiler output;
- action/tool schemas;
- conversation regression tests;
- factual/policy guardrails;
- measurement hooks;
- channel eligibility/readiness diagnostics;
- provider-specific missing requirements.

"Ready" never means provider-approved.

### Live

Only use Live when the external provider has actually activated a supported integration for that merchant and AgentReady has verified the channel.

The dashboard must never collapse Demo, Ready and Live into one boolean.

This pattern should apply not only to OpenAI Sponsored Agents but to future Gemini, Meta, marketplace, commerce or other agent distribution channels.

---

# Architecture extension

The existing architecture remains the foundation.

Add these new layers without duplicating existing modules:

```text
Shopify / WordPress / WooCommerce / custom site
                  |
                  v
        Canonical Business Brain
                  |
       +----------+----------+------------------+
       |                     |                  |
       v                     v                  v
Hosted AI Layer        MCP / tools       AI Sales Agent
       |                     |                  |
       +----------+----------+------------------+
                  |
                  v
          Provider Adapters
      OpenAI / future channels
                  |
                  v
       Conversation Sessions
                  |
       +----------+----------+
       |                     |
       v                     v
Conversation Eval       Real Handoff
       |                     |
       v                     v
Optimization Loop       Lead / booking /
                         cart / order
                              |
                              v
                     Existing Outcome Proof
```

## Reuse, do not rebuild

Phases 18–21 must reuse:

- `src/agentready/` for business/readiness evidence.
- `src/ailayer/` for the hosted public source of truth.
- `src/agentpulse/` for synthetic monitoring, latency, drift and incidents.
- `src/aeo/` for visibility and observable competitor evidence.
- `src/fixes/` for preview -> approval -> apply -> verify -> undo.
- `src/platform/registry.ts` for platform capability declarations.
- `src/standards/registry.ts` for versioned provider/standard facts.
- `src/outcomes/proof.ts` and `src/attribution.ts` for outcome evidence and revenue tiers.
- The Phase 17 signed-journey model for linking intent to handoff/outcome.
- The existing launch gate model: code-ready and production-verified remain different states.

Do not build a second catalogue, a second merchant profile or a second attribution system.

---

# Phase 18 — Business Brain and AI Sales Agent

## Goal

Create one merchant-controlled, provider-independent AI representative that can answer customer questions using verified business facts and expose only safe, real actions.

The agent must work before any Sponsored Agent access exists.

## 18.1 Canonical Business Brain

Create a canonical business knowledge service over the existing business/profile/catalogue/policy data.

The normalized model should support:

### Identity

- business name;
- brands/trading names;
- description;
- locations;
- service areas;
- opening hours;
- public contact methods;
- trust/qualification facts only when verified.

### Products and services

- product/service id;
- name;
- description;
- category;
- variant/options;
- price and currency;
- sale/promotion facts;
- availability/stock;
- delivery/fulfilment information;
- canonical URL;
- media references;
- freshness timestamp;
- source/provenance.

### Policies

- shipping/delivery;
- returns/refunds;
- cancellation;
- booking terms;
- warranty/guarantee where authoritative;
- privacy/legal links;
- exclusions/limitations.

### Customer actions

- view item;
- contact;
- request quote;
- booking handoff;
- cart handoff;
- checkout handoff;
- human escalation;
- later test-mode transactional actions where explicitly supported.

Every fact must retain:

- source;
- source record id where available;
- retrieved/verified time;
- merchant-approved flag;
- confidence/evidence state;
- freshness;
- locale/currency;
- whether it is safe for public agent use.

## 18.2 Sales Agent configuration

Add an `ai_sales_agents` entity with:

- business/shop id;
- public/internal agent id;
- status: draft / active / paused;
- display name;
- purpose;
- tone guidelines;
- supported intents;
- allowed knowledge scopes;
- allowed actions;
- escalation rules;
- unsupported topics;
- locale/language;
- configuration version;
- created/updated timestamps.

Do **not** store a giant unversioned prompt as the product.

Use structured configuration plus a generated provider prompt/manifest.

## 18.3 Grounded answer engine

Create a provider-neutral service, for example:

- `src/salesagent/brain.ts`
- `src/salesagent/retrieval.ts`
- `src/salesagent/respond.ts`
- `src/salesagent/actions.ts`
- `src/salesagent/types.ts`

The answer path should be:

```text
customer message
 -> intent classification
 -> retrieve authoritative facts
 -> retrieve allowed actions
 -> compose bounded context
 -> model/provider adapter
 -> factual-grounding checks
 -> policy/action validation
 -> response
```

The agent must prefer "I don't have verified information for that" over guessing.

## 18.4 Action model

Actions must use the existing capability/evidence model.

Each action declares:

- action type;
- owner/platform;
- read vs write;
- authorization required;
- approval required;
- input schema;
- safe validation rules;
- idempotency requirements;
- handoff URL or execution adapter;
- test/sandbox support;
- verification method;
- fallback/human escalation.

Initial production actions should remain conservative:

- product/service search;
- product/service detail;
- price/availability lookup;
- policy lookup;
- contact/quote handoff;
- booking handoff;
- cart/checkout handoff;
- human escalation.

## 18.5 Merchant preview

Add a merchant-facing **AI Sales Agent** screen:

- Active / Paused.
- "Talk to your AI salesperson."
- What it knows.
- What it does not know.
- Data freshness.
- Allowed actions.
- Last sync.
- Current reliability.
- Recent failed test scenarios.
- Edit tone/brand guidance.
- Pause immediately.

The merchant must be able to inspect the evidence behind any fact the agent exposes.

## 18.6 Model/provider boundary

Create an interface such as:

```ts
interface SalesAgentModelProvider {
  id: string;
  available(env: Env): boolean;
  generate(input: GroundedConversationInput): Promise<GroundedConversationOutput>;
}
```

No paid provider is required for the core AgentReady scanner.

The Sales Agent feature may have provider-specific operating costs and must be separately feature-gated.

## 18.7 Phase 18 definition of done

- [ ] One canonical business-brain service powers hosted AI data and Sales Agent retrieval.
- [ ] No duplicate independent catalogue or policy truth is introduced.
- [ ] Agent configuration is structured and versioned.
- [ ] A merchant can create, preview, activate and pause its agent.
- [ ] Responses cite/retain internal provenance for the facts used.
- [ ] Unsupported/unknown facts are not invented.
- [ ] Price/availability freshness rules are enforced.
- [ ] Only declared, verified actions are exposed.
- [ ] Public write actions remain disabled unless explicitly implemented and authorized.
- [ ] Phone-width dashboard is usable.
- [ ] Full existing Phase 1–17 suite remains green.

---

# Phase 19 — Conversation Testing and Sales Agent Optimization

## Goal

Continuously prove whether the business's AI representative is accurate, useful and capable of guiding a customer to a legitimate next step.

This is the Sales Agent equivalent of AgentPulse.

## 19.1 Scenario library

Create a versioned scenario system with business-type applicability.

Initial scenario families:

### Product discovery

- "I have £X, what fits?"
- compare two products;
- feature requirement;
- compatibility question;
- out-of-stock alternative;
- delivery deadline.

### Service discovery

- service-area question;
- budget/quote question;
- urgency;
- booking availability;
- qualification/trust question;
- cancellation policy.

### Objections and uncertainty

- "Your competitor is cheaper";
- "Why should I choose this?";
- missing information;
- conflicting information;
- unsupported request;
- ambiguous request.

### Policy

- refund;
- cancellation;
- delivery;
- guarantee/warranty;
- privacy/customer data.

### Action completion

- locate the correct product;
- quote handoff;
- booking handoff;
- cart handoff;
- human escalation.

## 19.2 Test sources

Support three evidence classes:

1. **Deterministic fixtures** — unit/integration tests.
2. **Synthetic model conversations** — labelled simulation.
3. **Real production conversations/outcomes** — labelled observed production evidence.

Never merge these into one success rate.

## 19.3 Evaluation dimensions

Keep separate metrics rather than one vanity score.

Measure at minimum:

- factual accuracy;
- unsupported-claim rate;
- price accuracy;
- availability accuracy;
- policy accuracy;
- intent understanding;
- correct product/service selection;
- useful next-step rate;
- safe action selection;
- handoff success;
- escalation appropriateness;
- response consistency;
- stale-data incidents;
- latency;
- customer abandonment where observable;
- conversion/outcome only when actually observed.

A headline **Sales Agent Health** can summarize statuses, but underlying metrics must remain visible and versioned.

## 19.4 Grounding evaluator

Build deterministic validators wherever possible before using model-as-judge techniques.

Examples:

- quoted price must match canonical price;
- claimed availability must match latest verified availability;
- location/service area must match canonical locations;
- policy statements must be supported by policy evidence;
- action URL must be an allowed verified handoff;
- product id must exist;
- claimed promotion must be active;
- unsupported facts become failures.

A model evaluator may assess softer dimensions such as clarity or whether an answer addressed the question, but those results must be labelled probabilistic/evaluated rather than factual proof.

## 19.5 Conversation regression testing

Store scenario set + agent config version + business-brain version + model/provider/model-version when available.

After:

- business-data update;
- agent configuration change;
- provider/model change;
- fix application;
- major catalogue change;

run a bounded regression suite.

Report:

```text
Before: 31 / 40 scenarios passed
After:  37 / 40 scenarios passed
+6 scenarios

Remaining failures:
- delivery deadline
- refund exception
- out-of-stock alternative
```

Do not claim business revenue improved from scenario success alone.

## 19.6 Optimization recommendations

Every recommendation must identify:

- failing scenario;
- evidence;
- likely cause;
- whether the issue is:
  - business data;
  - website/source data;
  - agent configuration;
  - action integration;
  - provider/model behaviour;
  - third-party outage;
- proposed fix;
- owner of the work;
- verification test;
- whether rollback is available.

Route website/data fixes into the existing Phase 16 Fix My Site lifecycle.

Route agent-configuration fixes through a parallel preview -> approval -> apply -> regression-test -> undo lifecycle.

## 19.7 Merchant UX

Add an **AI Sales** dashboard area showing:

- Sales Agent status.
- Accuracy / policy / pricing / action-health dimensions.
- Scenarios passed/failed.
- "Why it failed."
- "Fix with AgentReady" where legitimately supported.
- Conversation test history.
- Reliability incidents from AgentPulse.
- Real observed outcomes kept separate from simulation.

## 19.8 Phase 19 definition of done

- [ ] Scenario library is versioned and business-type aware.
- [ ] Synthetic vs production evidence is impossible to confuse in storage or UI.
- [ ] Factual validators catch fabricated price, availability, policy and action claims.
- [ ] Regression testing runs after relevant changes.
- [ ] Agent config fixes are previewed, approved where necessary, verified and reversible.
- [ ] Website/business-data causes route into Fix My Site V2 rather than being duplicated.
- [ ] AgentPulse reliability can be linked to conversation failures.
- [ ] Metrics remain separate and evidence-backed.
- [ ] No "conversion improvement" claim is made from simulated conversations alone.

---

# Phase 20 — Conversational Distribution and Sponsored Agent Readiness

## Goal

Turn the Business AI Agent into a portable representative that can be exposed through supported conversational channels without tying AgentReady to a single provider.

## 20.0 Demo and skeleton mode

Before a provider-native channel is live, AgentReady should still be able to demonstrate the end-to-end customer experience using the real Business Brain, Sales Agent, safe handoffs, test scenarios and outcome instrumentation.

The first public example is:

- `GET /demo/sponsored-agent`
- clearly labelled **Concept demo / Demo Mode**;
- explains what a Sponsored Agent is;
- explains why a merchant would want one;
- shows the capabilities AgentReady intends to prepare;
- provides a simulated buyer conversation;
- distinguishes what AgentReady can build now from the provider activation step;
- shows the **Demo -> Ready -> Live** lifecycle.

The demo is a product/sales surface and an implementation reference. It must not become a second disconnected agent implementation.

Later, the same pattern can be generated per merchant so an owner can preview "what my agent would look like" using their approved facts before any external channel activation.

## Current OpenAI constraint

As of 2026-09-18, OpenAI Sponsored Agents are a **limited alpha for selected advertisers**.

AgentReady therefore must **not** promise that it can activate a Sponsored Agent for every merchant.

The first OpenAI status should support states such as:

- not_applicable;
- provider_not_available;
- advertiser_not_eligible;
- ready_for_provider;
- provider_onboarding_required;
- active;
- degraded;
- unknown.

No "Activate Sponsored Agent" button should exist unless the provider currently exposes a legitimate path for that advertiser.

## 20.1 Provider adapter contract

Create a conversational distribution interface, for example:

```ts
interface ConversationalChannelAdapter {
  id: string;
  capabilityStatus(ctx: MerchantContext): Promise<ChannelCapabilityStatus>;
  validate(agent: PublishedSalesAgent): Promise<ValidationResult>;
  publish?(agent: PublishedSalesAgent): Promise<PublishResult>;
  update?(agent: PublishedSalesAgent): Promise<PublishResult>;
  unpublish?(agentId: string): Promise<PublishResult>;
  metrics?(agentId: string, window: TimeWindow): Promise<ChannelMetrics>;
}
```

Initial adapters:

- `agentready_hosted` — fully controlled by AgentReady.
- `openai_sponsored_agent` — readiness adapter first; publish/update only when official supported access exists.
- future provider adapters remain registry entries until documented and legitimately accessible.

## 20.2 Sponsored Agent readiness assessment

For an eligible business, evaluate whether the Business AI Agent has:

- complete product/service knowledge;
- current price and availability;
- clear policies;
- allowed actions;
- escalation path;
- brand identity/tone;
- prohibited/unsupported topics;
- grounded response performance;
- reliability above an evidence-backed threshold;
- no unresolved high-severity factual failures;
- acceptable conversation regression results;
- required provider/advertiser account status;
- required measurement/handoff configuration.

Readiness is **not** provider approval.

The UI should say:

> "Your business agent is technically ready for this channel."

not:

> "OpenAI will approve your Sponsored Agent."

## 20.3 Ads readiness link

Reuse the existing AI Visibility and site-readiness work to test:

- landing-page accessibility;
- crawler accessibility;
- product/service completeness;
- price/availability;
- conversion handoff;
- measurement/event readiness;
- agent response quality.

Keep normal ChatGPT Ads setup separate from Sponsored Agent eligibility.

## 20.4 Provider-specific packaging

Build a compiler:

```text
Canonical Business Brain
 + Agent configuration
 + Approved actions
 + Provider policy/capabilities
 -> Provider package
```

The compiler may emit:

- provider prompt/instructions;
- knowledge references;
- action/tool definitions;
- public URLs;
- policy summaries;
- brand/tone rules;
- unsupported-topic rules;
- measurement/handoff configuration.

Never hand provider adapters merchant secrets they do not require.

## 20.5 Channel verification

After activation on any channel:

- run provider-allowed smoke tests;
- run channel-specific conversation scenarios;
- verify product/service facts;
- verify action handoffs;
- monitor failures/drift;
- record provider/model/version/date where available;
- compare channel behaviour without assuming hidden model reasoning.

Feed channel reliability into AgentPulse.

## 20.6 Phase 20 definition of done

- [x] Public Sponsored Agent concept demo exists and explicitly identifies itself as simulated.
- [ ] Merchant-specific Sponsored Agent preview can be generated from the active Business Brain without pretending the provider is live.
- [ ] Provider-independent channel interface exists.
- [ ] AgentReady hosted channel works without any third-party eligibility.
- [ ] OpenAI adapter reports current eligibility/readiness honestly.
- [ ] No unsupported publish/activation path is advertised.
- [ ] Provider packages derive from the same Business Brain.
- [ ] Merchant can see channel-specific status and limitations.
- [ ] Provider updates do not fork the merchant's business data.
- [ ] Channel smoke tests feed AgentPulse/reliability evidence.
- [ ] Ads readiness and Sponsored Agent eligibility remain separate concepts.
- [ ] Provider facts have source/verified-date/version and can become unknown when stale.

---

# Phase 21 — Conversation-to-Customer and Revenue Proof

## Goal

Extend the existing Phase 17 outcome model so AgentReady can defensibly connect:

```text
customer intent
 -> AI surface / ad
 -> business-agent conversation
 -> agent recommendation/action
 -> merchant handoff
 -> enquiry / quote / booking / cart
 -> order
 -> revenue
```

without pretending every link is observable.

## 21.1 Conversation journey identity

Extend signed journey ids with optional conversation/channel context:

- channel/provider;
- provider conversation/ad/session reference only when legitimately exposed;
- agent config version;
- scenario/intent class;
- handoff id;
- timestamp;
- evidence tier.

Do not store private ChatGPT conversation content unless it is explicitly provided through a supported advertiser integration and the merchant has a lawful/product reason to retain it.

Default to storing event summaries, not full customer conversations.

## 21.2 Conversation events

Support privacy-safe events such as:

- conversation_started;
- product_presented;
- service_presented;
- clarification_requested;
- handoff_offered;
- handoff_opened;
- quote_requested;
- contact_requested;
- booking_handoff;
- booking_confirmed where integrated;
- cart_handoff;
- order_verified;
- human_escalation;
- conversation_failed.

Do not infer events from absence.

## 21.3 Evidence tiers

Extend, do not replace, the existing attribution tiers.

Suggested tiers:

- verified platform outcome;
- signed AgentReady handoff + verified downstream outcome;
- identifiable provider/channel referral;
- merchant-reported;
- assisted/partial;
- unknown/unattributed.

Revenue is never summed across overlapping evidence tiers as though they are independent sales.

## 21.4 Funnel reporting

Report separately:

- AI visibility;
- ad impression/click where legitimately available;
- Sponsored/Business Agent conversation;
- useful-agent interaction;
- handoff;
- lead/quote/booking;
- order;
- verified revenue.

Example:

```text
213 identifiable AI visits
48 business-agent conversations
31 product/service handoffs
12 enquiries
7 orders
£1,486 verified revenue
```

Only display a stage when AgentReady has evidence for it.

## 21.5 Conversation performance experiments

Extend Phase 17 controlled experiments to support agent configuration.

Example:

- hypothesis: shorter first response increases product-handoff completion;
- population: eligible AI Sales Agent conversations;
- window;
- configuration A/B;
- primary metric;
- safety/accuracy guardrails;
- result;
- confidence/limitations.

Never optimize conversion at the expense of factual accuracy or safety.

Accuracy/policy guardrails must be able to stop an experiment.

## 21.6 Sales Agent outcome recommendations

Combine:

- AI Visibility gaps;
- AgentPulse reliability;
- conversation-evaluation failures;
- handoff failures;
- real outcome funnel data.

Then generate an evidence-backed "Why am I losing AI customers?" report.

Possible causes:

- not mentioned;
- mentioned but wrong information;
- weak/incomplete product data;
- agent failed scenario;
- stale price/stock;
- provider/channel incident;
- broken handoff;
- strong conversation but weak website conversion;
- outcome unknown because measurement is incomplete.

Never substitute an invented causal story for an unobserved step.

## 21.7 Phase 21 definition of done

- [ ] Conversation/channel context can attach to existing signed journeys.
- [ ] PII-minimised event model exists.
- [ ] Full conversations are not retained by default.
- [ ] Handoff and verified downstream outcomes can be joined where supported.
- [ ] Funnel stages remain evidence-specific.
- [ ] Revenue tiers remain non-overlapping and honest.
- [ ] Controlled conversation experiments have accuracy/safety guardrails.
- [ ] "Why losing" can use real conversation and outcome evidence.
- [ ] Unknown remains unknown when a stage cannot be observed.

---

# Data model additions

Add non-destructive migrations after the existing Phase 17 migrations.

Suggested entities:

## Business Brain

- `business_facts`
- `business_fact_sources`
- `business_fact_versions`
- or an equivalent normalized/versioned structure if existing tables can be extended safely.

## Sales Agent

- `ai_sales_agents`
- `ai_sales_agent_versions`
- `ai_sales_agent_actions`
- `ai_sales_agent_publications`

## Conversations and tests

- `conversation_test_suites`
- `conversation_test_cases`
- `conversation_test_runs`
- `conversation_test_results`
- `conversation_evaluations`

## Channels

- `conversation_channels`
- `channel_publications`
- `channel_verification_runs`

## Outcomes

Prefer extending existing Phase 17 journey/outcome tables where clean rather than duplicating attribution.

### Migration rule

Before creating any table, inspect the Phase 17 schema and reuse existing journey, lead, experiment and outcome structures where they already represent the concept.

---

# API surface

Exact paths may change to fit the current router, but the product should support equivalents of:

## Merchant-authenticated

- `GET /api/sales-agent`
- `POST /api/sales-agent/config`
- `POST /api/sales-agent/preview`
- `POST /api/sales-agent/activate`
- `POST /api/sales-agent/pause`
- `GET /api/sales-agent/knowledge`
- `GET /api/sales-agent/actions`
- `POST /api/sales-agent/test`
- `GET /api/sales-agent/tests`
- `GET /api/sales-agent/channels`
- `POST /api/sales-agent/channels/:provider/verify`

## Public/test surface

- hosted agent chat endpoint with strict rate limits;
- read/search/action tools only as declared;
- no merchant mutation through a public route.

## Provider callbacks/webhooks

Only introduce callbacks when a real provider integration requires them.

Every callback must have signature/auth validation, replay protection and tenant isolation.

---

# Dashboard / UX

The merchant navigation should progressively become:

- Overview
- Agent Ready
- Fixes
- AI Layer
- **AI Sales Agent**
- **AI Sales Tests**
- AI Visibility
- AI Agents / Reliability
- AI Customers / Revenue
- Connections
- Launch

## AI Sales Agent screen

Plain-English owner questions:

- What does my AI salesperson know?
- What can it do?
- Where is it active?
- Is it giving accurate answers?
- What is failing?
- What can AgentReady fix?
- Has it produced any real customers?

Protocol names and model implementation details belong in secondary developer detail.

---

# Safety, security and privacy

## Prompt injection and hostile source content

The existing site-safety layer must remain evidence-only.

Never put untrusted website instructions directly into system/developer control text.

Retrieved content must be treated as business data, not executable instructions.

## Tenant isolation

Every merchant-scoped fact, agent, test, conversation event and channel publication must be keyed and authorized to one tenant.

Add regression tests for cross-shop ids, guessed public ids and replayed action tokens.

## Secrets

Do not expose:

- Shopify tokens;
- model API keys;
- provider advertising credentials;
- Algolia Admin keys;
- signed action secrets;
- private customer/order data.

## Customer data

Collect the minimum data required to prove outcomes.

Prefer:

- one-way hashes;
- opaque external ids;
- signed journey ids;
- aggregate metrics.

Do not retain conversation text by default.

## Regulated/sensitive businesses

Provider/channel availability and ad eligibility must be treated as provider rules, not guessed by AgentReady.

If a category cannot be verified as eligible, report unknown/unsupported rather than offering activation.

---

# Scoring and reporting

Do not create a single "AI Sales Score" that hides failures.

Keep these headline dimensions separate:

1. **Business Readiness** — existing score.
2. **Agent Standards** — existing standards layer.
3. **AI Visibility** — existing measured visibility outcomes.
4. **AgentPulse Reliability** — journey reliability.
5. **Sales Agent Accuracy** — factual/policy/price/availability.
6. **Sales Agent Task Success** — scenario and handoff results.
7. **AI Customers / Revenue** — observed outcomes.

A compact owner-facing status may use Green / Needs attention / Failing / Untested, but the metrics underneath remain separate.

---

# Implementation order

Recommended order:

1. **Phase 18A — Business Brain canonical fact service**
2. **Phase 18B — hosted AI Sales Agent preview**
3. **Phase 18C — safe actions + merchant controls**
4. **Phase 19A — deterministic scenario/evaluation framework**
5. **Phase 19B — synthetic conversation runner**
6. **Phase 19C — fix/optimization loop**
7. **Phase 20A — conversational channel registry/interface**
8. **Phase 20B — AgentReady-hosted channel**
9. **Phase 20C — OpenAI Sponsored Agent readiness adapter**
10. **Phase 21A — conversation journey/outcome linkage**
11. **Phase 21B — funnel dashboard**
12. **Phase 21C — controlled conversation experiments**
13. **Phase 21D — combined evidence-backed why-losing report**

Do not make OpenAI Sponsored Agent activation a blocker for Phases 18, 19 or 21.

The product must deliver value even when every external Sponsored Agent provider is unavailable.

## Mandatory scanner-superset gate before roadmap completion

The AI Sales Agent roadmap does not replace or freeze the scanner.

AgentReady must maintain a **scanner superset** against credible benchmark products. The detailed parity matrix, Path-to-100 remediation contract and SEO/GEO phases live in:

- `docs/AUSPIA_FEATURE_AUDIT_AND_SEO_GEO_BUILD_PLAN.md`

Roadmap rule:

- every legitimate benchmark check must be covered or deliberately documented as non-applicable/unverifiable;
- lack of an automatic fix never removes a scanner check;
- every applicable non-pass must have a Path-to-100 remediation route;
- every safe fix should move from recommendation to preview/apply/verify/rescan when the platform connection allows it;
- developer/manual/provider-owned fixes stay visible and include exact verification;
- a fully controllable applicable configuration should have a defensible route to **100 / 100**;
- Phases 22–24 extend the roadmap with SEO/GEO opportunity intelligence, grounded content optimisation/publishing, and search+AI outcome measurement.

No future AgentReady release should be described as scanner-complete while the maintained benchmark matrix contains a useful capability in `planned` state.

## Mandatory analytics-superset gate

Peec AI is the current minimum analytics benchmark.

The detailed benchmark and implementation plan lives in:

- `docs/PEEC_ANALYTICS_SUPERSET_AND_QUERY_FANOUTS_BUILD_PLAN.md`

Roadmap rule:

- AgentReady must match or exceed legitimate Peec-class analytics capabilities including visibility, position, sentiment, share of voice, prompt tracking, source/citation intelligence, query fanouts, chat features, crawl insights, brand perception, shopping analytics and referral/conversion reporting;
- observed provider fanouts must remain separate from AgentReady-generated synthetic planning fanouts;
- analytics parity is not enough: every actionable gap should connect to a remediation/execution path and a retest;
- Phases 25–29 extend the roadmap with Visibility Analytics v2, Query Fanouts, Crawl Insights, Perception, AI Shopping and Referral/Action analytics;
- no release should be called **AI Analytics Superset** while a legitimate Peec benchmark capability remains `planned`.

---

# Automated test requirements

Add deterministic coverage for at least:

## Business Brain

- source priority/conflict handling;
- stale price/availability;
- missing facts;
- merchant-confirmed vs inferred;
- locale/currency;
- no private field in public serialization;
- one canonical fact reaches hosted AI layer and Sales Agent consistently.

## Sales Agent

- unsupported fact -> no invented answer;
- price/availability/policy grounding;
- action allowlist;
- unsafe/unknown action refusal;
- pause/activate;
- config version history;
- tenant isolation;
- prompt injection content remains data, never control.

## Conversation tests

- scenario applicability;
- deterministic factual evaluators;
- synthetic evidence label;
- production evidence label;
- regression comparison uses same suite version;
- model/provider error != business failure;
- stale source != fabricated answer.

## Optimization

- recommendation links to failing evidence;
- approval required where public sales copy changes;
- apply -> verify -> retest;
- undo restores prior agent config;
- website/data fix routes to existing fix engine.

## Channels

- unavailable provider -> unavailable, not fail;
- ineligible advertiser -> ineligible, not technical failure;
- stale provider fact -> unknown;
- provider package contains no secret;
- publish method absent -> no activation CTA;
- channel smoke test feeds AgentPulse.

## Outcomes

- signed conversation journey;
- handoff join;
- lead/order join;
- duplicate/replay protection;
- overlapping evidence does not double-count revenue;
- PII minimization;
- experiment guardrail stops unsafe/inaccurate variant.

CI must keep the complete existing Phase 1–17 suite green.

---

# Production verification

Code completion is not enough.

Before calling Phases 18–21 production verified:

0. Verify every emerging-channel demo continues to label Demo, Ready and Live distinctly and never implies provider activation.
1. Finish the existing Phase 13–17 production verification and launch gate.
2. Connect one real development merchant.
3. Publish one Business Brain from authoritative store data.
4. Run the merchant's hosted AI Sales Agent against real product/service/policy data.
5. Pass a representative conversation regression suite.
6. Deliberately introduce one safe stale-data/test failure and prove AgentPulse/optimization detects it.
7. Apply one agent-configuration fix and prove the failing scenario improves without breaking factual guardrails.
8. Verify one safe quote/contact/booking/cart handoff as applicable.
9. Link one signed conversation journey to a test lead or Shopify test order where available.
10. Verify provider/channel status against the current official provider documentation.
11. If an eligible Sponsored Agent advertiser is available, run the official onboarding/verification path; otherwise the OpenAI channel remains `ready_for_provider` or `advertiser_not_eligible`, not production-active.
12. Run security/privacy review and full launch gate extensions.

---

# Commercial product shape

The owner-facing product should be sellable as one service:

> **Make your business ready to win customers through AI.**

Potential product journey:

```text
Free Agent Ready Scan
        |
        v
Fix My Business
        |
        v
Business Brain
        |
        v
Build My AI Sales Agent
        |
        v
Test & Improve My AI Sales Agent
        |
        v
Connect AI Channels
        |
        v
Sponsored Agent Ready (when eligible)
        |
        v
Monitor Conversations, Leads and Revenue
```

Do not expose the customer to unnecessary protocol jargon.

---

# First PR

The first implementation PR should **not** try to build all four phases at once.

Build:

### Phase 18A — canonical Business Brain + read-only Sales Agent preview

Deliver:

- canonical fact service over existing data;
- fact provenance/freshness;
- `ai_sales_agents` + version/config model;
- merchant preview chat using a provider interface;
- strictly read-only product/service/policy retrieval;
- no external provider publication;
- no write actions;
- tests proving no duplicated source of truth and no invented facts.

Once this foundation is stable, every later channel and optimization feature can reuse it.

---

# Final product statement

When Phases 18–21 are complete and production-verified, this statement should be defensible:

> **AgentReady can make a business understandable and usable by AI, give that business a merchant-controlled AI representative grounded in verified business facts, continuously test and improve that representative, expose it through supported conversational channels such as Sponsored Agents when the merchant is actually eligible, and show with evidence what happened from AI discovery and conversation through to leads, bookings, orders and verified revenue.**

That is the next stage of AgentReady: not just **AI-ready websites**, but **AI-ready businesses with a measurable AI sales channel**.
