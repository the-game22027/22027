import { Command, CommandRunner, Option } from 'nest-commander';
import { AppConfig } from '@shared/infrastructure/config';
import { QuestionBankFacade } from '../../application/question-bank.facade';

@Command({
  name: 'questions:publish',
  arguments: '<bundleVersion>',
  description: "Publish a bundle's approved questions, so battles can pick them",
})
export class QuestionsPublishCommand extends CommandRunner {
  constructor(
    private readonly questionBank: QuestionBankFacade,
    private readonly config: AppConfig,
  ) {
    super();
  }

  @Option({
    flags: '--include-drafts',
    description: 'Also publish unreviewed questions (development bundles only; refused in production)',
  })
  parseIncludeDraftsOption(): boolean {
    return true;
  }

  async run([bundleVersion]: string[], options: { includeDrafts?: boolean }): Promise<void> {
    const includeDrafts = options.includeDrafts === true;
    if (includeDrafts && !this.config.devToolsEnabled) {
      throw new Error('--include-drafts publishes unreviewed content; it is refused when NODE_ENV=production');
    }
    const { publishedCount, waitingForReviewCount } = await this.questionBank.publishQuestionsOfBundle(bundleVersion, {
      includeDrafts,
    });
    process.stdout.write(
      `${bundleVersion}: ${String(publishedCount)} published, ${String(waitingForReviewCount)} waiting for review\n`,
    );
  }
}
