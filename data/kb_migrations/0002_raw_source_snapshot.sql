-- D.3a raw landing (docs/architecture/07 §5.10). The raw.<source>__<file> tables are created by the loader
-- from each file's header, because their columns are whatever the source publishes.

-- One row per file load: which bytes are in raw.<source>__<file> right now, and where they came from.
CREATE TABLE raw.source_snapshot (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source         text NOT NULL,             -- sources.toml id, e.g. transfermarkt
  file           text NOT NULL,             -- games.csv.gz
  raw_table      text NOT NULL,             -- raw.transfermarkt__games
  url            text NOT NULL,
  sha256         text NOT NULL,
  downloaded_at  timestamptz NOT NULL,
  row_count      bigint NOT NULL,
  license        text NOT NULL,
  license_note   text NULL,
  loaded_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX source_snapshot_latest_idx ON raw.source_snapshot (source, file, loaded_at DESC);
