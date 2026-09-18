# AgentReady Phases 18–29 — Implementation Status

Updated 2026-09-18 from branch `codex/phases-18-29`.

## Status rule

- **Code-ready** means the migration, service boundary, API, merchant UI and credential-independent verification exist.
- **Demo** means a truthful AgentReady-controlled simulation exists.
- **Ready** means real merchant data can be prepared and validated as far as AgentReady controls it.
- **Live** is reserved for a deployed production integration tested with the external provider/platform.

Green tests never turn an external provider into Live.

## Completed credential-independent implementation

| Phase | Delivered in this branch | Status before production setup |
| --- | --- | --- |
| 18 | Canonical Business Brain; source/freshness/public-safety provenance; structured Sales Agent configuration and versions; grounded deterministic preview; safe actions; pause/activate control | Code-ready |
| 19 | Versioned deterministic scenario library; factual/action validators; stored regression runs/results; synthetic vs production evidence classes kept separate | Code-ready |
| 20 | Provider-independent channel capabilities; AgentReady Hosted package; OpenAI readiness-only package; Demo → Ready → Live state model | Demo + Ready skeleton |
| 21 | PII-minimised conversation event summaries; channel/journey/handoff context; existing signed journeys/outcome evidence reused | Code-ready |
| Scanner Superset | Versioned Auspia/Peec capability registry; no legitimate benchmark capability omitted because it lacks an auto-fix; bounded emerging-standard probes | Code-ready; runtime evidence still required where stated |
| Path to 100 | Every applicable non-pass becomes an owned remediation route with recoverable points, steps and verification; provider-blocked/optional checks remain neutral | Code-ready |
| 22 | Unified customer-question/fanout opportunity model; buyer intent, confidence and evidence; no invented volume/difficulty | Code-ready |
| 23 | Deterministic page intelligence; Business Brain-grounded briefs and drafts; claim-to-fact map; approval-first CMS adapter registry | Code-ready; live CMS writes intentionally gated |
| 24 | Search/AI/business-outcome measurement schema; evidence-specific learning states; experiment infrastructure reused | Code-ready; real Search Console data needs connection |
| 25 | Atomic prompt-run model; visibility, position, all-brand share of voice, sentiment evidence, filters, trends, CSV API and authenticated MCP | Code-ready |
| 26 | Observed/manual/synthetic fanouts kept separate; repeated terms, brand injection, source/citation intelligence and fanout-to-opportunity routing | Code-ready |
| 27 | First-party crawler observation adapters/contracts; crawler failure summaries; perception themes; deterministic Business Brain misinformation alerts | Code-ready; real log sources need connection |
| 28 | SKU-level shopping observations; win/position; quoted-vs-canonical price checks; competitor/attribute/source evidence; fix/retest action creation | Code-ready |
| 29 | Evidence-tier referrals continue through existing attribution; analytics action router; CSV export; merchant API/MCP access; before/after fields and experiment reuse | Code-ready |

## New migrations

- `0018_phases_18_21.sql`
- `0019_phases_22_24.sql`
- `0020_phases_25_29.sql`

They are non-destructive and preserve existing Phase 1–17 data.

## New merchant APIs

### Business Brain and Sales Agent

- `GET /api/business-brain`
- `POST /api/business-brain/sync`
- `GET|POST /api/sales-agent`
- `POST /api/sales-agent/preview`
- `POST /api/sales-agent/test`
- `GET /api/sales-agent/package?channel=agentready_hosted`
- `POST /api/sales-agent/events`

### Scanner Superset and growth

- `GET /api/readiness/benchmark`
- `POST /api/readiness/path-to-100`
- `GET|POST /api/growth`
- `POST /api/growth/brief`

### Analytics Superset

- `GET /api/analytics`
- `POST /api/analytics/prompt-runs`
- `POST /api/analytics/fanouts/synthetic`
- `POST /api/analytics/crawlers`
- `POST /api/analytics/perception`
- `POST /api/analytics/shopping`
- `GET /api/analytics/export.csv`
- `POST /api/analytics/mcp` — authenticated, read-only merchant MCP

## Truthful limitations

The following are not marked Live by this implementation:

1. OpenAI Sponsored Agent activation or eligibility.
2. Provider prompt/fanout traces that the provider does not expose.
3. Search Console data without merchant OAuth.
4. Cloudflare/Vercel/WordPress crawler logs before a real adapter is connected.
5. WordPress, WooCommerce, Shopify or Webflow content publication before merchant authorisation and rollback verification.
6. Production revenue/outcomes without real signed handoffs and verified downstream events.

Where those dependencies are unavailable, AgentReady supplies a functional demo, readiness package, data contract, ingestion route and verification boundary. It never substitutes synthetic data for observed production evidence.

## Owner completion gate

After this branch is deployed:

1. Apply the remote D1 migrations.
2. Connect one development merchant and sync its real catalogue/profile.
3. Sync and inspect its Business Brain.
4. Run its Sales Agent regression suite and resolve high-severity failures.
5. Connect only the external analytics/log/CMS providers the merchant authorises.
6. Run the existing production launch gate.
7. Verify Demo, Ready and Live labels against the deployed application.

