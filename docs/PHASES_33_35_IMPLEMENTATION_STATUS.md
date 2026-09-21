# AgentReady Phases 33–35 — implementation status

Updated 2026-09-21 on `codex/phases-30-32`.

## Status rule

- **Code-ready**: credential-independent model, storage, authenticated boundary, owner UI and tests exist.
- **Observed**: a real authorised/public source was checked and scoped evidence was retained.
- **Live**: production deployment and a real merchant/provider journey passed end to end.

No phase in this document is Live.

| Phase | Delivered | Current status |
| --- | --- | --- |
| 33 | Merchant-scoped AI Shelf recommendation share, competitor share, provider/surface source mix, SKU evidence and action routing foundation | Code-ready |
| 34 | Scoped organic Merchant Center AI-performance export import; verified-fact conversational-product readiness/preview; authorised Shopify agentic-channel observations with server-side attribution rules | Code-ready |
| 35 | Applicability-aware action mapper; provider/native/API/WordPress/generic/handoff router; reversible WordPress/WooCommerce plugin; versioned browser adapter; PayPal eligibility router; fail-safe tool security; authorised runtime verification and rollback state | Code-ready |

## Review corrections included

The release review's five code blockers are resolved:

1. Category/industry benchmark panels now live in `merchant_industry_benchmarks` and every read/write is constrained by `shop_domain`; a two-shop isolation test is included.
2. Only `readOnlyHint: true` is treated as read-only. Camel-case, hyphenated, noun-style and unannotated tools are fail-safe consequential.
3. Declared identity and independently verified identity are separate; a display label cannot pass the identity finding.
4. Pasted referral rows use `manual_import`; only the successful OAuth/Data API path uses `authorised_ga4`.
5. The phone-first Commerce & Security dashboard now provides controls for GA4 property/import, UCP negotiation, Lighthouse import, Algolia audit, security assessment and WebMCP planning.

## Migration and main surfaces

- `migrations/0022_phases_33_35.sql`
- `GET /api/commerce/channels`
- `POST /api/commerce/merchant-ai/import`
- `GET /api/commerce/conversational-products`
- `POST /api/commerce/shopify-channels/import`
- `GET /api/webmcp`
- `POST /api/webmcp/plan`
- `GET /api/webmcp/manifest`
- `POST /api/webmcp/installation`
- `POST /api/webmcp/runtime/import`
- `integrations/wordpress/agentready-webmcp/`
- `integrations/webmcp/agentready-webmcp.js`

## Deliberately not claimed

- An authorised export is not a live Merchant Center API connection.
- A Shopify Admin observation is not proof that an agent completed checkout.
- A product-data preview is never uploaded automatically.
- A generated WebMCP plan is not an installed plugin.
- Imported browser-runtime evidence is not Live until it came from the authorised development merchant and is reviewed.
- Routine monitoring never completes a real payment, order, booking or quote submission.
- “Agent Ready” still needs proper brand/trademark clearance because PayPal uses the same phrase.

Production completion remains governed by `docs/MUST_COMPLETE_BEFORE_LIVE.md`.
