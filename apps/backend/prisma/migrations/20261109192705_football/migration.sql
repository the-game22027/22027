-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "match_decided_by" AS ENUM ('REGULAR_TIME', 'EXTRA_TIME', 'PENALTIES');

-- CreateTable
CREATE TABLE "competitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "type" TEXT NOT NULL,
    "country_code" CHAR(2),
    "is_national_teams" BOOLEAN NOT NULL,
    "external_refs" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "names" JSONB NOT NULL,
    "short_name" TEXT,
    "type" TEXT NOT NULL,
    "country_code" CHAR(2),
    "crest_url" TEXT,
    "external_refs" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" UUID NOT NULL,
    "names" JSONB NOT NULL,
    "known_as" TEXT,
    "birth_date" DATE,
    "nationality_code" CHAR(2),
    "position" TEXT,
    "external_refs" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "competition_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "round_label" TEXT,
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "kickoff_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "home_score" SMALLINT,
    "away_score" SMALLINT,
    "decided_by" "match_decided_by",
    "home_penalties" SMALLINT,
    "away_penalties" SMALLINT,
    "result_version" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT NOT NULL,
    "provider_match_id" TEXT NOT NULL,
    "provider_updated_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_squad_players" (
    "match_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "shirt_number" SMALLINT,

    CONSTRAINT "match_squad_players_pkey" PRIMARY KEY ("match_id","player_id")
);

-- CreateTable
CREATE TABLE "provider_sync_runs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "status" TEXT NOT NULL,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "provider_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competitions_code_key" ON "competitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_competition_id_label_key" ON "seasons"("competition_id", "label");

-- CreateIndex
CREATE INDEX "matches_kickoff_at_idx" ON "matches"("kickoff_at");

-- CreateIndex
CREATE INDEX "matches_status_kickoff_at_idx" ON "matches"("status", "kickoff_at");

-- CreateIndex
CREATE INDEX "matches_competition_id_kickoff_at_idx" ON "matches"("competition_id", "kickoff_at");

-- CreateIndex
CREATE UNIQUE INDEX "matches_provider_provider_match_id_key" ON "matches"("provider", "provider_match_id");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_squad_players" ADD CONSTRAINT "match_squad_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_squad_players" ADD CONSTRAINT "match_squad_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_squad_players" ADD CONSTRAINT "match_squad_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A team cannot play itself. Prisma has no syntax for CHECK constraints.
ALTER TABLE "matches" ADD CONSTRAINT "matches_different_teams" CHECK ("home_team_id" <> "away_team_id");
