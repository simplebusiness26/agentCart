-- Fix lifecycle and audit trail. before_json/after_json exist so a merchant-approved
-- write to their own content is reviewable and, where practical, reversible.
CREATE TABLE IF NOT EXISTS fixes (
  id TEXT PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  finding_key TEXT NOT NULL,
  target_id TEXT,
  platform TEXT NOT NULL,
  fix_type TEXT NOT NULL,
  status TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'low',
  summary TEXT,
  proposed_change_json TEXT,
  applied_change_json TEXT,
  before_json TEXT,
  after_json TEXT,
  error TEXT,
  created_ms INTEGER NOT NULL,
  approved_ms INTEGER,
  applied_ms INTEGER,
  verified_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_fixes_shop ON fixes(shop_domain, created_ms DESC);
CREATE INDEX IF NOT EXISTS idx_fixes_status ON fixes(shop_domain, status);
