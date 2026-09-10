# What the owner still needs to do

Everything below requires access to an external account, a credential, an approval, or a legal/business decision. The code for these integrations is already in the repository.

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
   - The app requests `read_products`, `write_pixels` and `read_customer_events` today.
     `write_products` is additionally required for the product fixes; add it to
     `shopify.app.toml` before deploying if you want those enabled.

6. **Configure the monitoring schedule**.
   - `wrangler.toml` sets a daily cron. Cloudflare cron triggers activate on deploy;
     confirm the trigger appears in the Cloudflare dashboard after `npm run deploy`.

7. **Install AgentCart on a Shopify development store** and complete a test journey.
   - Page view
   - Product view
   - Checkout started
   - Test order completed
   - Confirm results appear at `/dashboard`.

## Required before a public launch

8. Replace the placeholder privacy/support contact text with the real business contact details.

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

9. Decide the public pricing. The code currently has no billing gate because charging users before attribution is proven would slow validation.

10. Create the public Shopify App Store listing assets:
   - icon
   - screenshots
   - listing copy
   - support URL/email
   - pricing information

11. Submit the app for Shopify review if public App Store distribution is desired.

12. Review the Privacy Policy and Terms for the actual business/jurisdictions before accepting paying customers. The included versions are product-ready drafts, not a substitute for legal review.

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
