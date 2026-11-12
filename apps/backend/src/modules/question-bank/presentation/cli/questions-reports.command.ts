import { Command, CommandRunner, Option } from 'nest-commander';
import { QuestionReports } from '../../application/question-reports';

const DEFAULT_LIMIT = 20;

@Command({
  name: 'questions:reports',
  description: 'List the most reported questions with their latest reasons; disable one with questions:disable',
})
export class QuestionsReportsCommand extends CommandRunner {
  constructor(private readonly reports: QuestionReports) {
    super();
  }

  @Option({ flags: '--limit <count>', description: `How many questions to list (default ${String(DEFAULT_LIMIT)})` })
  parseLimitOption(value: string): number {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a whole number above 0');
    return limit;
  }

  async run(_arguments: string[], options: { limit?: number }): Promise<void> {
    const questions = await this.reports.listMostReportedQuestions(options.limit ?? DEFAULT_LIMIT);
    if (questions.length === 0) {
      process.stdout.write('No question has been reported\n');
      return;
    }
    for (const question of questions) {
      process.stdout.write(
        `${question.questionId}  ${String(question.reportCount)} reports  ${question.status}  ${question.externalKey}\n`,
      );
      for (const reason of question.latestReasons) process.stdout.write(`    - ${reason}\n`);
    }
  }
}
