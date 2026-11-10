import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command, CommandRunner } from 'nest-commander';
import { ImportQuestionBundle } from '../../application/import-question-bundle';

@Command({
  name: 'questions:import',
  arguments: '<bundleDir>',
  description: 'Import a question bundle (a folder with manifest.json and questions.jsonl)',
})
export class QuestionsImportCommand extends CommandRunner {
  constructor(private readonly importer: ImportQuestionBundle) {
    super();
  }

  async run([bundleDir]: string[]): Promise<void> {
    const [manifestJson, questionsJsonl] = await Promise.all([
      readFile(join(bundleDir, 'manifest.json'), 'utf8'),
      readFile(join(bundleDir, 'questions.jsonl')),
    ]);
    const { bundleVersion, alreadyImported, counts } = await this.importer.importBundle({
      manifestJson,
      questionsJsonl,
    });
    if (alreadyImported) {
      process.stdout.write(`${bundleVersion}: already imported, nothing changed\n`);
      return;
    }
    process.stdout.write(
      `${bundleVersion}: ${counts.inserted} new, ${counts.unchanged} unchanged, ${counts.reviewsRecorded} with new reviews, ` +
        `${counts.contentReplaced} replaced, ${counts.newVersions} new versions\n`,
    );
  }
}
