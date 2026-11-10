-- DropIndex
DROP INDEX "outbox_events_published_at_occurred_at_idx";

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "claimed_by" UUID,
ADD COLUMN     "dead_lettered_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "outbox_events_published_at_dead_lettered_at_available_at_id_idx" ON "outbox_events"("published_at", "dead_lettered_at", "available_at", "id");
