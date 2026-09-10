# AgentCart — Phase 10 Mandatory Additions

> This file is a mandatory continuation of `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE.md` and therefore part of Phase 10 itself.
>
> Phase 10 is **not complete** unless the original Meta/Muse plan and all six additions below are implemented, tested and documented. Preserve all existing work and do not regress the current scanner, Shopify sync, hosted AI layer, attribution, security, fix engine, monitoring or test suite.

## Updated Phase 10 end-state

AgentCart should be able to prove as much of this journey as the merchant/platform safely permits:

**Discover → Understand → Act → Pay → Fulfil → Support → Attribute**

The system must distinguish static evidence from live verification, current data from stale data, anonymous agents from authenticated agents, and ordinary web checkout from protocol-native agentic commerce.

---

# 10.9 UCP discovery and `/.well-known/ucp`

UCP must be treated as a first-class agent-commerce capability rather than inferred from ordinary page markup.

### Build

For supported businesses, especially Shopify:

- fetch and parse `/.well-known/ucp` where present;
- record the advertised UCP version;
- record declared capabilities and supported extensions;
- identify cart, checkout, order, payment/handoff and other advertised commerce capabilities where the profile exposes them;
- validate that the document is parseable and internally consistent enough for AgentCart to rely on it;
- distinguish missing, invalid, unsupported-version and unknown states;
- store the discovery timestamp and enough raw evidence to explain the result;
- keep the parser version-aware so a new UCP revision does not require rewriting the whole scanner;
- never invent a capability that the profile does not advertise.

Where AgentCart exposes its own hosted commerce/action layer, design for an AgentCart-owned UCP discovery profile only where AgentCart genuinely backs the advertised capabilities.

`agents.md`, `llms.txt`, MCP and UCP are complementary. Do not treat one as a replacement for all the others.

### UI

Show plain-English output such as:

- UCP discovered: Yes / No / Unknown
- UCP version: supported / old / unknown
- Cart capability: Ready / Missing
- Checkout capability: Ready / Handoff only / Missing
- Orders/post-purchase: Ready / Missing

Keep raw protocol details secondary to merchant outcomes.

### Acceptance

- valid `/.well-known/ucp` is parsed correctly;
- malformed profiles fail safely;
- unknown/newer versions do not crash the scan;
- unsupported versions are not falsely marked fully ready;
- declared capabilities are not inferred beyond evidence;
- tests cover missing, valid, malformed and version-mismatch profiles.

---

# 10.10 Agent identity, authentication and buyer authorization

Agent commerce should not be represented as one universal access level. A merchant may expose different capabilities to anonymous agents, cryptographically identified agents, authenticated agents or a buyer-authorized session.

### Build a trust/capability model

Represent at least:

- anonymous agent access;
- identified/signed agent access where the protocol supports it;
- authenticated/token-based agent access where supported;
- buyer-linked authorization/consent state where required;
- actions that require additional human confirmation;
- rate-limit or capability differences by trust level where known.

For supported UCP/Shopify flows, inspect current official authentication requirements before implementing assumptions. Keep provider/protocol authentication logic modular.

Where signed HTTP requests are required, use the relevant current standard rather than inventing a proprietary signature format. Verify signatures, timestamps/nonces and replay protection as appropriate.

Never let AgentCart impersonate a buyer or bypass required user approval.

### Report questions

AgentCart should be able to answer:

- Can an anonymous AI discover/shop this business?
- What extra capabilities become available to an authenticated/verified agent?
- Which actions require buyer authorization?
- Which steps still require human confirmation?

### Acceptance

- authorization state is separate from general site readiness;
- unsupported authentication modes are reported honestly;
- invalid signatures/tokens fail closed;
- no long-lived buyer/payment secret is exposed through the public AI layer;
- tests cover anonymous, authenticated, unauthorized and expired/replayed requests where applicable.

---

# 10.11 Transaction idempotency, retry and duplicate protection

Every mutating agent action must be safe to retry. A network timeout must not create duplicate carts, bookings, quote requests or purchases.

### Requirements

For future mutating actions such as `create_cart`, `update_cart`, `create_booking`, `request_quote`, checkout creation/completion or order-related operations:

- accept/use an idempotency key where the underlying protocol/platform supports one;
- generate stable operation identifiers for AgentCart-owned actions;
- prevent the same operation from being applied twice within its validity window;
- persist enough state to return the prior safe result on a legitimate retry;
- add expiry/retention rules for operation keys;
- protect against replay where signatures/authentication are involved;
- preserve audit records of attempted/completed operations;
- distinguish retryable failures from permanent validation failures;
- never silently repeat a high-impact action after an ambiguous response without checking state first.

