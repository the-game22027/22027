-- CreateEnum
CREATE TYPE "leaderboard_kind" AS ENUM ('WEEKLY', 'MONTHLY', 'SEASONAL', 'ALL_TIME');

-- CreateEnum
CREATE TYPE "leaderboard_category" AS ENUM ('PREDICTIONS', 'BATTLES');

-- CreateEnum
CREATE TYPE "period_status" AS ENUM ('OPEN', 'CLOSED', 'FINALIZED');

-- CreateTable
CREATE TABLE "leaderboard_periods" (
    "id" UUID NOT NULL,
    "kind" "leaderboard_kind" NOT NULL,
    "category" "leaderboard_category" NOT NULL,
    "period_key" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "timezone" TEXT NOT NULL,
    "status" "period_status" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(3),
    "finalized_at" TIMESTAMPTZ(3),

    CONSTRAINT "leaderboard_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "period_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "points" BIGINT NOT NULL DEFAULT 0,
    "tiebreak_1" BIGINT NOT NULL DEFAULT 0,
    "tiebreak_2" BIGINT NOT NULL DEFAULT 0,
    "last_scored_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("period_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_periods_kind_category_period_key_key" ON "leaderboard_periods"("kind", "category", "period_key");

-- CreateIndex
CREATE INDEX "leaderboard_entries_period_id_points_tiebreak_1_tiebreak_2__idx" ON "leaderboard_entries"("period_id", "points" DESC, "tiebreak_1" DESC, "tiebreak_2" DESC, "user_id");

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "leaderboard_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
