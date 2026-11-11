-- CreateEnum
CREATE TYPE "battle_game_type" AS ENUM ('BUZZER', 'CAREER', 'WHO_IS_PLAYER', 'GRID');

-- CreateEnum
CREATE TYPE "answer_kind" AS ENUM ('PLAYER', 'CLUB', 'NATIONAL_TEAM', 'COUNTRY', 'COMPETITION', 'COACH', 'NUMBER');

-- AlterTable
ALTER TABLE "question_import_batches" ADD COLUMN     "catalog_checksum" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "answer_kind" "answer_kind",
ADD COLUMN     "content" JSONB,
ADD COLUMN     "game_type" "battle_game_type";

-- CreateTable
CREATE TABLE "question_answers" (
    "question_id" UUID NOT NULL,
    "slot" SMALLINT NOT NULL,
    "entity_id" UUID NOT NULL,

    CONSTRAINT "question_answers_pkey" PRIMARY KEY ("question_id","slot","entity_id")
);

-- CreateTable
CREATE TABLE "answer_entities" (
    "id" UUID NOT NULL,
    "external_ref" TEXT NOT NULL,
    "kind" "answer_kind" NOT NULL,
    "names" JSONB NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "search_forms" TEXT[],
    "catalog_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "answer_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_entity_aliases" (
    "entity_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "answer_entity_aliases_pkey" PRIMARY KEY ("entity_id","locale","alias")
);

-- CreateIndex
CREATE INDEX "question_answers_entity_id_idx" ON "question_answers"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "answer_entities_external_ref_key" ON "answer_entities"("external_ref");

-- CreateIndex
CREATE INDEX "answer_entities_kind_idx" ON "answer_entities"("kind");

-- CreateIndex
CREATE INDEX "questions_status_game_type_difficulty_category_id_idx" ON "questions"("status", "game_type", "difficulty", "category_id");

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "answer_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_entity_aliases" ADD CONSTRAINT "answer_entity_aliases_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "answer_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw SQL (Prisma cannot express CHECK constraints; it ignores them, so there is no drift).
-- A catalog entity is a thing with a name; numbers are answered as numbers, never as entities.
ALTER TABLE "answer_entities" ADD CONSTRAINT "answer_entities_kind_is_entity" CHECK ("kind" <> 'NUMBER');
-- A GAME row always knows its game, its answer kind and its content; legacy rows have none of them.
ALTER TABLE "questions" ADD CONSTRAINT "questions_game_columns_complete" CHECK (
  ("type" = 'GAME') = ("game_type" IS NOT NULL AND "answer_kind" IS NOT NULL AND "content" IS NOT NULL)
);
