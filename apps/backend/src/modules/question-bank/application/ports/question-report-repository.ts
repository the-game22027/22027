export const QUESTION_REPORT_REPOSITORY = Symbol('QUESTION_REPORT_REPOSITORY');

export interface NewQuestionReport {
  id: string;
  questionId: string;
  userId: string;
  reason: string;
  createdAt: Date;
}

export interface ReportedQuestion {
  questionId: string;
  externalKey: string;
  status: string;
  reportCount: number;
  latestReasons: string[];
}

export interface QuestionReportRepository {
  /** false when this player already reported this question: the first report stays. */
  saveReportIfNew(report: NewQuestionReport): Promise<boolean>;
  listMostReportedQuestions(limit: number, reasonsPerQuestion: number): Promise<ReportedQuestion[]>;
}
