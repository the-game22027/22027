import { Inject, Injectable } from '@nestjs/common';
import { QuestionReports } from '@modules/question-bank';
import { ServedQuestionNotFoundError } from '../domain/battle-errors';
import { BATTLE_REPOSITORY, type BattleRepository } from './ports/battle-repository';

/**
 * A player reports a question they met in a battle (08 §5.7). Battles checks "served to you" because only
 * battles knows; question-bank stores the report.
 */
@Injectable()
export class ReportServedQuestion {
  constructor(
    @Inject(BATTLE_REPOSITORY) private readonly battles: BattleRepository,
    private readonly reports: QuestionReports,
  ) {}

  async reportServedQuestion(questionId: string, userId: string, reason: string): Promise<void> {
    if (!(await this.battles.wasQuestionServedToUser(questionId, userId))) throw new ServedQuestionNotFoundError();
    await this.reports.reportQuestion(questionId, userId, reason);
  }
}
