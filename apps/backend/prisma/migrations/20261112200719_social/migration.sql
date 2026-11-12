-- CreateEnum
CREATE TYPE "friend_request_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "friend_requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "addressee_id" UUID NOT NULL,
    "status" "friend_request_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "responded_at" TIMESTAMPTZ(3),

    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "user_low_id" UUID NOT NULL,
    "user_high_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_low_id","user_high_id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateIndex
CREATE INDEX "friend_requests_addressee_id_status_idx" ON "friend_requests"("addressee_id", "status");

-- CreateIndex
CREATE INDEX "friend_requests_requester_id_status_idx" ON "friend_requests"("requester_id", "status");

-- CreateIndex
CREATE INDEX "friendships_user_high_id_idx" ON "friendships"("user_high_id");

-- CreateIndex
CREATE INDEX "user_blocks_blocked_id_idx" ON "user_blocks"("blocked_id");

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_addressee_id_fkey" FOREIGN KEY ("addressee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_id_fkey" FOREIGN KEY ("user_low_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_id_fkey" FOREIGN KEY ("user_high_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules Prisma cannot express (02-database.md §4.12, 03 §7.1).
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_not_to_self" CHECK ("requester_id" <> "addressee_id");
-- At most one pending request per pair, whoever sent it: two players asking each other at once cannot both insert.
CREATE UNIQUE INDEX "friend_requests_pending_pair_key" ON "friend_requests" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id")) WHERE "status" = 'PENDING';
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_low_before_high" CHECK ("user_low_id" < "user_high_id");
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_not_self" CHECK ("blocker_id" <> "blocked_id");
-- User search: display name containing the query (03 §7.1). The table belongs to users; the index serves its search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "user_profiles_display_name_trgm_idx" ON "user_profiles" USING GIN ("display_name" gin_trgm_ops);