Do not attempt to replace Shopify/Stripe/platform-native idempotency when it exists. Pass through and respect the platform mechanism.

### Acceptance

- repeated identical requests produce one logical mutation;
- network-timeout simulation does not create duplicate side effects;
- changed payload with reused key is rejected or handled safely;
- expired keys have defined behavior;
- tests cover concurrent/repeated requests.

---

# 10.12 Real-time data and freshness

Agent readiness is not useful if an AI is given yesterday's price, stale availability or an outdated policy.

### Add freshness metadata

Every normalized business/catalog/action datum that can materially affect a transaction should support provenance and freshness where practical:

- source;
- source updated timestamp if available;
- AgentCart fetched/synced timestamp;
- freshness status;
- refresh/error state.

Prioritize:

- price;
- currency;
- stock/availability;
- variants;
- shipping/delivery options;
- booking/service availability where integrated;
- returns/refund/cancellation policies;
- supported actions;
- provider/protocol capability profiles such as UCP.

### Freshness behavior

Define documented thresholds by data type rather than one arbitrary global timeout.

Possible states:

- Fresh
- Aging
- Stale
- Unknown
- Refresh failed

Before AgentCart gives a high-confidence transactional answer from its hosted AI layer, refresh or downgrade confidence for stale high-impact data where feasible.

Never state `in stock`, a current price or a confirmed booking slot purely from stale cached data when the authoritative source cannot be verified.

Monitoring should detect important freshness failures and stale-sync conditions.

### Acceptance

- cached records include usable freshness/provenance metadata;
- stale price/stock is visibly distinguished from fresh data;
- refresh failure does not silently serve stale data as current;
- tests use deterministic clocks to cover threshold transitions;
- provider/UCP capability profiles are periodically rechecked because protocol support can change.

---

# 10.13 Post-purchase and order readiness

Agentic commerce should not end when payment succeeds. Add a post-purchase capability model so AgentCart can eventually tell merchants whether AI customers can continue to manage legitimate order/support tasks.

### Assess/support where the platform exposes it

- retrieve order status;
- fulfilment/shipping status;
- tracking information;
- cancellation eligibility;
- return eligibility/process;
- refund status;
- exchanges where supported;
- order edits where supported;
- merchant support/contact escalation.

For UCP/Shopify, detect advertised Order MCP/order-management capabilities from current official profiles/documentation rather than assuming they exist.

### Privacy and authorization

Post-purchase data is private. Public AI endpoints must never expose customer/order information.

Any future order lookup/action must require appropriate authenticated buyer authorization and use the minimum necessary data.

Do not make broad historical order access a public MCP tool.

### UI

For merchants, show a readiness summary such as:

- AI can check order status: Ready / Not configured / Unsupported
- AI can provide tracking: Ready / Partial
- AI-assisted returns: Ready / Manual handoff
- Refund visibility: Ready / Manual / Unknown

### Acceptance

- public/anonymous requests cannot retrieve private orders;
- authorized and unauthorized paths are tested;
- absence of post-purchase capability does not falsely imply the initial checkout is broken;
- capability evidence is kept separate by stage.

---

# 10.14 Live Agent Journey Verification

Static scanning should remain cheap and deterministic, but a connected merchant needs a stronger optional verification level that actually exercises a safe agent journey.

### Verification levels

Keep two clearly labelled levels:

1. **Static readiness scan** — HTML/API/config evidence; no claim that an end-to-end journey completed.
2. **Live verified journey** — AgentCart successfully exercised a safe non-destructive path against the merchant's real integration or approved test environment.

### Initial commerce journey

Where supported, verify:

1. discover merchant/product;
2. retrieve current product data;
3. select product/variant;
4. create or simulate an allowed cart;
5. update quantity where safe;
6. retrieve totals/currency;
7. retrieve delivery/shipping options where possible;
8. reach checkout or obtain a valid checkout handoff;
9. verify payment capability/approval handoff exists;
10. **stop before charging real money unless a purpose-built merchant test/sandbox flow explicitly permits a test transaction**.

For Shopify/UCP/MCP-enabled merchants, prefer protocol-native validation over brittle browser scraping when possible.

For service businesses, the same framework should later support a safe journey such as discover service → identify required fields → obtain availability/quote path → reach booking/enquiry handoff without submitting a real unwanted booking.

### Evidence

Persist:

