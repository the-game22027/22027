-- N8 ONE_TWO link graph (08 §15.8, ADR-0024).
-- CreateEnum
CREATE TYPE "link_pass_type" AS ENUM ('FACED_IN_FINAL', 'FACED_IN_KNOCKOUT', 'SCORED_IN_SAME_MATCH', 'ASSIST_GIVEN', 'ASSIST_RECEIVED', 'SCORED_AGAINST', 'CONCEDED_TO');

-- CreateTable
CREATE TABLE "entity_links" (
    "from_entity_id" UUID NOT NULL,
    "pass_type" "link_pass_type" NOT NULL,
    "to_entity_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("from_entity_id","pass_type","to_entity_id")
);

-- CreateTable
CREATE TABLE "link_matches" (
    "id" UUID NOT NULL,
    "external_key" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,

    CONSTRAINT "link_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_link_counts" (
    "entity_id" UUID NOT NULL,
    "pass_type" "link_pass_type" NOT NULL,
    "neighbour_count" INTEGER NOT NULL,

    CONSTRAINT "entity_link_counts_pkey" PRIMARY KEY ("entity_id","pass_type")
);

-- CreateIndex
CREATE UNIQUE INDEX "link_matches_external_key_key" ON "link_matches"("external_key");

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_from_entity_id_fkey" FOREIGN KEY ("from_entity_id") REFERENCES "answer_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_to_entity_id_fkey" FOREIGN KEY ("to_entity_id") REFERENCES "answer_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "link_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_link_counts" ADD CONSTRAINT "entity_link_counts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "answer_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
