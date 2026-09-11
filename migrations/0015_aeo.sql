-- AI Visibility / AEO (Phase 12.5-12.6). Measures whether assistants actually mention or
-- recommend a business.
--
-- Every metric here is MEASURED or absent. There is no inferred or estimated visibility: a
-- provider that cannot be queried programmatically is recorded as unsupported, never faked.
CREATE TABLE IF NOT EXISTS aeo_queries (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  intent TEXT NOT NULL,
  query TEXT NOT NULL,
  category TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aeo_queries_shop ON aeo_queries(shop_domain, active);

CREATE TABLE IF NOT EXISTS aeo_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  unsupported_reason TEXT,
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_aeo_runs_shop ON aeo_runs(shop_domain, started_ms DESC);

CREATE TABLE IF NOT EXISTS aeo_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  query_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  is_competitor INTEGER NOT NULL DEFAULT 0,
  mentioned INTEGER NOT NULL DEFAULT 0,
  cited INTEGER NOT NULL DEFAULT 0,
  recommended INTEGER NOT NULL DEFAULT 0,
  position INTEGER,
  evidence TEXT,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aeo_results_run ON aeo_results(run_id);

CREATE TABLE IF NOT EXISTS aeo_competitors (
  shop_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  PRIMARY KEY (shop_domain, name)
);
