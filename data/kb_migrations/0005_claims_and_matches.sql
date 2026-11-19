-- D.3c claims and D.3d typed match tables (docs/architecture/07 §5.10, ADR-0022). `kb ingest:matches` rebuilds
-- every table here from raw.* and core.entity_xref; nothing in them is edited by hand.
--
-- Team and competition refs are core.entity external_refs, stored without a foreign key on purpose:
-- `kb ingest` truncates core.entity and `kb link` deletes LINKED entities, and both must keep working.
-- Run `kb ingest:matches` again after either of them.

-- What one source row asserts. Rebuilt per fact type; a claim is never edited to agree with another source.
CREATE TABLE core.claim (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL,                 -- sources.toml id
  source_row_id  text NOT NULL,                 -- the source's own row id (Transfermarkt game_id, ...)
  snapshot_id    bigint NOT NULL REFERENCES raw.source_snapshot ON DELETE CASCADE,
  fact_type      text NOT NULL,                 -- MATCH_RESULT
  fact_key       text NOT NULL,                 -- competition|date|home|away as this source states it
  value          jsonb NOT NULL,
  license        text NOT NULL,
  UNIQUE (source, fact_type, source_row_id)
);
CREATE INDEX claim_fact_idx ON core.claim (fact_type, fact_key);

-- A competition: one Wikidata item, whatever each source calls it (config/competitions.toml).
CREATE TABLE core.competition (
  competition_ref  text PRIMARY KEY,           -- wikidata:Q19317
  key              text NOT NULL UNIQUE,       -- world-cup (also the topic slug, 07 §5.9)
  name_en          text NOT NULL,
  name_ar          text NOT NULL,
  kind             text NOT NULL CHECK (kind IN ('LEAGUE', 'CUP', 'INTERNATIONAL')),
  tier             smallint NOT NULL CHECK (tier BETWEEN 1 AND 3)
);

-- One season of a league or cup, or one tournament.
CREATE TABLE core.edition (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  competition_ref  text NOT NULL REFERENCES core.competition ON DELETE CASCADE,
  season_label     text NOT NULL,              -- 2015-16 for club seasons; 2020 for Euro 2020 (played 2021)
  final_year       int NOT NULL,               -- year of the edition's last match
  UNIQUE (competition_ref, season_label)
);

-- A resolved match. Goals include extra time and never the shootout.
CREATE TABLE core.match (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  edition_id           bigint NOT NULL REFERENCES core.edition ON DELETE CASCADE,
  stage                text NULL CHECK (stage IN ('GROUP', 'LEAGUE', 'EARLY_ROUND', 'KNOCKOUT_PLAYOFF',
                         'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL')),
  leg                  smallint NULL CHECK (leg IN (1, 2)),
  match_date           date NOT NULL,
  home_team_ref        text NOT NULL,
  away_team_ref        text NOT NULL,
  home_goals           smallint NOT NULL CHECK (home_goals >= 0),
  away_goals           smallint NOT NULL CHECK (away_goals >= 0),
  extra_time           boolean NULL,           -- NULL: no source says
  shootout_home        smallint NULL,
  shootout_away        smallint NULL,
  shootout_winner_ref  text NULL,              -- set even when only the winner is known (martj42)
  status               text NOT NULL CHECK (status IN ('VERIFIED', 'SINGLE_SOURCE', 'CONFLICT')),
  -- VERIFIED, or SINGLE_SOURCE from a source the precedence table trusts that no covering source lacks.
  -- CONFLICT is never usable: its values are only the precedence table's provisional pick.
  usable               boolean NOT NULL,
  sources              text[] NOT NULL,
  licenses             text[] NOT NULL,
  missing_from         text[] NOT NULL DEFAULT '{}',  -- sources whose window covers the match but lack it
  claim_ids            bigint[] NOT NULL,
  conflict             jsonb NULL,             -- each source's result, when status = CONFLICT
  CHECK (home_team_ref <> away_team_ref),
  CHECK (NOT (usable AND status = 'CONFLICT')),
  CHECK ((shootout_home IS NULL) = (shootout_away IS NULL)),
  UNIQUE (home_team_ref, away_team_ref, match_date)
);
CREATE INDEX match_edition_idx ON core.match (edition_id, match_date);
CREATE INDEX match_home_idx ON core.match (home_team_ref);
CREATE INDEX match_away_idx ON core.match (away_team_ref);

-- What generators read: CONFLICT and untrusted rows are already gone.
CREATE VIEW core.usable_match AS SELECT * FROM core.match WHERE usable;
