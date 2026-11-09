-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "favourite_team_id" UUID;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_favourite_team_id_fkey" FOREIGN KEY ("favourite_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
