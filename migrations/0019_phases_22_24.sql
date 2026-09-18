-- Scanner Superset + Path to 100 and Phases 22-24 growth/content learning loop.

CREATE TABLE IF NOT EXISTS benchmark_capabilities (
  benchmark TEXT NOT NULL,
  capability_key TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  observed_ms INTEGER NOT NULL,
  agentready_equivalent TEXT,
  state TEXT NOT NULL,
  rationale TEXT NOT NULL,
  phase INTEGER,
  PRIMARY KEY(benchmark, capability_key)
);

CREATE TABLE IF NOT EXISTS remediation_paths (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  scan_run_id TEXT,
  finding_key TEXT NOT NULL,
  current_state TEXT NOT NULL,
  target_state TEXT NOT NULL DEFAULT 'pass',
  score_recoverable REAL NOT NULL DEFAULT 0,
  owner TEXT NOT NULL,
  mode TEXT NOT NULL,
  can_apply INTEGER NOT NULL DEFAULT 0,
  can_verify INTEGER NOT NULL DEFAULT 0,
  preview_available INTEGER NOT NULL DEFAULT 0,
  undo_available INTEGER NOT NULL DEFAULT 0,
  requirements_json TEXT NOT NULL DEFAULT '[]',
  steps_json TEXT NOT NULL DEFAULT '[]',
  verification_json TEXT NOT NULL DEFAULT '[]',
  official_docs_json TEXT NOT NULL DEFAULT '[]',
  created_ms INTEGER NOT NULL,
  UNIQUE(shop_domain, scan_run_id, finding_key)
);

CREATE TABLE IF NOT EXISTS growth_opportunities (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  source TEXT NOT NULL,
  query TEXT NOT NULL,
  intent TEXT NOT NULL,
  funnel_stage TEXT NOT NULL,
  target_entity TEXT,
  target_page TEXT,
  current_coverage TEXT NOT NULL,
  business_relevance REAL NOT NULL,
  buyer_intent REAL NOT NULL,
  evidence_strength REAL NOT NULL,
  opportunity_confidence REAL NOT NULL,
  estimated_difficulty REAL,
  measured_demand REAL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  UNIQUE(shop_domain, source, query)
);
CREATE INDEX IF NOT EXISTS idx_growth_opportunities_shop
  ON growth_opportunities(shop_domain, status, updated_ms DESC);

CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  page_decision TEXT NOT NULL,
  brief_json TEXT NOT NULL,
  fact_map_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  FOREIGN KEY(opportunity_id) REFERENCES growth_opportunities(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  target_url TEXT,
  cms TEXT NOT NULL,
  state TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_json TEXT NOT NULL,
  approval_ms INTEGER,
  published_ms INTEGER,
  verified_ms INTEGER,
  previous_version_id TEXT,
  created_ms INTEGER NOT NULL,
  FOREIGN KEY(brief_id) REFERENCES content_briefs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS growth_measurements (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  page_url TEXT NOT NULL,
  content_version_id TEXT,
  source TEXT NOT NULL,
  query TEXT,
  impressions REAL,
  clicks REAL,
  ctr REAL,
  position REAL,
  ai_mentions REAL,
  ai_citations REAL,
  leads REAL,
  orders REAL,
  revenue REAL,
  evidence_tier TEXT NOT NULL,
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  observed_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_growth_measurements_shop
  ON growth_measurements(shop_domain, observed_ms DESC);

