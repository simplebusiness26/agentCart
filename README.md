# AgentCart

**Make your business ready for AI customers.**

People increasingly ask an AI assistant what to buy and who to use. AgentCart checks whether those
assistants can actually understand a business, helps fix what is in the way, and shows whether AI is
sending customers.

The loop is:

**Scan → Agent Ready score → plain-English report → connect Shopify → fix what is safe → rescan →
prove the score rose → publish a hosted AI layer for the rest.**

## What it does

1. **Checks a website the way an assistant would.** A bounded multi-page crawl scores five
   categories out of 100: understanding the business, understanding the catalogue, finding policies,
   reaching the site, and taking action. Checks that do not apply to a business are skipped, not
   failed — a service business is not marked down for having no products.
2. **Explains it in plain English.** What AI can and cannot understand, what it can and cannot do,
   and which fixes recover the most score. Technical detail is available but secondary.
3. **Fixes what can safely be fixed.** A fix registry with previews, explicit approval for anything
   a customer would see, and independent verification — a mutation returning success is never
   treated as proof the change landed.
4. **Publishes a hosted AI layer.** A public, machine-readable profile, catalogue, policies and
   supported-action list, plus a read-only MCP surface, so assistants have a clean source even when
   the merchant's own site cannot be changed.
5. **Keeps checking.** A daily scheduled rescan of connected businesses, with score history.
6. **Shows AI-referred traffic.** Visits and orders from identifiable AI assistants, with honest
   limits: unidentifiable referrals are reported as unknown, never guessed.

## Repository

Cloudflare Worker application, D1 schema and migrations, the Agent Ready scanner and scoring model,
the Shopify connector and fix engine, the hosted AI layer and MCP adapter, the Web Pixel extension,
privacy and compliance endpoints, tests, and deployment documentation.

## Status

The application code is complete and tested (`npm run typecheck && npm test`). It is **not yet
deployed**: it needs a Cloudflare D1 database, a Shopify app and credentials, and a real development
store to verify against. Those steps are account-level and are listed in
[`docs/USER_ACTIONS.md`](docs/USER_ACTIONS.md); deployment is in [`docs/SETUP.md`](docs/SETUP.md) and
the design in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

AgentCart runs on free tiers during validation. The scanner is deterministic and needs no paid LLM.
