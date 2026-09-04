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

6. **Install AgentCart on a Shopify development store** and complete a test journey.
   - Page view
   - Product view
   - Checkout started
   - Test order completed
   - Confirm results appear at `/dashboard`.

## Required before a public launch

7. Replace the placeholder privacy/support contact text with the real business contact details.

8. Decide the public pricing. The code currently has no billing gate because charging users before attribution is proven would slow validation.

9. Create the public Shopify App Store listing assets:
   - icon
   - screenshots
   - listing copy
   - support URL/email
   - pricing information

10. Submit the app for Shopify review if public App Store distribution is desired.

11. Review the Privacy Policy and Terms for the actual business/jurisdictions before accepting paying customers. The included versions are product-ready drafts, not a substitute for legal review.

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
