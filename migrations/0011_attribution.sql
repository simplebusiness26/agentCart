-- Evidence-tiered attribution. Phase 10.7: agentic checkout may never run the merchant's
-- client-side Web Pixel, so pixel-only measurement misses exactly the AI purchases AgentCart
-- exists to prove.
--
-- The tiers are stored, never collapsed. "Verified" means an HMAC-verified server-side order
-- record; "reported" means the browser pixel said so; "unknown" means no defensible source.
-- Nothing is ever promoted to a stronger tier by inference.

ALTER TABLE orders ADD COLUMN source_tier TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE orders ADD COLUMN source_agent TEXT;
ALTER TABLE orders ADD COLUMN source_channel TEXT;
ALTER TABLE orders ADD COLUMN source_name TEXT;
ALTER TABLE orders ADD COLUMN journey_id TEXT;
ALTER TABLE orders ADD COLUMN evidence_json TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_journey ON orders(shop_domain, journey_id);
CREATE INDEX IF NOT EXISTS idx_orders_tier ON orders(shop_domain, source_tier);

-- A commerce journey begun on an AgentCart-controlled surface. The id is signed and carries no
-- secret and no customer identity -- only enough to join a handoff to a later order.
CREATE TABLE IF NOT EXISTS commerce_journeys (
  journey_id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  provider TEXT,
  agent_label TEXT,
  intent TEXT,
  target_url TEXT,
  item_id TEXT,
  created_ms INTEGER NOT NULL,
  last_seen_ms INTEGER,
  order_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_journeys_shop ON commerce_journeys(shop_domain, created_ms DESC);
