import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command, CommandRunner } from 'nest-commander';
import { ImportQuestionBundle } from '../../application/import-question-bundle';

const readFileIfPresent = async (path: string): Promise<Buffer | undefined> => {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
};

@Command({
  name: 'questions:import',
  arguments: '<bundleDir>',
  description:
    'Import a bundle: a folder with manifest.json, questions.jsonl and optionally catalog.jsonl, links.jsonl and link-matches.jsonl',
})
export class QuestionsImportCommand extends CommandRunner {
  constructor(private readonly importer: ImportQuestionBundle) {
    super();
  }

  async run([bundleDir]: string[]): Promise<void> {
    const [manifestJson, questionsJsonl, catalogJsonl, linksJsonl, linkMatchesJsonl] = await Promise.all([
      readFile(join(bundleDir, 'manifest.json'), 'utf8'),
      readFile(join(bundleDir, 'questions.jsonl')),
      readFileIfPresent(join(bundleDir, 'catalog.jsonl')),
      readFileIfPresent(join(bundleDir, 'links.jsonl')),
      readFileIfPresent(join(bundleDir, 'link-matches.jsonl')),
    ]);
    const { bundleVersion, alreadyImported, counts, catalogSize, linkCount } = await this.importer.importBundle({
      manifestJson,
      questionsJsonl,
      catalogJsonl,
      linksJsonl,
      linkMatchesJsonl,
    });
    if (alreadyImported) {
      process.stdout.write(`${bundleVersion}: already imported, nothing changed\n`);
      return;
    }
    const catalog = catalogSize === null ? '' : `catalog: ${catalogSize} entities; `;
    const graph = linkCount === null ? '' : `link graph: ${linkCount} links; `;
    process.stdout.write(
      `${bundleVersion}: ${catalog}${graph}${counts.inserted} new, ${counts.unchanged} unchanged, ` +
        `${counts.reviewsRecorded} with new reviews, ${counts.contentReplaced} replaced, ${counts.newVersions} new versions\n`,
    );
  }
}
