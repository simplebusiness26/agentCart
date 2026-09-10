-- occurred_at is an ISO-8601 string from the pixel ("2026-09-09T00:21:24.500Z") but
-- comparisons used datetime('now','-30 day'), which SQLite renders space-separated
-- ("2026-08-10 00:23:57"). String comparison at index 10 is 'T' (0x54) vs ' ' (0x20),
-- so timestamps on the boundary date sorted above the cutoff and were wrongly included.
-- Store an integer epoch instead: exact, index-friendly, and unambiguous.
ALTER TABLE events ADD COLUMN occurred_ms INTEGER;
UPDATE events SET occurred_ms=CAST(strftime('%s',occurred_at) AS INTEGER)*1000 WHERE occurred_ms IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_shop_ms ON events(shop_domain, occurred_ms);
