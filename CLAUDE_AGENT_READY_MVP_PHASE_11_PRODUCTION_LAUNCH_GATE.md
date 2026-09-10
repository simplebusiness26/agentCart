# AgentCart — Phase 11: MVP Production & Launch Gate

> Mandatory continuation of `CLAUDE_AGENT_READY_MVP_BUILD_PLAN.md`, `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE.md`, and `CLAUDE_AGENT_READY_MVP_PHASE_10_META_MUSE_ADDITIONS.md`.
>
> **AgentCart must not be called MVP-complete until Phase 11 passes.** Unit tests and mocked integrations are necessary but not sufficient. This phase proves the product works against real Cloudflare and Shopify infrastructure, hardens merchant-changing operations, and prevents AgentCart from making claims its evidence cannot support.

## Phase 11 product goal

Phase 10 increases AgentCart's capabilities. Phase 11 proves those capabilities work in the real world.

The launch gate is:

**Deploy → Connect → Verify → Diagnose → Recover → Prove → Launch**

The system should reach a state where a real Shopify development store can be onboarded, scanned, connected, fixed, re-scanned, exposed to AI systems, tested through supported agentic-commerce paths, and measured without silent failures or misleading readiness claims.

---

# 11.1 Protocol compatibility layer — ordinary web + UCP + ACP

AgentCart must not equate "AI-ready" with "Meta-ready" or "UCP-ready".

Build a provider-neutral protocol compatibility layer that can represent at least:

- ordinary browser/web checkout;
- UCP;
- ACP;
- MCP/tool-based business actions;
- provider-native commerce channels such as Shopify Meta Agentic Storefront where applicable.

### Requirements

- Keep protocol support modular behind adapters/registries rather than hard-coding logic throughout the scanner.
- Detect protocol availability and version where evidence exists.
- Record which actions each protocol can support: discovery, catalog, cart, checkout, payment handoff, order/post-purchase, booking, quote/enquiry.
- Never infer full transaction support from the presence of one protocol file or endpoint.
- Distinguish `supported`, `partial`, `unsupported`, `unknown`, and `not available in region`.
- Do not make ACP or UCP mandatory for a merchant that remains genuinely usable through ordinary web/browser-agent flows.
- Re-check current official protocol documentation before implementing version-specific assumptions.

### UI

Provider/protocol compatibility should be explainable in plain English, for example:

- Ordinary AI browser: Ready
- UCP: Ready
- ACP: Partial — checkout handoff only
- MCP business actions: Read-only
- Meta Agentic Storefront: Not available in this region

### Acceptance

- UCP and ACP are modeled independently.
- Protocol versions/capabilities are evidence-based.
- Unknown/new protocol versions do not crash the scanner.
- Ordinary web fallback remains visible rather than being treated as failure.
- Tests cover mixed-protocol merchants.

---

# 11.2 Real infrastructure launch gate — HIGH PRIORITY

The current test suite uses mocks and `node:sqlite` for much of the platform behavior. Phase 11 must prove the critical path against real infrastructure before launch.

### Required real environment

Use:

- deployed Cloudflare Worker;
- real Cloudflare D1 database;
- real remote migrations;
- real Shopify development store;
- real Shopify app/OAuth configuration;
- deployed Shopify Web Pixel extension;
- Shopify test payment/development checkout where available;
- real public AgentCart HTTPS URL.

### Mandatory real checks

Verify and record evidence for at least:

1. Cloudflare D1 migrations complete successfully.
2. `INSERT ... ON CONFLICT ... RETURNING` behaves as expected in hosted D1.
3. `DB.batch()` behavior used by AgentCart is safe on hosted D1.
4. Shopify OAuth HMAC passes with Shopify's actual callback parameter set.
5. OAuth session lifecycle works through install, dashboard access, uninstall and reinstall.
6. Shopify Web Pixel installs/updates successfully.
7. The pixel's real runtime `Origin` is observed and any enforcement rule is based on evidence rather than assumption.
8. Pixel timestamps parse correctly.
9. Product/catalog sync works against the real Admin GraphQL API.
10. A real proposed Shopify fix can be previewed, approved, applied and independently verified.
11. A re-scan shows the expected before/after effect without fabricating score gains.
12. Public AgentCart AI profile/catalog/actions endpoints work against real connected-store data.
13. MCP endpoints work against the real normalized merchant profile.
14. `agents.md`, `llms.txt`, `llms-full.txt`, and `/.well-known/ucp` detection behaves correctly against the real store/environment where available.
15. A safe live agent journey reaches cart/checkout handoff and stops before a real charge unless an explicit Shopify test transaction is being used.
16. Pixel `checkout.order.id` and server-side order identifiers are proven joinable where verified order attribution is enabled.
17. Monitoring cron runs in real Cloudflare and creates a real subsequent scan/history entry.
18. App uninstall removes/revokes the merchant session and prevents further authenticated dashboard access.

