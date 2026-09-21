-- Phases 33-35 and the Phase 30-32 review corrections.
-- All new evidence remains merchant-scoped and provider/live status is never inferred.

CREATE TABLE IF NOT EXISTS merchant_industry_benchmarks (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  subjects_json TEXT NOT NULL,
  cooccurrence_json TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  UNIQUE(shop_domain, category, provider, model, country, window_start_ms, window_end_ms)
);
CREATE INDEX IF NOT EXISTS idx_merchant_industry_benchmarks_shop
  ON merchant_industry_benchmarks(shop_domain, created_ms DESC);

CREATE TABLE IF NOT EXISTS merchant_ai_performance_imports (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  merchant_account_id TEXT NOT NULL,
  category TEXT NOT NULL,
  country TEXT NOT NULL,
  language TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  evidence_tier TEXT NOT NULL,
  organic_only INTEGER NOT NULL DEFAULT 1,
  metrics_json TEXT NOT NULL,
  imported_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_merchant_ai_performance_shop
  ON merchant_ai_performance_imports(shop_domain, imported_ms DESC);

CREATE TABLE IF NOT EXISTS shopify_agentic_channel_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  channel TEXT NOT NULL,
  discovery_enabled INTEGER NOT NULL,
  direct_checkout_enabled INTEGER NOT NULL,
  attribution_source TEXT NOT NULL,
  unsupported_json TEXT NOT NULL DEFAULT '[]',
  evidence_tier TEXT NOT NULL,
  observed_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopify_agentic_channels_shop
  ON shopify_agentic_channel_observations(shop_domain, observed_ms DESC);

CREATE TABLE IF NOT EXISTS webmcp_plans (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  brain_version TEXT NOT NULL,
  implementation_route TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  security_status TEXT NOT NULL,
  status TEXT NOT NULL,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_webmcp_plans_shop
  ON webmcp_plans(shop_domain, updated_ms DESC);

CREATE TABLE IF NOT EXISTS webmcp_installations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  adapter TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  site_origin TEXT NOT NULL,
  status TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  installed_ms INTEGER,
  disabled_ms INTEGER,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  updated_ms INTEGER NOT NULL,
  FOREIGN KEY(plan_id) REFERENCES webmcp_plans(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webmcp_installations_shop
  ON webmcp_installations(shop_domain, updated_ms DESC);

CREATE TABLE IF NOT EXISTS webmcp_runtime_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  installation_id TEXT,
  adapter_version TEXT NOT NULL,
  browser TEXT NOT NULL,
  status TEXT NOT NULL,
  registered_tools_json TEXT NOT NULL,
  checks_json TEXT NOT NULL,
  schema_fingerprint TEXT,
  latency_ms INTEGER NOT NULL,
  evidence_tier TEXT NOT NULL,
  checked_ms INTEGER NOT NULL,
  FOREIGN KEY(installation_id) REFERENCES webmcp_installations(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_webmcp_runtime_runs_shop
  ON webmcp_runtime_runs(shop_domain, checked_ms DESC);

CREATE TABLE IF NOT EXISTS webmcp_runtime_incidents (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  installation_id TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  state TEXT NOT NULL,
  first_seen_ms INTEGER NOT NULL,
  last_seen_ms INTEGER NOT NULL,
  recovered_ms INTEGER,
  occurrences INTEGER NOT NULL DEFAULT 1,
  latest_run_id TEXT NOT NULL,
  FOREIGN KEY(installation_id) REFERENCES webmcp_installations(id) ON DELETE SET NULL,
  FOREIGN KEY(latest_run_id) REFERENCES webmcp_runtime_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webmcp_runtime_incidents_shop
  ON webmcp_runtime_incidents(shop_domain, last_seen_ms DESC);
