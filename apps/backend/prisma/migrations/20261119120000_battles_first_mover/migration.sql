-- First-mover decisions of a battle (08 §9.1, ADR-0023); NULL for game types without a first mover.
ALTER TABLE "battles" ADD COLUMN "first_mover" JSONB;