### Evidence record

Create a launch-verification record/checklist that stores or documents:

- environment;
- timestamp;
- check name;
- pass/fail;
- safe diagnostic evidence;
- failure reason;
- remediation state;
- application commit/version.

Never store secrets in the evidence record.

### Hard rule

`npm test` + green GitHub Actions alone must **never** set the MVP status to complete. The production launch gate must pass.

---

# 11.3 Connection Health and self-diagnosis

A successful OAuth callback does not mean every AgentCart subsystem is healthy.

Add a merchant-facing Connection Health model that reports each important subsystem independently.

### Initial health checks

At minimum:

- Shopify authorization;
- required scopes/reauthorization;
- catalog sync;
- last successful sync;
- Web Pixel installation/status;
- event ingestion;
- verified order/webhook path if enabled;
- hosted AI layer;
- MCP availability;
- discovery files;
- UCP/ACP capability status;
- Meta channel/readiness where applicable;
- monitoring/cron freshness;
- last readiness scan;
- fix engine health;
- data freshness.

Use states such as:

- Healthy
- Needs attention
- Failed
- Waiting for merchant action
- Not enabled
- Not available in region
- Unknown

### Recovery actions

Where safe, provide explicit actions such as:

- Retry sync
- Reconnect Shopify
- Retry pixel activation
- Regenerate AI profile
- Re-run readiness scan
- Re-run protocol check
- Re-run live journey verification

Do not hide partial failure behind a generic "Connected" badge.

### Acceptance

- A merchant can identify which subsystem failed without reading Worker logs.
- Non-fatal install failures appear prominently in Connection Health.
- Retry paths are safe and idempotent.
- Health state is backed by stored evidence/timestamps rather than frontend-only state.

---

# 11.4 Operational reliability and observability

`/health` must evolve from "the Worker process responds" into meaningful application health.

### Add operational state

Track enough information to diagnose production failures, including:

- last successful and failed Shopify sync;
- last monitoring run;
- webhook processing failures;
- failed/retried fixes;
- stale data counts;
- failed protocol/profile checks;
- live journey verification failures;
- rate-limit/abuse events where useful;
- database/migration version;
- important background-task failures.

### Health endpoints

Keep a simple public liveness endpoint, but add a protected/internal diagnostic health view or endpoint that can report subsystem status without exposing secrets or private merchant data.

Suggested split:

- `/health` — liveness only;
- protected operational status — readiness of D1, sync/cron/webhooks/failure queues and deployment version.

### Logging

- Use structured log events with stable event/error codes.
- Avoid logging access tokens, cookies, HMAC secrets, customer PII or payment data.
- Include correlation/request IDs where useful.
- Ensure merchant-visible error messages remain understandable while internal diagnostics preserve enough context to debug.

### Failure handling

- Classify retryable vs permanent errors.
- Back off repeated external API failures.
- Never create infinite retry loops.
- Preserve the last known good merchant data while marking it stale when refresh fails.

### Acceptance

- Important failures are visible without reproducing them manually.
- Repeated failures do not hammer Shopify/Meta/Stripe endpoints.
- Production health can identify degraded subsystems while Worker liveness remains green.

---

# 11.5 Merchant-write security hardening

Phase 10 protects agent-originated actions. Phase 11 must explicitly harden merchant dashboard mutations too.

### Mandatory controls

For every merchant-changing route/action:

- require a valid current merchant session;
- verify the target shop belongs to that session;
- enforce tenant/shop isolation at the service/data layer, not only the UI;
- add CSRF protection for browser-originated state-changing requests, or an equivalently strong same-origin mechanism appropriate to the deployed architecture;
- validate `Origin`/`Sec-Fetch-*` or equivalent signals where reliable and compatible;
- use POST/PUT/PATCH/DELETE semantics appropriately for mutations;
- reject oversized or malformed request bodies;
- require explicit approval for approval-required fixes;
- add replay protection/idempotency where repeated calls could cause duplicate effects;
- audit successful and failed mutation attempts without storing secrets;
- fail closed on authorization ambiguity.

### Security tests

Add explicit tests for:

