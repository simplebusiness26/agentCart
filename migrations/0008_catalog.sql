-- Normalized catalogue cached from a connected platform, so the public AI layer can be
-- served without calling the platform on every read. Holds only merchant/product data --
-- never customer data, and never the access token.
CREATE TABLE IF NOT EXISTS catalog_items (
  shop_domain TEXT NOT NULL,
  item_id TEXT NOT NULL,
  handle TEXT,
  title TEXT,
  description TEXT,
  product_type TEXT,
  vendor TEXT,
  url TEXT,
  image_url TEXT,
  image_alt TEXT,
  price_min REAL,
  price_max REAL,
  currency TEXT,
  available INTEGER,
  variants_json TEXT,
  seo_title TEXT,
  seo_description TEXT,
  identifiers_json TEXT,
  status TEXT,
  synced_ms INTEGER NOT NULL,
  PRIMARY KEY (shop_domain, item_id)
);
CREATE INDEX IF NOT EXISTS idx_catalog_shop ON catalog_items(shop_domain, synced_ms);
CREATE INDEX IF NOT EXISTS idx_catalog_handle ON catalog_items(shop_domain, handle);

CREATE TABLE IF NOT EXISTS business_profiles (
  shop_domain TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address_json TEXT,
  currency TEXT,
  primary_url TEXT,
  policies_json TEXT,
  synced_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  items INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_shop ON sync_runs(shop_domain, started_ms DESC);
