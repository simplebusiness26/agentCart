-- Launch verification evidence. Phase 11.2's hard rule: green unit tests must never set MVP
-- status to complete; the real-infrastructure gate has to pass.
--
-- Never stores secrets. Diagnostics are truncated and redacted before they are written here.
CREATE TABLE IF NOT EXISTS launch_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  environment TEXT NOT NULL,
  check_key TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence TEXT,
  failure_reason TEXT,
  remediation TEXT,
  app_version TEXT,
  checked_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_launch_run ON launch_checks(run_id, check_key);
CREATE INDEX IF NOT EXISTS idx_launch_recent ON launch_checks(check_key, checked_ms DESC);
