# AgentReady Phases 13-17 Build Plan
Prepared 2026-09-17 from main 15918236ecd3ffca3652e9540339449a0d15ef67.

## Product rule
SCAN -> CONNECT -> FIX -> VERIFY -> MONITOR -> PROVE BUSINESS RESULTS. Protocol presence is evidence, not the outcome. Keep readiness, discovery, interaction, payment, safety, visibility, reliability and outcomes distinct. Preserve evidence tiers and pass/fail/unsupported/unknown/not_available_in_region.

## Phase 13: 2026 standards refresh
- One versioned standards/provider registry: source, verified date, version, confidence/evidence and deprecation. Stale facts become unknown.
- MCP compatibility: version negotiation, remote HTTP, tool/schema discovery, safe invocation, response validation, deprecated state/session assumptions, current auth/issuer and client metadata/registration where applicable, cache/list behaviour where observable, extensions/tasks only when advertised. Evidence = verified/inferred/declared/unknown.
- Evidence-backed client profiles; generic MCP compliance stays separate from client-specific behaviour.
- Authorization Readiness: public/private boundaries, auth, scoped writes, approval boundaries, secret leakage, tenant isolation and credential persistence.
- Queue stale provider facts for verified-source review; never auto-rewrite from untrusted content.

## Phase 14: AgentPulse continuous verification
AgentPulse is an AgentReady module.
- Monitor discover -> connect -> authenticate -> invoke -> validate -> latency -> evidence. Store status/latency/error/schema fingerprint without secrets/PII.
- Safe synthetic journeys: discovery, price/availability, policies, quote/contact, booking handoff, checkout handoff without purchase, MCP calls. Writes need explicit sandbox/test support.
- Show success rate, status, defensible p50/p95, last success, consecutive failures, schema drift, auth and client/provider failures. No invented SLA.
- Fingerprint tools/descriptions/schemas/discovery metadata and detect drift.
- Deduplicated incidents, alerts and recovery history.
- Add Reliability to the AI Agents dashboard.

## Phase 15: AI visibility and choice
- Non-branded buyer-intent queries from category, products/services, geography and real intents; branded queries separate.
- Provider adapters only with legitimate supported access; otherwise unsupported/manual evidence. Record method/date/locale/model/context when available.
- Keep mentioned, cited, recommended, selected, task-completed and attributed outcomes separate.
- Compare competitors using observable evidence only: completeness, availability, policies, task success, freshness, structured data and tool reliability. Never invent hidden model reasoning.
- Why-am-I-losing report links supported gaps to fixes and verification.

## Phase 16: Fix My Site V2
- Every owned fix: finding -> preview -> approval -> apply -> verify -> rescan -> evidence -> undo. No success until verification passes.
- Formalise platform adapters beyond Shopify; distinguish automatic, developer, merchant/platform, legal and third-party work.
- Developer instructions come from evidence and require current official docs before protocol-specific changes.
- Algolia-aware remediation: detect Algolia but do not duplicate retrieval. Where present, test public/curated vs user-scoped exposure; clear index/tool descriptions; least-privilege Search credentials rather than Admin keys; relevant index/query restrictions; current price/availability context; facets/filters; Recommend discovery; authorised click/conversion/revenue instrumentation; signed-in user context for actions; ephemeral/non-leaking runtime credentials; server-side auth/input validation. Algolia absence is not a failure; score capabilities.

## Phase 17: outcome proof
- Link intent -> discovery -> agent/tool journey -> handoff -> enquiry/order -> evidence tier -> revenue where defensible and privacy-preserving.
- Attribute service quote requests, bookings, contacts and qualified leads with data minimisation.
- Dashboard verified AI revenue, identifiable referrals, reported/assisted outcomes, enquiries/bookings, defensible conversion, reliability/task success and visibility separately.
- Retain baseline/post-fix verification; no causation claim without experimental evidence.
- Optional controlled experiments record hypothesis, population/window, change, metric and result.

## Algolia findings incorporated
Algolia documents two MCP trust models: Public MCP for curated application-scoped indices/recommendations and authenticated Productivity MCP for broader user-scoped internal access. AgentReady should test these as different trust boundaries.

Public MCP exposes per-index search, facet-value search and recommendations, plus search/fetch compatibility tools for ChatGPT. Test actual capabilities/client compatibility rather than assuming one generic tool shape.

Agent Studio production patterns become diagnostics: tool descriptions affect selection; predefined constraints can apply to every call; use least-privilege Search credentials rather than Admin keys; restrict by index/query/TTL where relevant; user-specific actions run in the user's security context; runtime MCP headers should be ephemeral and unable to redirect URL/transport; authenticated actions still need server-side auth/input validation; click/conversion/revenue events are needed for meaningful analytics.

Algolia's 2026-09-15 release positions its MCP/retrieval layer as live catalogue, price, inventory, relevance and merchandising context for AI surfaces. AgentReady integrates with/verifies systems like it rather than rebuilding them.