- cross-shop access attempts;
- forged/expired sessions;
- CSRF-style cross-origin mutation attempts;
- replayed approval/apply requests;
- changed shop identifiers in route/body/query;
- stale authorization after uninstall/reinstall;
- over-large/malformed JSON;
- attempts to apply another merchant's fix;
- attempts to activate/deactivate another merchant's AI profile.

### CSP/session review

Review the production CSP and cookie policy again after Phase 10 UI/protocol features land. Remove `'unsafe-inline'` where practical rather than treating the current CSP as final forever.

### Acceptance

No state-changing merchant action is reachable using only knowledge of a shop/domain/fix ID.

---

# 11.6 Reversible fixes / Undo

AgentCart should not ask a merchant to trust irreversible automatic changes.

For every fix that modifies merchant-owned data and can be safely reverted, implement an explicit rollback/undo path.

### Requirements

Each reversible fix should preserve:

- original value/state;
- applied value/state;
- verification evidence;
- rollback eligibility;
- rollback expiry/limitations if any;
- rollback result and timestamp.

### UI

After a verified change, show:

- what changed;
- old value;
- new value;
- when AgentCart changed it;
- whether it is reversible;
- `Undo` where supported.

### Rollback rules

- Never overwrite a newer merchant change with an old rollback snapshot.
- Before undo, re-read current platform state and confirm it still matches the AgentCart-applied version or can otherwise be safely reconciled.
- If the merchant changed the field afterwards, stop and explain instead of blindly restoring stale data.
- Verify rollback independently after applying it.
- Record rollback in the audit trail.

### Acceptance

- At least the initial Shopify content/SEO mutations have a tested rollback where platform APIs make rollback safe.
- Concurrent merchant edits are protected from destructive rollback.
- Failed rollback is visible and does not falsely report restored state.

---

# 11.7 Score calibration against real agent journeys

The Agent Ready score must correlate with whether an AI can actually use the business.

Build a small benchmark/calibration suite rather than trusting hand-authored weights forever.

### Benchmark set

Include representative controlled fixtures/environments such as:

- strong Shopify store with clean product data and working checkout;
- store with missing structured data but usable browser checkout;
- store with inaccessible/ambiguous controls;
- store with stale/missing price or stock;
- service business with booking/quote flow;
- crawler-blocked business;
- UCP-ready merchant;
- ACP-capable/handoff merchant where testable;
- deliberately broken protocol profile;
- region-unavailable provider capability.

### Ground truth

For connected/test environments, compare scanner results against Live Agent Journey Verification.

Track false positives such as:

- high score but journey fails;
- "purchase ready" but no reachable checkout;
- "discoverable" but required crawler is blocked;
- "fresh stock" based on stale cache.

Track false negatives such as:

- ordinary browser-agent journey works even though no UCP/ACP is present.

### Scoring governance

- Keep scoring deterministic.
- Version every scoring-model change.
- Do not rewrite historical scores.
- Document why weights/rules changed.
- Prefer evidence-backed adjustments over arbitrary score inflation.

### Acceptance

Do not market the score as validated until the benchmark set demonstrates that high scores consistently correspond to successful supported journeys and important failures produce meaningful deductions/warnings.

---

# 11.8 Ownership and authority boundary for non-Shopify businesses

For MVP, arbitrary public websites can be scanned, but AgentCart must not let an unverified person publish or mutate an authoritative AI profile for a business they do not control.

### MVP rule

- Public URL scan/report: allowed without ownership proof.
- Shopify connected profile/actions/fixes: ownership/control proven through Shopify OAuth.
- Non-Shopify authoritative hosted profile, write access or business configuration: **do not enable until ownership can be verified**.

Plan future verification methods such as:

- WordPress/WooCommerce OAuth/plugin authorization;
- DNS TXT verification;
- signed well-known file;
- HTML meta/file challenge;
- other appropriate platform-native authorization.

Do not make a weak email-domain guess equivalent to ownership.

### Acceptance

An unauthenticated user cannot claim another company's public scan and publish authoritative AgentCart business instructions for it.

---

# 11.9 MVP launch checklist and status

Create one authoritative launch checklist/status rather than scattering readiness across docs.

Suggested categories:

### Infrastructure
- Worker deployed
- D1 deployed/migrated
- cron active
- production environment/version recorded

### Shopify
- OAuth live-verified
- scopes correct
- sync live-verified
- Web Pixel live-verified
- uninstall/reinstall verified
- fix apply/verify/undo verified

### Agent readiness
- real scan works
- hosted AI layer works
- MCP works
- discovery files work
- UCP works where supported
- ACP compatibility assessment works
- live journey verification works

