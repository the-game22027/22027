import { Command, CommandRunner, Option } from 'nest-commander';
import { QuestionBankFacade } from '../../application/question-bank.facade';

@Command({
  name: 'questions:disable',
  arguments: '<questionId>',
  description: 'Disable a wrong or reported question; battles stop picking it at once',
})
export class QuestionsDisableCommand extends CommandRunner {
  constructor(private readonly questionBank: QuestionBankFacade) {
    super();
  }

  @Option({ flags: '--reason <text>', description: 'Why it is disabled (kept on the question)', required: true })
  parseReasonOption(value: string): string {
    return value;
  }

  async run([questionId]: string[], options: { reason: string }): Promise<void> {
    const disabled = await this.questionBank.disableQuestion(questionId, options.reason);
    process.stdout.write(`${questionId}: ${disabled ? 'disabled' : 'was already disabled, nothing changed'}\n`);
  }
}
