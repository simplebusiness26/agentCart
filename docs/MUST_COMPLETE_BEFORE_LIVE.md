# STOP: must be completed before AgentReady goes live

This is a release-blocking checklist. Do not describe AgentReady, AgentCart or Phases 30–35 as Live until every required item is evidenced and reviewed. A green test suite, migration or demo is not production proof.

Last code review: 2026-09-21  
Branch: `codex/phases-30-32`  
Final reviewed commit: record after CI passes

## Release decision

- [ ] Final human review immediately before launch.
- [ ] Every required item below is complete, or launch is stopped.
- [ ] Optional GA4, Algolia and Merchant Center work is explicitly **Not applicable** or completed.
- [ ] Evidence records Worker URL, Cloudflare version, Git commit, migrations, development store, timestamps and log/screenshot references.

## Code blockers from the PR review

- [x] Merchant benchmark data is isolated by `shop_domain` and a two-shop test exists.
- [x] Tool classification is fail-safe for camelCase, hyphenated, noun-style and unannotated tools.
- [x] Self-declared identity is separate from independently verified identity.
- [x] Manual referral rows use `manual_import`; only the OAuth/Data API path uses `authorised_ga4`.
- [x] Owner controls exist for GA4, UCP negotiation, Lighthouse, Algolia, security and Fix My Site planning.
- [ ] Final CI run passes and its exact commit is recorded above.

These checks prove code readiness only. They do not prove remote D1, the deployed Worker, Shopify, Google, Algolia, PayPal, WordPress or a browser runtime.

## Remote migration and deployment

- [ ] Export/back up production D1.
- [ ] Replace `REPLACE_WITH_D1_DATABASE_ID` with the intended database ID.
- [ ] Run `npm run db:migrate:remote`.
- [ ] Confirm migrations `0021_phases_30_32.sql` and `0022_phases_33_35.sql` applied.
- [ ] Confirm existing shops, events, scans and orders remain present.
- [ ] Confirm Phase 30–35 tables exist and benchmark rows contain `shop_domain`.
- [ ] Save migration output and timestamp.
- [ ] Configure `APP_URL` with the final HTTPS Worker URL.
- [ ] Confirm Shopify and encryption secrets exist in Cloudflare Secrets; never copy values into evidence.
- [ ] Deploy Worker, Shopify configuration and Web Pixel; record Cloudflare version and Git commit.
- [ ] Confirm OAuth callback is exactly `<APP_URL>/api/shopify/callback`.
- [ ] Set `BUILD_SHA` to the exact deployed Git commit, then confirm daily cron and `GET /health` reports it.

## Real Shopify development-store verification

- [ ] Use an authorised development store, not a customer's live store.
- [ ] Install/reconnect and confirm scopes.
- [ ] Sync real products, variants, images, prices and availability.
- [ ] Check every dashboard area at phone width.
- [ ] Complete page view, product view, checkout started and test-order journey.
- [ ] Confirm timestamps, observed pixel Origin and optional webhook/order join.
- [ ] Run native UCP discovery and retain version, transport and capabilities; `not_found` is an honest result.
- [ ] Run UCP negotiation only with the development-store checkbox and prove it created no cart, checkout or order.
- [ ] Inspect the OpenAI feed preview and `x-agentready-uploaded: false`; do not upload automatically.
- [ ] Import a genuine Lighthouse Agentic Browsing report.
- [ ] Run all seven AgentPulse journeys with real timestamps/evidence.
- [ ] Run security assessment for every authorised endpoint and resolve failed controls.

## Phase 33–35 live verification

- [ ] Verify AI Shelf data for two development shops and prove no cross-shop row is returned.
- [ ] If Merchant Center is used, import a genuine authorised organic export and compare its account/category/country/language/window with the source report.
- [ ] Inspect conversational-product previews; no provider write is allowed without a separate approved write flow and acceptance verification.
- [ ] Observe Shopify channel state in authorised Admin and retain discovery/direct-checkout/unsupported-feature evidence.
- [ ] For direct checkout, compare Shopify channel/server attribution; do not expect browser pixels to fire.
- [ ] Review a generated Fix My Site plan before enabling any installer.
- [ ] Install the WordPress/WooCommerce plugin only on an authorised development site and confirm it starts disabled.
- [ ] Enable it, verify compatible-browser registration and source-of-truth read results, then disable/rollback it.
- [ ] Prove ordinary monitoring does not invoke handoffs/writes or create a payment, order, booking or quote.
- [ ] If PayPal reuse is selected, evidence Store Sync access, physical goods, US customer and USD applicability; otherwise use another route.
- [ ] Deliberately break a development tool, confirm an incident, repair it and confirm recovery.

## Optional GA4

- [ ] **Not applicable**, or every remaining GA4 item is complete.
- [ ] Configure Google OAuth with the production callback and Cloudflare secrets.
- [ ] Connect the authorised account, select the property and import a known short range.
- [ ] Compare sessions/revenue with GA4 and confirm only recognised AI referrals were retained.
- [ ] Confirm GA4, signed journeys and verified Shopify orders remain separate.
- [ ] Confirm pasted/manual imports show `manual_import`.

## Optional Algolia

- [ ] **Not applicable**, or every remaining Algolia item is complete.
- [ ] Record only application ID, index names and public MCP URL; never an Admin key.
- [ ] Run one buyer-intent query with a restricted Search-only key.
- [ ] Confirm price, availability and facets from retained evidence.
- [ ] Confirm the key is absent from D1, evidence and logs.
- [ ] Mark capabilities Observed only from real checks.

## Final production confirmation

- [ ] Existing real-infrastructure launch gate reaches 18/18.
- [ ] Cloudflare logs show no uncaught errors during real-store tests.
- [ ] Install/uninstall/reinstall revokes old sessions.
- [ ] Scheduled monitoring completes.
- [ ] Privacy/support/legal drafts are reviewed for the business and launch jurisdictions.
- [ ] UK/US trademark and brand clearance decides whether “Agent Ready” remains commercially sensible.
- [ ] Reopen this file and record the final decision.

## Final sign-off

- Decision: `STOP / READY TO GO LIVE`
- Reviewed by:
- Review date/time:
- Production URL:
- Cloudflare version ID:
- Git commit:
- Migration `0021` and `0022` evidence:
- Shopify development store:
- Launch gate result:
- GA4: `Not applicable / Observed / Live`
- Algolia: `Not applicable / Observed / Live`
- Merchant Center: `Not applicable / Imported / Live connection`
- WebMCP installation/runtime evidence:
- Remaining limitations:

Until this section says `READY TO GO LIVE`, release status remains **STOP**.
