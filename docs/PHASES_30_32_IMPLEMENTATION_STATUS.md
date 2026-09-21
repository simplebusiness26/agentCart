# AgentReady Phases 30–32 — Implementation Status

Updated 2026-09-21 from branch `codex/phases-30-32`.

## Status rule

- **Code-ready** means the data model, service boundary, authenticated API, merchant UI and
  credential-independent tests exist.
- **Observed** means a real public or authorised source was checked and evidence was stored.
- **Live** requires the production deployment, a real merchant/provider connection and successful
  end-to-end verification. Tests cannot create Live status.

## Delivered

| Phase | Credential-independent implementation | Pre-deployment status |
| --- | --- | --- |
| 30 | Shopify native UCP 2026-08-25 discovery/parser; capability and transport evidence; development-store-only safe negotiation; OpenAI nine-field commerce-feed validation and download-only preview; separate OAI-AdsBot diagnostic; existing optional Algolia detection/ephemeral search audit; Lighthouse Agentic Browsing report adapter | Code-ready |
| 31 | Answer-span prominence; reusable 30-day category/industry panels; evidence-backed brand attribute association, attribute market prominence and competitor shapes; encrypted read-only GA4 OAuth/import; assistant/session/landing-page/country/device/engagement/conversion/revenue dimensions with separate evidence tiers | Code-ready |
| 32 | Prompt-injection detection across tool metadata and outputs; read-versus-mutate classification; identity, scope, approval, idempotency, rollback and verification findings; AgentPulse integration; applicability gate for non-transactional sites | Code-ready |

## New migration

- `0021_phases_30_32.sql`

It is non-destructive and preserves all Phase 1–29 data.

## New merchant APIs

- `GET /api/commerce/readiness`
- `POST /api/commerce/ucp/probe`
- `POST /api/commerce/ucp/negotiate` — explicit development-store opt-in only
- `GET /api/commerce/openai-feed.jsonl` — preview/download, never provider upload
- `POST /api/commerce/ads-measurement/assess` — consent and browser/server deduplication readiness only
- `POST /api/commerce/lighthouse/import`
- `GET /api/analytics/market`
- `POST /api/analytics/referrals/import`
- `GET /api/analytics/ga4`
- `GET /api/analytics/ga4/connect`
- `GET /api/analytics/ga4/callback`
- `POST /api/analytics/ga4/property`
- `POST /api/analytics/ga4/import`
- `GET /api/security`
- `POST /api/security/assess`

## Release honesty

This branch does not claim:

1. that every Shopify store publishes native UCP;
2. that OpenAI has accepted or displayed a generated feed;
3. that OAI-AdsBot reachability makes a merchant eligible for ads;
4. that Algolia is required for readiness;
5. that Lighthouse's experimental fraction equals the AgentReady score;
6. that GA4 imported revenue is the same evidence as a verified platform order; or
7. that the presence of a callable tool makes it safe to perform consequential actions.

## Owner completion gate

1. Apply remote migration `0021`.
2. Deploy the Worker with the Phase 30–32 code.
3. Observe native UCP on a connected Shopify development store.
4. Inspect, but do not automatically upload, the OpenAI feed preview.
5. Configure and authorise GA4 only if the merchant wants historical/referral evidence.
6. Import a real Lighthouse Agentic Browsing report where supported.
7. Run AgentPulse and tool-security checks against real authorised endpoints.
8. Keep each provider surface at Code-ready or Observed until production evidence proves Live.


## Post-Phase-32 market refresh

A 2026-09-21 follow-up market review found additional work after this phase set:

- Phase 33: AI Shelf analytics, prompted by current agentic-commerce optimisation evidence and competitor movement.
- Phase 34: authorised Google Merchant Center AI performance/conversational product evidence and Shopify agentic-channel state.
- Phase 35: WebMCP Fix My Site installer/action layer and real browser-runtime verification.

See:
- `docs/MARKET_REFRESH_2026_09_21_PHASES_33_35.md`
- `docs/PHASE_35_WEBMCP_FIX_MY_SITE_BUILD_PLAN.md`

These newer gaps did not invalidate the credential-independent completion of Phases 30–32. Their code-ready implementation is now recorded in `docs/PHASES_33_35_IMPLEMENTATION_STATUS.md`; production verification remains open.
