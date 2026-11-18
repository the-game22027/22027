-- D.3b linking (docs/architecture/07 §5.10, ADR-0022): one Wikidata entity per thing, whatever source names it.

-- Match data needs national teams, coaches and competitions as their own entities (the app's AnswerKind has them).
ALTER TABLE core.entity DROP CONSTRAINT entity_kind_check;
ALTER TABLE core.entity ADD CONSTRAINT entity_kind_check
  CHECK (kind IN ('PLAYER', 'CLUB', 'COUNTRY', 'NATIONAL_TEAM', 'COACH', 'COMPETITION'));

-- A source's own id → our entity. Ids are only unique per kind inside a source (Transfermarkt player 418 and
-- club 418 are different things), so the kind is part of the key.
CREATE TABLE core.entity_xref (
  source       text NOT NULL,                -- sources.toml id
  source_kind  text NOT NULL CHECK (source_kind IN ('PLAYER', 'CLUB', 'NATIONAL_TEAM', 'COACH', 'COMPETITION')),
  source_id    text NOT NULL,
  entity_ref   text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  method       text NOT NULL CHECK (method IN ('WIKIDATA_ID', 'WIKIPEDIA_LINK', 'NAME_REVIEWED')),
  reviewed_by  text NULL,                    -- set for NAME_REVIEWED
  PRIMARY KEY (source, source_kind, source_id)
);
CREATE INDEX entity_xref_entity_idx ON core.entity_xref (entity_ref);
