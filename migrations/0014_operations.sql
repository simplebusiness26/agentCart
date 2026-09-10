-- Operational events. Deliberately structured and low-cardinality: this is diagnosis, not
-- analytics, and it must never accumulate customer or credential data.
CREATE TABLE IF NOT EXISTS ops_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_domain TEXT,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ops_recent ON ops_events(created_ms DESC);
CREATE INDEX IF NOT EXISTS idx_ops_shop ON ops_events(shop_domain, created_ms DESC);

-- Undo records for merchant writes. before_json is what the field held before AgentCart
-- touched it, so a change can be put back exactly.
ALTER TABLE fixes ADD COLUMN undo_json TEXT;
ALTER TABLE fixes ADD COLUMN undone_ms INTEGER;
