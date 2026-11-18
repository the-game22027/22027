-- Review fix for core.match (docs/architecture/07 §5.10). `kb ingest:matches` fills it.
-- Covering sources that had the match but whose row was refused because their own data contradicts it
-- (Transfermarkt score vs its goal events: awarded results, scores with or without the shootout). They are
-- not in missing_from (they do not lack the match), and the match stays unusable until the row is reviewed
-- (.out/review-transfermarkt-scores.csv).
ALTER TABLE core.match ADD COLUMN rejected_in text[] NOT NULL DEFAULT '{}';

-- A view's * is expanded when it is created, so recreate it to include the new column.
DROP VIEW core.usable_match;
CREATE VIEW core.usable_match AS SELECT * FROM core.match WHERE usable;
