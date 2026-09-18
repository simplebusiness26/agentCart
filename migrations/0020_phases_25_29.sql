-- Phases 25-29: visibility analytics v2, query fanouts, sources/citations,
-- crawl/perception, shopping, referrals and executable analytics actions.

CREATE TABLE IF NOT EXISTS visibility_prompt_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  query_id TEXT,
  prompt TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  country TEXT,
  locale TEXT,
  surface TEXT,
  account_state TEXT,
  method TEXT NOT NULL,
  response_hash TEXT,
  response_excerpt TEXT,
  subject TEXT NOT NULL,
  mentioned INTEGER NOT NULL DEFAULT 0,
  cited INTEGER NOT NULL DEFAULT 0,
  recommended INTEGER NOT NULL DEFAULT 0,
  selected INTEGER NOT NULL DEFAULT 0,
  task_completed INTEGER NOT NULL DEFAULT 0,
  attributed INTEGER NOT NULL DEFAULT 0,
  position INTEGER,
  sentiment TEXT,
  sentiment_score REAL,
  sentiment_evidence TEXT,
  entities_json TEXT NOT NULL DEFAULT '[]',
  observed_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visibility_prompt_runs_shop
  ON visibility_prompt_runs(shop_domain, observed_ms DESC);

CREATE TABLE IF NOT EXISTS visibility_fanouts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  query_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  query TEXT NOT NULL,
  topic TEXT,
  locale TEXT,
  country TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  evidence_ref TEXT,
  observed_ms INTEGER NOT NULL,
  UNIQUE(run_id, source, type, query),
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visibility_fanouts_run ON visibility_fanouts(run_id);

CREATE TABLE IF NOT EXISTS visibility_sources (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  source_type TEXT NOT NULL,
  ownership TEXT NOT NULL,
  accessed INTEGER NOT NULL DEFAULT 0,
  observed_ms INTEGER NOT NULL,
  UNIQUE(run_id, url),
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS visibility_citations (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  source_id TEXT,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  evidence_span TEXT,
  position INTEGER,
  observed_ms INTEGER NOT NULL,
  UNIQUE(run_id, url),
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS visibility_chat_features (
  run_id TEXT PRIMARY KEY,
  web_search INTEGER,
  shopping INTEGER,
  product_comparison INTEGER,
  maps_local INTEGER,
  ads INTEGER,
  citations INTEGER,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crawler_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  source_adapter TEXT NOT NULL,
  bot TEXT NOT NULL,
  provider TEXT,
  purpose TEXT,
  path TEXT NOT NULL,
  status INTEGER,
  latency_ms INTEGER,
  bytes INTEGER,
  error_code TEXT,
  evidence_tier TEXT NOT NULL,
  observed_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crawler_observations_shop
  ON crawler_observations(shop_domain, observed_ms DESC);

CREATE TABLE IF NOT EXISTS perception_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  run_id TEXT,
  subject TEXT NOT NULL,
  theme TEXT NOT NULL,
  polarity TEXT NOT NULL,
  evidence_span TEXT NOT NULL,
  evaluated INTEGER NOT NULL DEFAULT 1,
  conflicts_fact_key TEXT,
  observed_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  run_id TEXT,
  item_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  position INTEGER,
  quoted_price REAL,
  quoted_currency TEXT,
  canonical_price REAL,
  price_match INTEGER,
  competitors_json TEXT NOT NULL DEFAULT '[]',
  attributes_json TEXT NOT NULL DEFAULT '[]',
  source_urls_json TEXT NOT NULL DEFAULT '[]',
  evidence_tier TEXT NOT NULL,
  observed_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopping_observations_shop
  ON shopping_observations(shop_domain, observed_ms DESC);

CREATE TABLE IF NOT EXISTS analytics_actions (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  route TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  expected_metric TEXT,
  confidence REAL NOT NULL,
  owner TEXT NOT NULL,
  preview_json TEXT,
  verification_json TEXT NOT NULL DEFAULT '[]',
  rollback_available INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed',
  baseline_json TEXT,
  result_json TEXT,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  UNIQUE(shop_domain, source_type, source_id, route)
);
CREATE INDEX IF NOT EXISTS idx_analytics_actions_shop
  ON analytics_actions(shop_domain, status, updated_ms DESC);

