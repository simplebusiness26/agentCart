-- Public AI-facing profile. The slug is the public identifier; it is deliberately not the
-- myshopify domain so the public surface does not leak the internal store handle.
CREATE TABLE IF NOT EXISTS ai_profiles (
  shop_domain TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  profile_json TEXT,
  last_generated_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_profiles_slug ON ai_profiles(slug);
