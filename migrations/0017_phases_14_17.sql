-- Complete AgentReady phases 14-17. All stored evidence is deliberately low-cardinality and
-- excludes credentials, raw provider responses and customer identity.

-- Phase 15: preserve the circumstances of every visibility observation and keep later funnel
-- outcomes separate. Existing rows remain honest: their collection method is unknown.
ALTER TABLE aeo_runs ADD COLUMN method TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE aeo_runs ADD COLUMN locale TEXT;
ALTER TABLE aeo_runs ADD COLUMN context_json TEXT;
ALTER TABLE aeo_results ADD COLUMN selected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aeo_results ADD COLUMN task_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aeo_results ADD COLUMN attributed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aeo_results ADD COLUMN evidence_tier TEXT NOT NULL DEFAULT 'observed';
ALTER TABLE aeo_results ADD COLUMN evidence_url TEXT;

-- Phase 16: optional Algolia connection metadata. Search-only keys are never stored here; even
-- public credentials must be supplied ephemerally to a runtime check.
CREATE TABLE IF NOT EXISTS algolia_connections (
  shop_domain TEXT PRIMARY KEY,
  application_id TEXT,
  index_names_json TEXT NOT NULL DEFAULT '[]',
  public_mcp_url TEXT,
  detected INTEGER NOT NULL DEFAULT 0,
  detection_evidence_json TEXT NOT NULL DEFAULT '{}',
  updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS algolia_audit_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  index_name TEXT NOT NULL,
  query_label TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  hit_count INTEGER,
  price_observed INTEGER NOT NULL DEFAULT 0,
  availability_observed INTEGER NOT NULL DEFAULT 0,
  facets_observed INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  checked_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_algolia_audit_shop ON algolia_audit_runs(shop_domain, checked_ms DESC);

-- A verified mutation is followed by a fresh public scan where possible. The scan is evidence,
-- not a reason to pretend a hosted-layer change altered the merchant's own page score.
CREATE TABLE IF NOT EXISTS fix_evidence (
  fix_id TEXT PRIMARY KEY,
  verification_status TEXT NOT NULL,
  verification_detail TEXT,
  scan_run_id TEXT,
  scan_status TEXT NOT NULL,
  scan_error TEXT,
  recorded_ms INTEGER NOT NULL,
  FOREIGN KEY(fix_id) REFERENCES fixes(id) ON DELETE CASCADE
);

-- Phase 17: an event chain with no customer fields. journey_id is a signed opaque identifier;
-- external_reference_hash can hold a one-way digest supplied by an authorised integration.
CREATE TABLE IF NOT EXISTS outcome_events (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  event_type TEXT NOT NULL,
  evidence_tier TEXT NOT NULL,
  source TEXT NOT NULL,
  external_reference_hash TEXT,
  amount REAL,
  currency TEXT,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  occurred_ms INTEGER NOT NULL,
  UNIQUE(journey_id, event_type, source, external_reference_hash)
);
CREATE INDEX IF NOT EXISTS idx_outcome_events_shop
  ON outcome_events(shop_domain, occurred_ms DESC);
CREATE INDEX IF NOT EXISTS idx_outcome_events_journey
  ON outcome_events(journey_id, occurred_ms);

ALTER TABLE commerce_journeys ADD COLUMN discovery_run_id TEXT;
ALTER TABLE commerce_journeys ADD COLUMN pulse_run_id TEXT;
ALTER TABLE commerce_journeys ADD COLUMN handoff_type TEXT;

CREATE TABLE IF NOT EXISTS outcome_experiments (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  population TEXT NOT NULL,
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER,
  change_description TEXT NOT NULL,
  metric TEXT NOT NULL,
  baseline_value REAL,
  result_value REAL,
  status TEXT NOT NULL DEFAULT 'running',
  result_note TEXT,
  created_ms INTEGER NOT NULL,
  completed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outcome_experiments_shop
  ON outcome_experiments(shop_domain, created_ms DESC);
