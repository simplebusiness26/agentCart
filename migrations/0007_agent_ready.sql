-- Agent Ready assessment storage. Non-destructive: the legacy `scans` table is left in
-- place and still written by the old single-page scanner path.

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  canonical_url TEXT,
  platform TEXT,
  platform_confidence REAL,
  connected_shop_domain TEXT,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_businesses_shop ON businesses(connected_shop_domain);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  score INTEGER,
  grade TEXT,
  scoring_version TEXT NOT NULL,
  platform TEXT,
  -- Distinguishes a user-requested scan from a scheduled monitoring run.
  trigger TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'running',
  error TEXT,
  category_scores_json TEXT,
  capabilities_json TEXT,
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_scan_runs_business ON scan_runs(business_id, started_ms DESC);
CREATE INDEX IF NOT EXISTS idx_scan_runs_domain ON scan_runs(domain, started_ms DESC);

CREATE TABLE IF NOT EXISTS scan_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_run_id TEXT NOT NULL,
  url TEXT NOT NULL,
  page_type TEXT NOT NULL,
  http_status INTEGER,
  title TEXT,
  evidence_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_scan_pages_run ON scan_pages(scan_run_id);

CREATE TABLE IF NOT EXISTS scan_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_run_id TEXT NOT NULL,
  key TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  max_points INTEGER NOT NULL DEFAULT 0,
  plain_title TEXT NOT NULL,
  why_it_matters TEXT,
  technical_detail TEXT,
  evidence_json TEXT,
  recommended_fix TEXT,
  fix_type TEXT,
  estimated_score_gain INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_scan_findings_run ON scan_findings(scan_run_id);
