-- Per-shop ingest token. Note this is delivered to a browser-side pixel, so it is not a
-- secret: it raises the cost of forging events from "know a myshopify domain" to "visit
-- the storefront once". See docs/ARCHITECTURE.md for what each layer does and does not give.
ALTER TABLE shops ADD COLUMN ingest_token TEXT;

-- Authoritative, HMAC-verified order records. Dormant until read_orders is granted:
-- until then this stays empty and the dashboard falls back to pixel-reported revenue.
-- Deliberately holds no customer identity -- no name, email, phone or address.
CREATE TABLE IF NOT EXISTS orders (
  shop_domain TEXT NOT NULL,
  order_id TEXT NOT NULL,
  normalized_id TEXT NOT NULL,
  total REAL,
  currency TEXT,
  processed_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (shop_domain, order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_shop_ms ON orders(shop_domain, processed_ms);
CREATE INDEX IF NOT EXISTS idx_orders_normalized ON orders(shop_domain, normalized_id);

-- events.event_id was globally UNIQUE rather than unique per shop. Combined with
-- INSERT OR IGNORE, one store could pre-insert an id and permanently suppress that
-- event for another store. SQLite cannot drop a column constraint in place, so the
-- table is rebuilt. No production data exists yet, so this is the moment to do it.
CREATE TABLE events_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  occurred_ms INTEGER,
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
INSERT INTO events_new (id,event_id,shop_domain,event_type,occurred_at,occurred_ms,source_agent,source_host,landing_url,product_id,product_title,order_id,amount,currency,session_id,payload_json,created_at)
  SELECT id,event_id,shop_domain,event_type,occurred_at,occurred_ms,source_agent,source_host,landing_url,product_id,product_title,order_id,amount,currency,session_id,payload_json,created_at FROM events;
DROP TABLE events;
ALTER TABLE events_new RENAME TO events;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_shop_event ON events(shop_domain, event_id);
CREATE INDEX IF NOT EXISTS idx_events_shop_date ON events(shop_domain, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_shop_source ON events(shop_domain, source_agent);
CREATE INDEX IF NOT EXISTS idx_events_order ON events(order_id);
CREATE INDEX IF NOT EXISTS idx_events_shop_ms ON events(shop_domain, occurred_ms);
