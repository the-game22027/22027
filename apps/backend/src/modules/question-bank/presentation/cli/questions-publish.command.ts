import { Command, CommandRunner } from 'nest-commander';
import { QuestionBankFacade } from '../../application/question-bank.facade';

@Command({
  name: 'questions:publish',
  arguments: '<bundleVersion>',
  description: "Publish a bundle's approved questions, so battles can pick them",
})
export class QuestionsPublishCommand extends CommandRunner {
  constructor(private readonly questionBank: QuestionBankFacade) {
    super();
  }

  async run([bundleVersion]: string[]): Promise<void> {
    const { publishedCount, waitingForReviewCount } =
      await this.questionBank.publishApprovedQuestionsOfBundle(bundleVersion);
    process.stdout.write(
      `${bundleVersion}: ${String(publishedCount)} published, ${String(waitingForReviewCount)} waiting for review\n`,
    );
  }
}
