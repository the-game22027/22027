-- CreateEnum
CREATE TYPE "game_type" AS ENUM ('PREDICTION', 'MOTM', 'BATTLE');

-- CreateEnum
CREATE TYPE "rule_set_status" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateTable
CREATE TABLE "scoring_rule_sets" (
    "id" UUID NOT NULL,
    "game_type" "game_type" NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" "rule_set_status" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "scoring_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "game_type" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "source_revision" INTEGER NOT NULL DEFAULT 0,
    "rule_set_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(3),
    "superseded_by" UUID,
    "context" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "point_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rule_sets_game_type_version_key" ON "scoring_rule_sets"("game_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "point_entries_source_type_source_id_rule_set_id_source_revi_key" ON "point_entries"("source_type", "source_id", "rule_set_id", "source_revision");

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "scoring_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_entries" ADD CONSTRAINT "point_entries_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "scoring_rule_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules Prisma cannot express (02-database.md §4.9).
-- At most one ACTIVE rule set per game type.
CREATE UNIQUE INDEX "scoring_rule_sets_game_type_active_key" ON "scoring_rule_sets" ("game_type") WHERE "status" = 'ACTIVE';
-- Sums per user and category over a time window (leaderboard rebuilds, league rankings).
CREATE INDEX "point_entries_user_id_category_occurred_at_idx" ON "point_entries" ("user_id", "category", "occurred_at") WHERE "superseded_at" IS NULL;
-- Period rebuilds: every live entry in a time window.
CREATE INDEX "point_entries_occurred_at_idx" ON "point_entries" ("occurred_at") WHERE "superseded_at" IS NULL;
