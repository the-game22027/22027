-- Where an entity came from (docs/architecture/07 §5.10). SCOPE: the D.1 Wikidata scope (`kb ingest`).
-- LINKED: added by `kb link` because another source names it. Only SCOPE entities enter the answer catalog
-- for now, so linking cannot change which typed answers are accepted (DEC-55, ADR-0021; pending DEC).
ALTER TABLE core.entity
  ADD COLUMN origin text NOT NULL DEFAULT 'SCOPE' CHECK (origin IN ('SCOPE', 'LINKED'));

-- Backfill: `kb ingest` writes every SCOPE entity in one transaction, so they all share the earliest
-- updated_at; every row written later came from a `kb link` transaction.
UPDATE core.entity SET origin = 'LINKED'
WHERE updated_at > (SELECT min(updated_at) FROM core.entity);
