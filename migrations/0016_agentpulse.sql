-- Phase 13 standards evidence and Phase 14 AgentPulse foundations.
--
-- These tables deliberately store observations, fingerprints and low-cardinality errors only.
-- Credentials, request payloads, tool results and customer data do not belong here.

CREATE TABLE IF NOT EXISTS standards_review_queue (
  registry_key TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  reason TEXT NOT NULL,
  observed_version TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  queued_ms INTEGER NOT NULL,
  reviewed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_standards_review_status
  ON standards_review_queue(status, queued_ms);

CREATE TABLE IF NOT EXISTS agentpulse_targets (
  id TEXT PRIMARY KEY,
  shop_domain TEXT,
  label TEXT NOT NULL,
  protocol TEXT NOT NULL,
  transport TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  auth_mode TEXT NOT NULL DEFAULT 'public',
  journey TEXT NOT NULL,
  tool_name TEXT,
  tool_arguments_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  interval_ms INTEGER NOT NULL DEFAULT 86400000,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL,
  last_run_ms INTEGER,
  UNIQUE(endpoint, journey)
);
CREATE INDEX IF NOT EXISTS idx_agentpulse_targets_due
  ON agentpulse_targets(enabled, last_run_ms);
CREATE INDEX IF NOT EXISTS idx_agentpulse_targets_shop
  ON agentpulse_targets(shop_domain, enabled);

CREATE TABLE IF NOT EXISTS agentpulse_runs (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  shop_domain TEXT,
  protocol TEXT NOT NULL,
  journey TEXT NOT NULL,
  status TEXT NOT NULL,
  era TEXT,
  protocol_version TEXT,
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  error_category TEXT,
  error_code TEXT,
  schema_fingerprint TEXT,
  tool_count INTEGER,
  evidence_json TEXT,
  FOREIGN KEY(target_id) REFERENCES agentpulse_targets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agentpulse_runs_target
  ON agentpulse_runs(target_id, started_ms DESC);
CREATE INDEX IF NOT EXISTS idx_agentpulse_runs_shop
  ON agentpulse_runs(shop_domain, started_ms DESC);

CREATE TABLE IF NOT EXISTS agentpulse_steps (
  run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  detail TEXT,
  PRIMARY KEY(run_id, sequence),
  FOREIGN KEY(run_id) REFERENCES agentpulse_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS agentpulse_incidents (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',
  first_seen_ms INTEGER NOT NULL,
  last_seen_ms INTEGER NOT NULL,
  recovered_ms INTEGER,
  occurrences INTEGER NOT NULL DEFAULT 1,
  latest_run_id TEXT,
  FOREIGN KEY(target_id) REFERENCES agentpulse_targets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agentpulse_incidents_target
  ON agentpulse_incidents(target_id, state, last_seen_ms DESC);
