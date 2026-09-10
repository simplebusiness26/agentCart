-- Bumped on every install so cookies issued before a reinstall stop verifying.
-- Combined with the issued-at inside the cookie and the requirement that a shops row
-- still exist, this gives three independent ways to revoke a merchant session.
ALTER TABLE shops ADD COLUMN session_epoch INTEGER NOT NULL DEFAULT 0;
