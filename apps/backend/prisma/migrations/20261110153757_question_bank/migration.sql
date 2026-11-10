-- CreateEnum
CREATE TYPE "question_status" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'DISABLED');

-- CreateTable
CREATE TABLE "question_categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_import_batches" (
    "id" UUID NOT NULL,
    "bundle_version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "generator_version" TEXT NOT NULL,
    "kb_version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stats" JSONB,
    "imported_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "external_key" TEXT NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "content_hash" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
    "category_id" UUID NOT NULL,
    "difficulty" SMALLINT NOT NULL,
    "calibrated_difficulty" DECIMAL,
    "status" "question_status" NOT NULL DEFAULT 'DRAFT',
    "available_locales" TEXT[],
    "provenance" JSONB NOT NULL,
    "license_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "valid_until" TIMESTAMPTZ(3),
    "import_batch_id" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "disabled_at" TIMESTAMPTZ(3),
    "disabled_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_translations" (
    "question_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "explanation" TEXT,
    "human_reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_translations_pkey" PRIMARY KEY ("question_id","locale")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "entity_ref" TEXT,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_option_translations" (
    "option_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "question_option_translations_pkey" PRIMARY KEY ("option_id","locale")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_categories_slug_key" ON "question_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "question_import_batches_bundle_version_key" ON "question_import_batches"("bundle_version");

-- CreateIndex
CREATE INDEX "questions_status_difficulty_category_id_idx" ON "questions"("status", "difficulty", "category_id");

-- CreateIndex
CREATE INDEX "questions_available_locales_idx" ON "questions" USING GIN ("available_locales");

-- CreateIndex
CREATE UNIQUE INDEX "questions_external_key_key_version_key" ON "questions"("external_key", "key_version");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_position_key" ON "question_options"("question_id", "position");

-- AddForeignKey
ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "question_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "question_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "question_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_option_translations" ADD CONSTRAINT "question_option_translations_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A-05: at most one correct option per question (import checks "at least one").
-- Prisma has no syntax for partial indexes.
CREATE UNIQUE INDEX "question_options_one_correct_key" ON "question_options"("question_id") WHERE "is_correct";