- verification timestamp;
- provider/protocol;
- steps attempted;
- step result and evidence;
- failure point;
- test/sandbox/live-readonly mode;
- data freshness at verification time.

Expose a merchant-facing statement only when justified, e.g.:

> **AgentCart successfully verified an AI shopping journey through this store today.**

Never display that statement based only on static markup.

### Safety

- default to non-destructive verification;
- never submit a real payment without an explicit purpose-built test flow;
- do not create unwanted real bookings/orders/messages;
- use idempotency for every safe mutation used during verification;
- clean up test carts/resources where practical;
- rate-limit journey verification;
- keep credentials server-side and scoped.

### Acceptance

- complete test fixture produces a successful verified journey;
- failure at any step is reported precisely;
- static scans never inherit a live-verified badge;
- no real payment is attempted by the automated test suite;
- retries cannot duplicate mutations;
- timestamps/freshness are recorded.

---

# Required integration with the existing Phase 10 dashboard

The provider compatibility dashboard defined in the original Phase 10 document must now also expose, where applicable:

- UCP discovery/version;
- anonymous vs authenticated-agent capability;
- buyer authorization requirement;
- information freshness;
- live journey verification status/date;
- post-purchase/order capability.

Keep the overall Agent Ready score understandable. These can initially be capability dimensions rather than forcing every item into the 100-point score. If headline scoring changes materially, bump `SCORING_VERSION`.

---

# Additional automated tests required

Add tests for all six additions, including at minimum:

### UCP
- valid profile;
- missing profile;
- malformed profile;
- unknown/new version;
- capability parsing without invention.

### Authentication/trust
- anonymous capability;
- authenticated capability;
- invalid/expired authorization;
- replay protection where signed requests are supported.

### Idempotency
- duplicate request produces one mutation;
- concurrent retry;
- same key/different payload;
- timeout then safe retry.

### Freshness
- fresh/aging/stale transitions;
- failed refresh;
- stale stock/price is not represented as current.

### Post-purchase
- public order access denied;
- authorized order capability fixture;
- unsupported order capability represented honestly.

### Live journey
- full safe success;
- each important failure stage;
- verification evidence persisted;
- no-payment boundary enforced;
- live badge never produced by static-only evidence.

CI must continue running typecheck plus the entire existing and Phase 10 test suite.

---

# Updated Phase 10 definition of done

In addition to every checkbox in `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE.md`, Phase 10 is not complete until:

- [ ] `/.well-known/ucp` is discovered, parsed and version-aware for supported merchants.
- [ ] UCP capabilities are evidence-based rather than inferred.
- [ ] Agent identity/authentication/buyer-authorization state is represented.
- [ ] Mutating agent actions have idempotency/retry protection.
- [ ] High-impact commerce data has provenance/freshness state.
- [ ] Stale price/stock is not presented as verified current information.
- [ ] Post-purchase/order readiness exists as a separate capability stage.
- [ ] Private order data is never available through public AI endpoints.
- [ ] Live Agent Journey Verification exists for at least one supported Shopify test/connected flow.
- [ ] Live verification stops safely before a real charge unless an explicit sandbox/test transaction is being used.
- [ ] Provider compatibility UI exposes UCP, trust/auth, freshness, live verification and post-purchase capability.
- [ ] Automated tests cover all six additions.
- [ ] Documentation and `docs/USER_ACTIONS.md` are updated for any new merchant/account actions.

---

# Updated implementation priority

Keep the original Phase 10 priorities, but integrate the six additions in this practical order:

1. Server-side Meta/agentic attribution support.
2. Meta/Shopify Agentic Storefront readiness.
3. **UCP discovery and `/.well-known/ucp` validation.**
4. Meta crawler/discovery + `agents.md` support.
5. Agent interaction readiness.
6. Payment/transaction readiness.
7. **Information freshness/provenance.**
8. **Agent identity/authentication/buyer authorization.**
9. **Idempotency/retry safety before enabling any mutating agent action.**
10. Agent safety/content-integrity checks.
11. **Live Agent Journey Verification.**
12. **Post-purchase/order readiness.**
13. Provider compatibility dashboard, scoring/version review and documentation polish.

The combined Phase 10 end-state should make this statement true:

> **AgentCart can tell a merchant whether AI agents such as Meta Muse can discover the business, understand fresh product/service data, authenticate at the appropriate trust level, safely take supported actions, reach a valid checkout/payment handoff without duplicate transactions, continue into supported post-purchase flows, and allow resulting AI-driven commerce to be measured honestly — with a live verified journey where AgentCart has actually tested it.**
