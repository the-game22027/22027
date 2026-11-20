-- N8 review: a re-import with a rebuilt link graph is a reused bundle version, not a no-op.
-- AlterTable
ALTER TABLE "question_import_batches" ADD COLUMN     "link_graph_checksum" TEXT;

