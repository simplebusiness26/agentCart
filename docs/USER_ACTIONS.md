# What the owner still needs to do

Everything below requires access to an external account, a credential, an approval, or a legal/business decision. The code for these integrations is already in the repository.

**Read this first.** The automated test suite is green and CI passes. Neither of those makes
AgentCart launch ready, and the code refuses to say otherwise. The suite runs against a `node:sqlite`
shim that exercises SQLite semantics rather than workerd, so it cannot establish that the Worker
reaches D1, that Shopify accepts a webhook, or that the pixel fires on a real storefront. The
authoritative answer lives on the dashboard's **Launch** tab: eighteen checks, each of which can only
pass against real infrastructure. Every one of them is currently `not_run`, because none of them can
be run without the accounts below.

Work items 1–7 in order; the launch gate cannot run until they are done.

## Required before AgentCart can track a real Shopify store

1. **Create the Cloudflare D1 database** named `agentcart`.
   - Copy its database ID into `wrangler.toml`.
   - Run `npm run db:migrate:remote`.

2. **Deploy the Cloudflare Worker**.
   - Copy the final HTTPS Worker URL into `APP_URL` in `wrangler.toml`.
   - Deploy again after changing the URL.

3. **Create/configure the Shopify app**.
   - Use `shopify.app.toml.example` as the configuration template.
   - Put the real Shopify client ID into the copied `shopify.app.toml`.
   - Ensure the redirect URL points to `/api/shopify/callback` on the live Worker.

4. **Add Shopify credentials to Cloudflare Secrets**.
   - `SHOPIFY_API_KEY`
   - `SHOPIFY_API_SECRET`
   - `TOKEN_ENCRYPTION_KEY`

5. **Deploy the Shopify app + Web Pixel extension**.
   - Run `npx shopify app deploy` while authenticated to the Shopify developer account.
   - The app requests `read_products`, `write_products`, `write_pixels` and
     `read_customer_events`. `write_products` is what the two product fixes need; it is
     requested at install rather than added later, because a fix that needs a scope the
     connection does not hold fails at apply time and the only remedy offered — reconnect —
     asks for the same scopes again.
   - Any store connected before this change must reconnect once. Until it does, the two
     product fixes appear under "Needs a reconnection" instead of being offered.

6. **Configure the monitoring schedule**.
   - `wrangler.toml` sets a daily cron. Cloudflare cron triggers activate on deploy;
     confirm the trigger appears in the Cloudflare dashboard after `npm run deploy`.

7. **Install AgentCart on a Shopify development store** and complete a test journey.
   - Page view
   - Product view
   - Checkout started
   - Test order completed
   - Confirm results appear at `/dashboard`.

## Run the launch gate

8. **Run the launch gate and work it to green.**
   - Open `/dashboard`, go to the **Launch** tab, and press *Run the launch gate*.
   - Each check records evidence and a timestamp. `readyForLaunch` becomes true only when all
     eighteen have a recorded pass against production.
   - Anything still failing names the real dependency it needs in its `whyNotMockable` field. Do not
     work around a check; a check that can be satisfied by a mock is not doing its job.

9. **Confirm the things the test suite deliberately cannot settle.** These are listed with the exact
   queries in `docs/SETUP.md` §10, and each is a genuine unknown rather than a suspected bug:
   - D1 `RETURNING` and `batch` atomicity under workerd.
   - The pixel's real `Origin` value (recorded but not enforced, precisely because of this).
   - Whether pixel timestamps parse as expected.
   - Whether `checkout.order.id` joins to the webhook order id.
   - Whether Shopify publishes `/.well-known/ucp` for your store — AgentCart reports this as
     `unknown` and makes no claim either way.

## Required before a public launch

10. Replace the placeholder privacy/support contact text with the real business contact details.

   **Customer data requests.** Shopify requires these to be fulfilled within 30 days.
   AgentCart records each one in the `compliance_requests` table rather than emailing
   automatically, so no transactional email provider is required. To fulfil one:

   ```sql
   SELECT * FROM compliance_requests WHERE topic='customers/data_request' AND resolved_at IS NULL;
   SELECT * FROM events WHERE shop_domain=? AND order_id IN (...);
   ```

   Send the merchant the matching rows, then set `resolved_at`. AgentCart stores no
   customer name, email, phone, address or payment data, so the returned set is limited
   to attribution and funnel records.

11. Decide the public pricing. The code currently has no billing gate because charging users before attribution is proven would slow validation.

12. Create the public Shopify App Store listing assets:
   - icon
   - screenshots
   - listing copy
   - support URL/email
   - pricing information

13. Submit the app for Shopify review if public App Store distribution is desired.

14. Review the Privacy Policy and Terms for the actual business/jurisdictions before accepting paying customers. The included versions are product-ready drafts, not a substitute for legal review.

## Optional: enable verified revenue

AgentCart currently reports revenue from the storefront pixel and labels it **Reported**
in the dashboard, because a browser-side pixel can be forged by anyone who visits the
store. The code to replace this with cryptographically verified order records is already
written and tested; it is dormant because enabling it needs an approval you must request:

1. In the Shopify Partner Dashboard, request access to **Protected Customer Data** and
   complete the data-protection questionnaire for this app.
2. Once approved, add `read_orders` to the scopes in `shopify.app.toml`.
3. Uncomment the `orders/paid` webhook subscription in the same file.
4. Redeploy and reinstall on the development store to grant the new scope.

The dashboard then switches its own label from Reported to Verified. Note this also
changes what the app requests, so the privacy copy stating that AgentCart requests no
customer email, phone or address should be re-checked at that point -- the handler
deliberately stores none of those fields, and a test asserts it.

## Ongoing: keep the provider registry honest

The provider registry records what each AI provider's crawlers are named, what they are for, and
whether the provider documents them as able to fetch regardless of `robots.txt`. Every entry carries
the date it was verified against a primary source, and the dashboard shows that date to the merchant.

These claims go stale. Providers rename crawlers, launch shopping agents in new countries, and change
their documented robots behaviour. Re-check `docs/PROVIDER_RESEARCH.md` against the linked primary
sources periodically and bump `REGISTRY_VERIFIED_ON` in `src/providers/registry.ts` when you do.

A stale registry is worse than no registry, because it reports a confident answer that is wrong.

## Optional: answer-engine visibility

The share-of-voice framework is built, but **no provider is wired to it**. Every adapter reports
itself unsupported, and the report says so. Making it live requires a decision you have to make:

1. Choose a data source for AI answer visibility. Every credible option is a paid API.
2. Implement one adapter against the existing interface in `src/aeo/`.
3. The vanity-query detection and the caveat text already work and should stay.

Until then, this is deliberately empty rather than populated with an unsourced number.

## Optional later

- Custom domain for AgentCart
- Transactional email provider
- Error/uptime monitoring destination
- Paid plan/billing provider
- WooCommerce integration
- Automated product-level recommendations
- AI/referral benchmarks by vertical
- Historical cohort and assisted-conversion modelling

## Important

Do **not** paste any API secret, encryption key, password, or private token into GitHub issues, source files, or chat screenshots. Put secrets into Cloudflare's secret store using Wrangler or the Cloudflare dashboard.
