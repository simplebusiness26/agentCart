# Provider research and provenance

Phase 10 requires re-checking official Meta, Shopify and Stripe documentation before coding
provider-specific assumptions, and forbids claiming readiness without evidence. This file records
what was verified, when, and from where, so a future change can tell fact from assumption.

**Verified: 2026-09-10.** These capabilities are new and move quickly. Re-check before relying on
any row below; the provider registry in `src/providers/registry.ts` is the single place to update.

## Meta crawlers and fetchers

Source: <https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers> (official).

| User agent | Purpose | Respects robots.txt |
| --- | --- | --- |
| `facebookexternalhit` | Link previews for content shared on Meta apps | Mostly; may bypass for security/integrity checks |
| `meta-externalagent` | Training foundation models, and indexing content | **May bypass** |
| `meta-webindexer` | Meta AI search result quality | Yes |
| `meta-externalads` | Advertising and business products | Yes |
| `meta-externalfetcher` | Fetches individual links **at a user's request**; supports agentic AI capabilities | **May bypass** |

Two consequences AgentCart must honour:

1. **Training is a separate concern from discovery.** Blocking `meta-externalagent` is a legitimate
   merchant choice about AI training and must never reduce the Agent Ready score on its own.
2. **A robots block is not proof an agent cannot reach the site.** `meta-externalfetcher` is
   documented as possibly bypassing robots.txt because the fetch is user-initiated. So a `Disallow`
   for it is reported as *the merchant's stated preference*, not as "Muse is blocked". Claiming
   otherwise would be exactly the unevidenced assertion the phase plan forbids.

## Meta Muse

Sources: Meta's launch coverage, September 2026 (TechCrunch, PPC Land, TechBriefly).

- A personal AI agent that shops, books and completes tasks; opens a browser, fills forms, places
  orders.
- **United States only** at time of writing, on iOS, Android and the web.
- Asks the user for approval before higher-risk actions such as completing a purchase.

Consequence: region matters. A UK or EU merchant is **not** failing because Muse is unavailable in
their market. AgentCart reports that as `not_available_in_region`, never as a merchant failure.

## Universal Commerce Protocol (UCP)

Sources: <https://ucp.dev/documentation/core-concepts/>, <https://shopify.engineering/ucp>,
<https://github.com/universal-commerce-protocol/ucp>.

Discovery is a JSON manifest at `/.well-known/ucp`:

```json
{
  "ucp": {
    "version": "draft",
    "services":         { "dev.ucp.shopping": { "version": "...", "transport": "rest|mcp|a2a|embedded", "endpoint": "...", "schema": "...", "spec": "..." } },
    "capabilities":     { "dev.ucp.shopping.checkout": [ { "version": "...", "schema": "...", "spec": "...", "extends": "..." } ] },
    "payment_handlers": { "<reverse.domain.key>": { "id": "...", "version": "...", "schema": "...", "spec": "..." } }
  },
  "keys": [ /* JWK Set, RFC 7517: kid, kty, alg, curve params */ ]
}
```

- `ucp.version` and `ucp.capabilities` are required; `services` is required if capabilities are
  exposed; `payment_handlers` is required only when accepting payments; `keys` is required for
  signed interactions.
- Services and capabilities use reverse-domain keys, so parsing must not assume a fixed list.

**Not verified:** whether Shopify publishes `/.well-known/ucp` automatically for merchant
storefronts. Shopify's engineering post describes UCP and a Checkout Kit but does not state this.
AgentCart therefore reports Shopify-native UCP publication as `unknown` and does not tell a merchant
to create a file Shopify may already provide — nor claims Shopify provides one.

## Agentic Commerce Protocol (ACP)

Sources: <https://docs.stripe.com/agentic-commerce/acp>,
<https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>,
<https://stripe.com/blog/developing-an-open-standard-for-agentic-commerce>.

- Open standard (Apache 2.0) maintained by OpenAI and Stripe; released 2025-09-29; **beta**.
- Covers cart construction, capability negotiation, delegated payment and order lifecycle.
- Uses a Shared Payment Token so an agent can initiate payment **without seeing card details**. The
  merchant remains merchant of record.

Consequence: AgentCart never handles card data, wallet credentials or payment secrets under either
protocol. It assesses whether a merchant's checkout is reachable and agent-compatible; it does not
transact.

## Rules derived from the above

- Distinguish `pass`, `fail`, `unsupported`, `unknown` and `not_available_in_region`. They are
  different answers and are never collapsed.
- Provider facts live in `src/providers/registry.ts` with a `verifiedOn` date, so staleness is
  visible rather than silent.
- Record the exact evidence (matched robots line, fetched manifest field) behind every conclusion.
