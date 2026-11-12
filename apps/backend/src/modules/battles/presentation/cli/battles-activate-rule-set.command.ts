import { readFile } from 'node:fs/promises';
import { Command, CommandRunner } from 'nest-commander';
import { z } from 'zod';
import { AppConfig } from '@shared/infrastructure/config';
import { ActivateBattleRuleSet } from '../../application/battle-points-rule-set';

const ruleSetFile = z.strictObject({ devOnly: z.boolean(), name: z.string().min(1), config: z.unknown() });

@Command({
  name: 'battles:activate-rule-set',
  arguments: '<file>',
  description: 'Activate a BATTLE scoring rule set: the leaderboard points of every battle created after it (08 §6.1)',
})
export class BattlesActivateRuleSetCommand extends CommandRunner {
  constructor(
    private readonly activation: ActivateBattleRuleSet,
    private readonly config: AppConfig,
  ) {
    super();
  }

  async run([file]: string[]): Promise<void> {
    const { devOnly, name, config } = ruleSetFile.parse(JSON.parse(await readFile(file, 'utf8')));
    if (devOnly && this.config.isProduction) {
      throw new Error(`${file} holds placeholder values ("devOnly": true); production needs reviewed values (DEC-33)`);
    }
    const { version, activated } = await this.activation.activateBattleRuleSet(name, config, 'cli');
    process.stdout.write(
      activated
        ? `BATTLE rule set version ${String(version)} is now active\n`
        : `BATTLE rule set version ${String(version)} already has this config, nothing changed\n`,
    );
  }
}
