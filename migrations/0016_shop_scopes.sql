-- Scopes Shopify actually granted at install, which can be narrower than the ones requested.
-- Stored so a fix that needs a scope is withheld with an explanation rather than offered,
-- attempted and failed. NULL means an install that predates this column: unknown, not empty.
ALTER TABLE shops ADD COLUMN granted_scopes TEXT;