### Attribution
- browser event attribution works
- server-side order attribution works where enabled
- unknown stays unknown
- direct agentic checkout path has a verified attribution strategy

### Security/privacy
- merchant mutation security tests pass
- tenant isolation passes
- compliance webhooks verified
- no secret/PII leakage
- privacy/terms/contact details finalized before public customers

### Reliability
- Connection Health implemented
- operational diagnostics implemented
- retries/backoff tested
- stale data represented honestly

### Product validation
- benchmark score calibration completed
- mobile UX smoke-tested
- first real development-store journey completed

The app/repo may expose an internal launch status:

- `Development`
- `Code complete`
- `Live verification incomplete`
- `MVP launch ready`

Only the final state may be used after all mandatory launch-gate checks pass.

---

# 11.10 Required automated and live tests

Automated CI must continue to run the full existing suite plus Phase 10/11 tests.

Add automated coverage for:

- ACP/UCP protocol compatibility model;
- Connection Health transitions;
- retry/backoff behavior;
- merchant-write authorization and tenant isolation;
- CSRF/cross-origin mutation rejection;
- reversible fix rollback and concurrent merchant edits;
- launch-gate state machine;
- benchmark/scoring fixtures;
- non-Shopify ownership boundary;
- diagnostics redaction/no-secret logging.

Separately maintain a **live verification checklist** for the real Cloudflare + Shopify development environment. Live checks must not be faked by test fixtures.

---

# 11.11 Phase 11 definition of done

Phase 11 is not complete until all of the following are true:

- [ ] AgentCart represents ordinary web, UCP and ACP independently.
- [ ] Protocol support is evidence-based and version-aware.
- [ ] A real Cloudflare Worker and real remote D1 have passed the launch-verification checklist.
- [ ] A real Shopify development store has completed OAuth, sync, scan, AI-layer and Web Pixel verification.
- [ ] Hosted D1 behavior used by AgentCart has been validated.
- [ ] Shopify's real OAuth callback behavior has been validated.
- [ ] Pixel Origin/timestamps have been observed and handled from evidence.
- [ ] A real Shopify fix has been previewed, applied, independently verified and safely undone where reversible.
- [ ] A real re-scan demonstrates before/after results.
- [ ] Live Agent Journey Verification succeeds on at least one supported Shopify development-store path.
- [ ] No real payment is accidentally charged by verification.
- [ ] Connection Health exposes subsystem-specific failures and retry actions.
- [ ] Operational diagnostics cover sync, cron, webhooks, fixes, freshness and protocol/journey failures.
- [ ] Merchant-changing routes pass explicit authorization, tenant-isolation, CSRF/origin and replay tests.
- [ ] Reversible Shopify fixes have tested rollback safety where feasible.
- [ ] Agent Ready scoring has been compared against controlled real/safe agent journeys.
- [ ] Historical score versions remain interpretable.
- [ ] Public scans do not grant ownership of arbitrary businesses.
- [ ] Non-Shopify authoritative profile/write access remains blocked until ownership is verified.
- [ ] Existing Phase 0–10 tests remain green.
- [ ] Phase 11 automated tests remain green.
- [ ] Remaining owner/account/legal actions are accurately listed in `docs/USER_ACTIONS.md`.
- [ ] The authoritative launch status can truthfully be set to `MVP launch ready`.

---

# 11.12 Exact implementation priority

Implement Phase 11 in this order unless a hard dependency requires otherwise:

1. **Real infrastructure launch-gate framework/checklist.**
2. **Connection Health and subsystem status model.**
3. **Merchant-write security hardening.**
4. **Operational reliability/observability.**
5. **Protocol compatibility layer including ACP alongside UCP and ordinary web.**
6. **Reversible fixes / Undo.**
7. **Real Cloudflare + Shopify development-store verification.**
8. **Score calibration against live agent journeys.**
9. **Non-Shopify ownership boundary enforcement.**
10. **Final launch checklist, documentation and mobile smoke test.**

Do not add unrelated feature scope while this phase is incomplete.

---

# Final MVP rule

The combined MVP should make this statement defensible:

> **A merchant can connect a real Shopify store to AgentCart, see whether major AI purchasing paths can discover and use it, safely improve what is fixable, verify a real AI shopping journey without unintended charges, understand any broken subsystem, reverse supported changes, and measure AI-driven commerce using honest evidence — with the result proven on real production-like infrastructure rather than mocks alone.**

Once this is true, stop expanding MVP scope and put real merchants through the product.