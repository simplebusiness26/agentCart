-- Phases 30-32: current commerce standards, answer-level analytics,
-- authorised referral evidence and agent-interaction security.

CREATE TABLE IF NOT EXISTS ucp_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  discovery_url TEXT NOT NULL,
  status TEXT NOT NULL,
  ucp_version TEXT,
  supported_versions_json TEXT NOT NULL DEFAULT '[]',
  services_json TEXT NOT NULL DEFAULT '{}',
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  checked_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ucp_observations_shop
  ON ucp_observations(shop_domain, checked_ms DESC);

CREATE TABLE IF NOT EXISTS commerce_feed_exports (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  format TEXT NOT NULL,
  brain_version TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  eligible_count INTEGER NOT NULL,
  stale_count INTEGER NOT NULL,
  summary_json TEXT NOT NULL,
  created_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commerce_feed_exports_shop
  ON commerce_feed_exports(shop_domain, created_ms DESC);

CREATE TABLE IF NOT EXISTS agentic_browser_audits (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  source TEXT NOT NULL,
  source_version TEXT,
  fraction REAL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  unknown INTEGER NOT NULL,
  audits_json TEXT NOT NULL,
  checked_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agentic_browser_audits_shop
  ON agentic_browser_audits(shop_domain, checked_ms DESC);

ALTER TABLE visibility_prompt_runs ADD COLUMN category TEXT;

CREATE TABLE IF NOT EXISTS visibility_evidence_spans (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  source_url TEXT,
  span_type TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  answer_length INTEGER NOT NULL,
  evidence_excerpt TEXT,
  observed_ms INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visibility_evidence_spans_run
  ON visibility_evidence_spans(run_id);

CREATE TABLE IF NOT EXISTS industry_benchmarks (
  id TEXT PRIMARY KEY,
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
  UNIQUE(category, provider, model, country, window_start_ms, window_end_ms)
);

CREATE TABLE IF NOT EXISTS brand_attribute_observations (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  run_id TEXT,
  brand TEXT NOT NULL,
  attribute TEXT NOT NULL,
  polarity TEXT NOT NULL,
  evidence_span TEXT NOT NULL,
  observed_ms INTEGER NOT NULL,
  FOREIGN KEY(run_id) REFERENCES visibility_prompt_runs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_brand_attribute_observations_shop
  ON brand_attribute_observations(shop_domain, observed_ms DESC);

CREATE TABLE IF NOT EXISTS provider_oauth_states (
  state TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  expires_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_connections (
  shop_domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  scopes_json TEXT NOT NULL DEFAULT '[]',
  property_id TEXT,
  status TEXT NOT NULL,
  connected_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  PRIMARY KEY(shop_domain, provider)
);

CREATE TABLE IF NOT EXISTS analytics_import_batches (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  provider TEXT NOT NULL,
  evidence_tier TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  imported_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_referrals (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  assistant TEXT NOT NULL,
  landing_page TEXT,
  country TEXT,
  device TEXT,
  sessions INTEGER NOT NULL DEFAULT 0,
  engaged_sessions INTEGER NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  currency TEXT,
  evidence_tier TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  FOREIGN KEY(batch_id) REFERENCES analytics_import_batches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_analytics_referrals_shop
  ON analytics_referrals(shop_domain, window_end DESC);

CREATE TABLE IF NOT EXISTS agent_security_assessments (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  target_label TEXT NOT NULL,
  applicable INTEGER NOT NULL,
  tool_count INTEGER NOT NULL,
  mutating_tool_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  checked_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_security_assessments_shop
  ON agent_security_assessments(shop_domain, checked_ms DESC);
