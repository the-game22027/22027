-- D.1 Wikidata slice (docs/architecture/07 §4.2). Owned by the Python pipeline; the app never connects here.
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS core;

-- Every SPARQL response we used, so re-runs are offline and reproducible.
CREATE TABLE raw.sparql_cache (
  query_hash  text PRIMARY KEY,            -- sha256 of the query text
  query_text  text NOT NULL,
  response    jsonb NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.entity (
  external_ref text PRIMARY KEY,           -- wikidata:Q11571
  kind         text NOT NULL CHECK (kind IN ('PLAYER', 'CLUB', 'COUNTRY')),
  sitelinks    int NOT NULL DEFAULT 0,     -- Wikipedia editions with an article: popularity proxy
  birth_year   int NULL,                   -- players
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entity_kind_idx ON core.entity (kind, sitelinks DESC);

CREATE TABLE core.entity_name (
  external_ref text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  locale       text NOT NULL CHECK (locale IN ('en', 'ar')),
  name         text NOT NULL,
  name_kind    text NOT NULL CHECK (name_kind IN ('LABEL', 'ALIAS')),
  source       text NOT NULL CHECK (source IN ('wikidata', 'override')),
  PRIMARY KEY (external_ref, locale, name)
);
-- At most one display label per entity and language.
CREATE UNIQUE INDEX entity_name_one_label_idx ON core.entity_name (external_ref, locale) WHERE name_kind = 'LABEL';

CREATE TABLE core.career_spell (
  statement_id text PRIMARY KEY,           -- Wikidata statement id: provenance
  player_ref   text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  team_ref     text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  from_year    int NULL,
  to_year      int NULL,                   -- NULL with a from_year = still there
  loan         boolean NOT NULL DEFAULT false
);
CREATE INDEX career_spell_player_idx ON core.career_spell (player_ref);
CREATE INDEX career_spell_team_idx ON core.career_spell (team_ref);

CREATE TABLE core.player_country (
  player_ref  text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  country_ref text NOT NULL REFERENCES core.entity ON DELETE CASCADE,
  PRIMARY KEY (player_ref, country_ref)
);
