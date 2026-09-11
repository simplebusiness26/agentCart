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
7. **Reports which AI assistants can actually reach the business.** A provider registry checked
   against the site's `robots.txt`, per provider: can it discover you, can it fetch your pages, is
   its shopping agent even available in your region. Blocking an AI *training* crawler is treated as
   a legitimate choice and never reduces the score. Where a provider documents that its agent may
   fetch a page regardless of `robots.txt`, a Disallow is reported as a stated preference, not as
   proof the agent is blocked.
8. **Separates revenue by strength of evidence.** Verified, identifiable referral, reported,
   assisted and unknown are counted separately and never added together.
9. **Answers "is this ready to launch?" once.** A checklist plus a gate that only passes against
   real infrastructure. A green test suite never makes AgentCart launch ready, and the code says so.
10. **Is itself callable by an agent.** A public read-only MCP surface at `/api/mcp` and an
   `/agents.md`, so an assistant can scan a site and read the standards without a merchant account.

## Repository

Cloudflare Worker application, D1 schema and migrations, the Agent Ready scanner and scoring model,
the Shopify connector and fix engine, the hosted AI layer and MCP adapter, the provider registry and
agentic-commerce attribution, the protocol compatibility layer, the launch gate, the Web Pixel
extension, privacy and compliance endpoints, tests, and deployment documentation.

Provider claims are sourced, dated and re-checkable: see [`docs/PROVIDER_RESEARCH.md`](docs/PROVIDER_RESEARCH.md).

## What it deliberately does not do

It does not take payment, hold an order, or act as merchant of record under any agentic-commerce
protocol. It publishes discovery and read access only, and the manifest omits the capabilities it
cannot honestly claim. It does not buy anything on a customer's behalf. Answer-engine visibility is
a framework with no live provider behind it — every adapter reports itself unsupported rather than
returning a number nobody can verify.

## Status

The application code is complete and tested (`npm run typecheck && npm test`; 673 tests). It is
**not yet deployed and not launch ready**: it needs a Cloudflare D1 database, a Shopify app and
credentials, and a real development store to verify against.

Those are not the same statement. The test suite runs against a SQLite shim, not workerd, so a green
suite establishes that the logic is correct — never that the system works. The launch gate on the
dashboard's Launch tab is the authoritative answer, and it can only be satisfied by checks that ran
against real infrastructure.

The remaining steps are account-level and are listed in
[`docs/USER_ACTIONS.md`](docs/USER_ACTIONS.md); deployment is in [`docs/SETUP.md`](docs/SETUP.md) and
the design in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

AgentCart runs on free tiers during validation. The scanner is deterministic and needs no paid LLM.
