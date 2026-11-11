import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type BattleConfigJson = Record<string, unknown>;

/** A copy of config/battles.dev.json changed by `change`, written to a temp file; returns its path. */
export function writeBattleConfigFile(change: (config: BattleConfigJson) => void = () => undefined): string {
  const config = JSON.parse(readFileSync(join(process.cwd(), 'config/battles.dev.json'), 'utf8')) as BattleConfigJson;
  change(config);
  const path = join(mkdtempSync(join(tmpdir(), 'battles-')), 'battles.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}
