-- Phases 18-21: canonical Business Brain, merchant-controlled Sales Agent,
-- regression tests, provider publications and privacy-minimised conversation events.

CREATE TABLE IF NOT EXISTS business_facts (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  value_json TEXT NOT NULL,
  source TEXT NOT NULL,
  source_record_id TEXT,
  confidence TEXT NOT NULL DEFAULT 'verified',
  merchant_approved INTEGER NOT NULL DEFAULT 0,
  public_safe INTEGER NOT NULL DEFAULT 0,
  freshness_ms INTEGER,
  verified_ms INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(shop_domain, fact_key, source)
);
CREATE INDEX IF NOT EXISTS idx_business_facts_shop
  ON business_facts(shop_domain, public_safe, verified_ms DESC);

CREATE TABLE IF NOT EXISTS ai_sales_agents (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  display_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  tone_json TEXT NOT NULL DEFAULT '{}',
  supported_intents_json TEXT NOT NULL DEFAULT '[]',
  allowed_scopes_json TEXT NOT NULL DEFAULT '[]',
  allowed_actions_json TEXT NOT NULL DEFAULT '[]',
  escalation_json TEXT NOT NULL DEFAULT '{}',
  unsupported_topics_json TEXT NOT NULL DEFAULT '[]',
  locale TEXT NOT NULL DEFAULT 'en-GB',
  config_version INTEGER NOT NULL DEFAULT 1,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_sales_agents_shop
  ON ai_sales_agents(shop_domain, updated_ms DESC);

CREATE TABLE IF NOT EXISTS ai_sales_agent_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  change_note TEXT,
  created_ms INTEGER NOT NULL,
  UNIQUE(agent_id, version),
  FOREIGN KEY(agent_id) REFERENCES ai_sales_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_sales_agent_actions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  mode TEXT NOT NULL,
  input_schema_json TEXT NOT NULL DEFAULT '{}',
  handoff_url TEXT,
  authorization_required INTEGER NOT NULL DEFAULT 0,
  approval_required INTEGER NOT NULL DEFAULT 0,
  test_supported INTEGER NOT NULL DEFAULT 0,
  verification_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(agent_id, action_type),
  FOREIGN KEY(agent_id) REFERENCES ai_sales_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_sales_agent_publications (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  state TEXT NOT NULL,
  provider_reference TEXT,
  package_json TEXT NOT NULL DEFAULT '{}',
  verified_ms INTEGER,
  limitations_json TEXT NOT NULL DEFAULT '[]',
  updated_ms INTEGER NOT NULL,
  UNIQUE(agent_id, channel),
  FOREIGN KEY(agent_id) REFERENCES ai_sales_agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_test_suites (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_test_cases (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  prompt TEXT NOT NULL,
  expected_json TEXT NOT NULL DEFAULT '{}',
  severity TEXT NOT NULL DEFAULT 'medium',
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(suite_id) REFERENCES conversation_test_suites(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS conversation_test_runs (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  suite_id TEXT NOT NULL,
  evidence_class TEXT NOT NULL,
  agent_version INTEGER NOT NULL,
  brain_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  started_ms INTEGER NOT NULL,
  completed_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_conversation_runs_shop
  ON conversation_test_runs(shop_domain, started_ms DESC);
CREATE TABLE IF NOT EXISTS conversation_test_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  failure_class TEXT,
  created_ms INTEGER NOT NULL,
  UNIQUE(run_id, case_id),
  FOREIGN KEY(run_id) REFERENCES conversation_test_runs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversation_events (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  journey_id TEXT,
  agent_id TEXT,
  channel TEXT NOT NULL,
  event_type TEXT NOT NULL,
  intent_class TEXT,
  evidence_tier TEXT NOT NULL,
  handoff_id TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  occurred_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversation_events_shop
  ON conversation_events(shop_domain, occurred_ms DESC);

