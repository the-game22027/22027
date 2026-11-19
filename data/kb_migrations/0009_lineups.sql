-- D.3d lineups slice (docs/architecture/07 §5.10, N3): lineups of usable matches from Transfermarkt.
-- `kb ingest:matches` rebuilds it after the goals; only matches whose lineups pass the D.3f gates are stored.
-- Player refs are core.entity external_refs without a foreign key, for the same reason as core.match (see 0005).
CREATE TABLE core.lineup_slot (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id           bigint NOT NULL REFERENCES core.match ON DELETE CASCADE,
  team_ref           text NOT NULL,
  player_ref         text NULL,                 -- NULL when the source's player id is not linked
  player_source_id   text NOT NULL,
  starter            boolean NOT NULL,
  position           text NULL,
  shirt_number       smallint NULL,
  captain            boolean NOT NULL,
  source             text NOT NULL,
  source_row_id      text NOT NULL,             -- Transfermarkt game_lineups_id
  license            text NOT NULL,
  UNIQUE (source, source_row_id)
);
CREATE INDEX lineup_slot_match_idx ON core.lineup_slot (match_id);
CREATE INDEX lineup_slot_player_idx ON core.lineup_slot (player_ref);
