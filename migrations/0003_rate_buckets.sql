-- Fixed-window counters for public endpoint abuse protection. One row per
-- (kind, key, window); swept opportunistically on write.
CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_expiry ON rate_buckets(expires_at);
