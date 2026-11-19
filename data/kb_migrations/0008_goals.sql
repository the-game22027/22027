-- D.3d first goals slice (docs/architecture/07 §5.10, N2): goals of usable matches from Transfermarkt events.
-- `kb ingest:matches` rebuilds it after the matches; nothing here is edited by hand. Player refs are core.entity
-- external_refs without a foreign key, for the same reason as core.match (see 0005).
CREATE TABLE core.goal (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id           bigint NOT NULL REFERENCES core.match ON DELETE CASCADE,
  team_ref           text NOT NULL,             -- the team the goal counts for (an own goal: the benefiting team)
  scorer_ref         text NULL,                 -- NULL when the source's player id is not linked
  scorer_source_id   text NOT NULL,
  minute             smallint NULL,
  penalty            boolean NOT NULL,
  own_goal           boolean NOT NULL,
  assist_ref         text NULL,                 -- NULL: no assist, an unlinked one, or one the lineup check dropped
  assist_source_id   text NULL,
  source             text NOT NULL,
  source_row_id      text NOT NULL,             -- Transfermarkt game_event_id
  license            text NOT NULL,
  UNIQUE (source, source_row_id)
);
CREATE INDEX goal_match_idx ON core.goal (match_id);
CREATE INDEX goal_scorer_idx ON core.goal (scorer_ref);
