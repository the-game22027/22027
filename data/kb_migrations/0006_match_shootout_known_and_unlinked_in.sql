-- Review fixes for core.match (docs/architecture/07 §5.10). `kb ingest:matches` fills both columns.

-- NULL shootout columns meant both "no shootout" and "no source says". shootout_known is true when at least one
-- source states whether there was a shootout (martj42 only names winners, so its silence is not a "no").
ALTER TABLE core.match ADD COLUMN shootout_known boolean NOT NULL DEFAULT false;
-- Rows from an earlier run: a stored shootout is a known one. The next `kb ingest:matches` sets every row.
UPDATE core.match SET shootout_known = true WHERE shootout_home IS NOT NULL OR shootout_winner_ref IS NOT NULL;
ALTER TABLE core.match ADD CONSTRAINT match_shootout_needs_shootout_known
  CHECK (shootout_known OR (shootout_home IS NULL AND shootout_winner_ref IS NULL));

-- Sources whose window covers the match and that have it, but with a team we cannot link (Fjelstul's Sweden,
-- 2002). They are not in missing_from: they do not lack the match, we only cannot compare it.
ALTER TABLE core.match ADD COLUMN unlinked_in text[] NOT NULL DEFAULT '{}';

-- A view's * is expanded when it is created, so recreate it to include the new columns.
DROP VIEW core.usable_match;
CREATE VIEW core.usable_match AS SELECT * FROM core.match WHERE usable;
