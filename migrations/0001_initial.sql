CREATE TABLE IF NOT EXISTS shops (
  shop_domain TEXT PRIMARY KEY,
  encrypted_access_token TEXT NOT NULL,
  pixel_id TEXT,
  installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  shop_domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  source_agent TEXT NOT NULL DEFAULT 'Unknown',
  source_host TEXT,
  landing_url TEXT,
  product_id TEXT,
  product_title TEXT,
  order_id TEXT,
  amount REAL,
  currency TEXT,
  session_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON events(shop_domain, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_shop_source ON events(shop_domain, source_agent);
CREATE INDEX IF NOT EXISTS idx_events_order ON events(order_id);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  score INTEGER NOT NULL,
  findings_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scans_domain_date ON scans(domain, created_at);
