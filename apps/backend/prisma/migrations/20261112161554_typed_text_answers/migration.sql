-- AlterTable
ALTER TABLE "answer_entities" ADD COLUMN     "name_words" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "battle_round_actions" ADD COLUMN     "answer_match" TEXT,
ADD COLUMN     "answer_text" TEXT;

-- CreateIndex
CREATE INDEX "answer_entities_search_forms_idx" ON "answer_entities" USING GIN ("search_forms");
