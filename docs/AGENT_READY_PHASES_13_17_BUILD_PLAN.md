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