-- Idempotency for anything an agent may retry. An agent that loses a response will retry, and a
-- retry must never produce a second cart, a second order or a second applied fix.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  scope TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT,
  status TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  expires_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idem_expiry ON idempotency_keys(expires_ms);

-- Shopify agentic-commerce channel capabilities, detected rather than assumed. Every row records
-- the evidence and how it was determined so nothing is claimed without support.
CREATE TABLE IF NOT EXISTS channel_capabilities (
  shop_domain TEXT NOT NULL,
  capability TEXT NOT NULL,
  state TEXT NOT NULL,
  fix_class TEXT,
  detail TEXT,
  evidence TEXT,
  checked_ms INTEGER NOT NULL,
  PRIMARY KEY (shop_domain, capability)
);