### Algolia backlog
1. Detect Algolia.
2. Store optional public connection metadata without credentials.
3. Later add authorised least-privilege account audit.
4. Test supplied/authorised Public MCP URLs.
5. Verify search, facet and recommendation discovery.
6. Run representative buyer-intent searches.
7. Check observable price/availability freshness/completeness.
8. Audit credential scope; never request/store Admin keys where Search credentials suffice.
9. Check click/conversion/revenue events where authorised.
10. Feed evidence into AgentPulse and AI Visibility.
11. Never penalise a merchant merely for not using Algolia.

## Implementation order
Phase 13 -> Phase 14 -> Phase 16 -> Phase 15 -> Phase 17.

## Definition of done
Green tests alone are insufficient; representative checks need deployed evidence. Never make real purchases in synthetic tests, leak secrets/PII, make optional protocols mandatory, turn unknown into fail, blame merchants for provider outages without evidence, remove fix reversibility, fabricate visibility, or relabel weak attribution as verified.

## First PR
Implement Phase 13 plus AgentPulse's data model and one end-to-end MCP synthetic monitor.

### Implemented 2026-09-17 (credential-independent first slice)
- Versioned standards/provider registry with evidence basis, source, version, confidence,
  deprecation state and freshness. Stale facts become unknown and enter a review queue.
- Current MCP `2026-07-28` stateless discovery/version/header handling, while retaining an
  explicit legacy initialize fallback for older clients and servers.
- Evidence-bounded generic client profiles and Authorization Readiness findings. Unknowns remain
  unknown; client-product behaviour and tenant isolation are not guessed.
- AgentPulse target/run/step/incident schema, safe response-size/time limits, schema fingerprints,
  deduplicated incident/recovery history, observed p50/p95 and success rate.
- One end-to-end hosted-MCP synthetic journey: connect -> discover -> authenticate boundary ->
  tools/list -> invoke one explicitly read-only tool -> validate -> store redacted evidence.
- Reliability is visible in the AI Agents dashboard and can be run manually; due targets also run
  from the existing daily cron.

This is implemented and unit/integration tested, but it is **not production-verified** until the new
D1 migration is applied and the journey passes against the deployed Worker URL. Phases 15-17 and the
remaining Phase 14 journey types are still governed by the implementation order above.

## Completion implementation 2026-09-17

All five phases are now represented end to end in code. “Implemented” still does not mean
“production verified”: the final section below remains mandatory after migration and deployment.

### Phase 14 completed

- AgentPulse creates seven safe targets per hosted business: MCP, profile discovery, live
  price/availability, policies, quote/contact, booking handoff and checkout handoff.
- HTTP journeys perform one bounded GET. Handoff URLs are validated but never opened; no form,
  cart, booking or purchase is created.
- Unsupported business capabilities stay out of the failure rate. Reliability is broken down by
  journey, and schema drift is compared within a target rather than across unlike journeys.
- Algolia Public MCP can be monitored as a separate trust boundary. MCP capability evidence records
  search/facet/recommendation discovery without storing tool output or credentials.

### Phase 15 completed

- Query sets support category, geography and named products/services; branded vanity queries remain
  excluded from discovery measurement.
- Every run stores method, date, locale, model and bounded context. Unsupported provider APIs remain
  unsupported, while controlled manual observations are explicitly labelled manual.
- Mentioned, cited, recommended, selected, task-completed and attributed remain separate outcomes.
- Observable competitor comparisons cover completeness, structured data, availability, policies,
  task handoffs, freshness and AgentPulse reliability. The why-losing report links supported gaps to
  fixes and uses association language rather than invented model reasoning or causation.

### Phase 16 completed

- The platform registry makes detection, connection and write support explicit for Shopify,
  WooCommerce, WordPress, Wix, Squarespace and custom sites. Only Shopify claims implemented writes.
- Fix definitions carry their work owner and official documentation. The lifecycle is preview ->
  approval where required -> apply -> independent verify -> public rescan evidence -> undo.
- Algolia detection is capability-based and never a score requirement. Public metadata may be saved
  without credentials. An authorised audit accepts a restricted Search key for one request, stores
  only capability results, and never stores or returns the key. Admin-key configuration patterns are
  flagged from public markup without extracting a value.

### Phase 17 completed

- Signed journeys can link intent, a real scan, an AgentPulse run, a safe handoff, a data-minimised
  enquiry/booking/qualified lead and a verified order.
- Outcome events retain evidence tiers. External lead references are one-way hashed; contact identity
  is not stored.
- The outcome dashboard keeps verified revenue, identifiable referrals, reported/assisted outcomes,
  leads, task success, visibility and readiness separate.
- Optional controlled experiments store the hypothesis, population, window, change, metric and
  result. No before/after movement is described as causal without that evidence.

### Production verification still required

1. Apply migrations `0016_agentpulse.sql`, `0016_shop_scopes.sql` and
   `0017_phases_14_17.sql` to the real D1 database.
2. Deploy the Worker with its real D1 ID, public `APP_URL` and Cloudflare secrets.
3. Reconnect a Shopify development store so its granted scopes are recorded.
4. Run all seven AgentPulse journeys against the deployed hosted AI profile.
5. Apply one reversible fix, confirm independent verification, fresh scan evidence and undo.
6. Complete a signed journey through a safe handoff and a Shopify test order where available.
7. Run the launch gate. Green tests alone do not satisfy these checks.
