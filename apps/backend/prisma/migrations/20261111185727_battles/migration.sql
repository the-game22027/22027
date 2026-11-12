-- CreateEnum
CREATE TYPE "battle_status" AS ENUM ('WAITING_READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "battle_mode" AS ENUM ('MATCHMAKING', 'ROOM');

-- CreateEnum
CREATE TYPE "participant_kind" AS ENUM ('HUMAN', 'BOT');

-- CreateEnum
CREATE TYPE "battle_outcome" AS ENUM ('WIN', 'LOSS', 'DRAW');

-- CreateTable
CREATE TABLE "battles" (
    "id" UUID NOT NULL,
    "status" "battle_status" NOT NULL,
    "mode" "battle_mode" NOT NULL,
    "game_type" "battle_game_type" NOT NULL,
    "room_id" UUID,
    "has_bot" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "rule_set_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "ready_deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "end_reason" TEXT,
    "owner_instance_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_participants" (
    "id" UUID NOT NULL,
    "battle_id" UUID NOT NULL,
    "kind" "participant_kind" NOT NULL,
    "user_id" UUID,
    "bot_profile" TEXT,
    "bot_display" JSONB,
    "locale" TEXT NOT NULL,
    "seat" SMALLINT NOT NULL,
    "ready_at" TIMESTAMPTZ(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "placement" SMALLINT,
    "outcome" "battle_outcome",
    "disconnected_at" TIMESTAMPTZ(3),
    "forfeited_at" TIMESTAMPTZ(3),

    CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_rounds" (
    "battle_id" UUID NOT NULL,
    "round_no" SMALLINT NOT NULL,
    "question_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "steps_revealed" SMALLINT,
    "winner_participant_id" UUID,
    "end_reason" TEXT,

    CONSTRAINT "battle_rounds_pkey" PRIMARY KEY ("battle_id","round_no")
);

-- CreateTable
CREATE TABLE "battle_round_actions" (
    "battle_id" UUID NOT NULL,
    "round_no" SMALLINT NOT NULL,
    "action_no" SMALLINT NOT NULL,
    "participant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "entity_id" UUID,
    "number_answer" DECIMAL,
    "cell" SMALLINT,
    "is_correct" BOOLEAN,
    "points" INTEGER NOT NULL DEFAULT 0,
    "client_msg_id" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "battle_round_actions_pkey" PRIMARY KEY ("battle_id","round_no","action_no")
);

-- CreateIndex
CREATE INDEX "battles_status_created_at_idx" ON "battles"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "battle_participants_battle_id_seat_key" ON "battle_participants"("battle_id", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "battle_rounds_battle_id_question_id_key" ON "battle_rounds"("battle_id", "question_id");

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_winner_participant_id_fkey" FOREIGN KEY ("winner_participant_id") REFERENCES "battle_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_round_actions" ADD CONSTRAINT "battle_round_actions_battle_id_round_no_fkey" FOREIGN KEY ("battle_id", "round_no") REFERENCES "battle_rounds"("battle_id", "round_no") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_round_actions" ADD CONSTRAINT "battle_round_actions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "battle_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_round_actions" ADD CONSTRAINT "battle_round_actions_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "answer_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules Prisma cannot express (02-database.md §4.8).
ALTER TABLE "battles" ADD CONSTRAINT "battles_room_matches_mode" CHECK (("mode" = 'ROOM') = ("room_id" IS NOT NULL));
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_kind_fields" CHECK (
  ("kind" = 'HUMAN' AND "user_id" IS NOT NULL AND "bot_profile" IS NULL)
  OR ("kind" = 'BOT' AND "user_id" IS NULL AND "bot_profile" IS NOT NULL)
);
-- A user takes at most one seat in a battle.
CREATE UNIQUE INDEX "battle_participants_battle_id_user_id_key" ON "battle_participants" ("battle_id", "user_id") WHERE "user_id" IS NOT NULL;
-- Battle history and recent-exposure lookups (DEC-44).
CREATE INDEX "battle_participants_user_id_battle_id_idx" ON "battle_participants" ("user_id", "battle_id") WHERE "user_id" IS NOT NULL;
-- Duplicate message detection.
CREATE UNIQUE INDEX "battle_round_actions_participant_id_client_msg_id_key" ON "battle_round_actions" ("participant_id", "client_msg_id") WHERE "client_msg_id" IS NOT NULL;
