-- CreateEnum
CREATE TYPE "prediction_status" AS ENUM ('ACTIVE', 'VOID');

-- CreateEnum
CREATE TYPE "pick_type" AS ENUM ('RESULT', 'EXACT_SCORE', 'MOTM');

-- CreateEnum
CREATE TYPE "outcome" AS ENUM ('HOME', 'DRAW', 'AWAY');

-- CreateTable
CREATE TABLE "predictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "status" "prediction_status" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_picks" (
    "prediction_id" UUID NOT NULL,
    "pick_type" "pick_type" NOT NULL,
    "outcome" "outcome",
    "home_score" SMALLINT,
    "away_score" SMALLINT,
    "player_id" UUID,

    CONSTRAINT "prediction_picks_pkey" PRIMARY KEY ("prediction_id","pick_type")
);

-- CreateTable
CREATE TABLE "prediction_revisions" (
    "id" UUID NOT NULL,
    "prediction_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "picks" JSONB NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "request_id" TEXT,

    CONSTRAINT "prediction_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "predictions_match_id_idx" ON "predictions"("match_id");

-- CreateIndex
CREATE INDEX "predictions_user_id_created_at_idx" ON "predictions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "predictions_user_id_match_id_key" ON "predictions"("user_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "prediction_revisions_prediction_id_revision_key" ON "prediction_revisions"("prediction_id", "revision");

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_picks" ADD CONSTRAINT "prediction_picks_prediction_id_fkey" FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_picks" ADD CONSTRAINT "prediction_picks_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_revisions" ADD CONSTRAINT "prediction_revisions_prediction_id_fkey" FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma cannot express CHECK constraints.
ALTER TABLE "prediction_picks" ADD CONSTRAINT "prediction_picks_shape" CHECK (
  ("pick_type" = 'RESULT' AND "outcome" IS NOT NULL AND "home_score" IS NULL AND "player_id" IS NULL)
  OR ("pick_type" = 'EXACT_SCORE' AND "home_score" >= 0 AND "away_score" >= 0 AND "player_id" IS NULL)
  OR ("pick_type" = 'MOTM' AND "player_id" IS NOT NULL)
);
