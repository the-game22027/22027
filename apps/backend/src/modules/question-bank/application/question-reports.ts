import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '@shared/kernel';
import { normalizeReportReason } from '../domain/question-report';
import {
  QUESTION_REPORT_REPOSITORY,
  type QuestionReportRepository,
  type ReportedQuestion,
} from './ports/question-report-repository';

const REASONS_PER_QUESTION = 3;

/** Players flag wrong questions; operators read the list and disable (08 §5.7). */
@Injectable()
export class QuestionReports {
  constructor(
    @Inject(QUESTION_REPORT_REPOSITORY) private readonly reports: QuestionReportRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The caller must have checked the player was served the question (battles does). Returns false when
   * the player had already reported it.
   */
  reportQuestion(questionId: string, userId: string, reason: string): Promise<boolean> {
    return this.reports.saveReportIfNew({
      id: this.ids.next(),
      questionId,
      userId,
      reason: normalizeReportReason(reason),
      createdAt: this.clock.now(),
    });
  }

  listMostReportedQuestions(limit: number): Promise<ReportedQuestion[]> {
    return this.reports.listMostReportedQuestions(limit, REASONS_PER_QUESTION);
  }
}
