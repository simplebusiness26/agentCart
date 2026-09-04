# AgentCart architecture

## Product promise

AgentCart measures identifiable AI-referred commerce and shows merchants how machine-readable their storefront is.

## Runtime

```text
Shopify storefront
      |
      | customer events (consent-aware Web Pixel)
      v
AgentCart Worker /api/events
      |
      v
Cloudflare D1
      |
      +--> /api/dashboard --> merchant dashboard

Public store URL
      |
      v
Readiness scanner
      |
      +--> HTML / JSON-LD / metadata / robots / llms.txt / sitemap
      |
      +--> readiness score + fixes
```

## Main modules

- `src/index.ts` — HTTP routing, APIs, OAuth callback, event ingestion, webhooks.
- `src/shopify.ts` — Shopify OAuth/HMAC, token encryption, Web Pixel activation, signed sessions.
- `src/db.ts` — D1 persistence and dashboard aggregation.
- `src/scanner.ts` — deterministic AI-commerce readiness analysis.
- `src/ui.ts` — responsive server-rendered landing page, scanner results, dashboard, legal/setup pages.
- `extensions/agentcart-pixel` — Shopify Web Pixel extension.
- `migrations/0001_initial.sql` — D1 schema.

## Attribution model

AgentCart uses the referral source observed by Shopify's Web Pixel and carries the initial referrer through the browser session using Shopify's session-storage API. The Worker classifies known AI referral hosts and stores the source alongside funnel events.

Current named sources:

- ChatGPT
- Claude
- Perplexity
- Gemini
- Microsoft Copilot
- Meta AI

Unknown sources are not guessed. They are stored as `Other referral` or `Direct / unknown`.

## Important attribution limitations

No web analytics product can perfectly reconstruct every AI-assisted purchase. Some AI surfaces suppress referrer information, users can switch devices, and a recommendation can influence a later direct visit. Therefore AgentCart should distinguish:

1. **Identifiable AI referral** — direct technical evidence of the source.
2. **Assisted / modelled attribution** — a future feature requiring explicit methodology.
3. **Unknown/direct** — not falsely attributed.

The MVP dashboard deliberately reports the first category.

## Security

- Shopify OAuth state is short-lived and one-time-use.
- OAuth callbacks use Shopify HMAC verification.
- Shopify access tokens are AES-GCM encrypted before D1 storage.
- Merchant sessions are HMAC signed and HttpOnly/Secure/SameSite=Lax.
- Shopify webhook HMAC is verified before processing.
- Pixel ingestion accepts only installed store domains and deduplicates event IDs.
- No card details are collected.
- The current app does not request customer email, phone, or address fields.

## Privacy

The Web Pixel is configured for analytics consent. Shopify controls when the pixel executes based on applicable customer privacy signals. AgentCart stores only the fields required for source/funnel/revenue measurement in the current product.

## Cost model

The scanner is rules-based and has no required LLM call. Early cost centers are therefore primarily Cloudflare usage and any later billing/email/monitoring services. This keeps the validation phase compatible with free-tier infrastructure.

## Planned product evolution

1. Product-level AI-readiness audits.
2. Trend charts and period comparisons.
3. Assisted-conversion methodology with clearly labelled confidence.
4. Merchant benchmark datasets.
5. Automated recommended fixes.
6. WooCommerce connector.
7. Optional billing only after users demonstrate willingness to pay.
