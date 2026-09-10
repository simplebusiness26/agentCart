-- Shopify mandatory compliance webhooks (customers/data_request, customers/redact,
-- shop/redact) must be handled, and the merchant must be able to show they were.
-- This is the audit trail for that.
CREATE TABLE IF NOT EXISTS compliance_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  customer_id TEXT,
  order_ids_json TEXT,
  matched_events INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_compliance_shop ON compliance_requests(shop_domain, received_at);
