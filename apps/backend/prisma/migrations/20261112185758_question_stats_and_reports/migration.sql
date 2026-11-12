-- CreateTable
CREATE TABLE "question_stats" (
    "question_id" UUID NOT NULL,
    "times_served" INTEGER NOT NULL DEFAULT 0,
    "times_solved" INTEGER NOT NULL DEFAULT 0,
    "wrong_answers" INTEGER NOT NULL DEFAULT 0,
    "steps_to_solve_sum" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_stats_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "question_stats_applied" (
    "battle_id" UUID NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_stats_applied_pkey" PRIMARY KEY ("battle_id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_reports_question_id_user_id_key" ON "question_reports"("question_id", "user_id");

-- AddForeignKey
ALTER TABLE "question_stats" ADD CONSTRAINT "question_stats_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
