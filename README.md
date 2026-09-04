# AgentCart

**AI commerce attribution and readiness for Shopify merchants.**

AgentCart answers three questions:

1. Are AI assistants sending customers to my store?
2. Are those customers buying?
3. What should I improve to win more AI-assisted sales?

This repository contains the Cloudflare Worker application, D1 database schema, public AI-readiness scanner, merchant dashboard, Shopify OAuth integration, Web Pixel extension, privacy/compliance endpoints, tests, and deployment documentation.

## Current build

AgentCart is designed to run on free tiers during validation. It uses deterministic scanning and first-party Shopify customer events; no paid LLM is required for the core product.

See `docs/SETUP.md` for deployment and `docs/USER_ACTIONS.md` for the short list of account-level steps that still require the owner.
