import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type LeaderboardConfigJson = Record<string, unknown>;

/** A copy of config/leaderboards.dev.json changed by `change`, written to a temp file; returns its path. */
export function writeLeaderboardConfigFile(change: (config: LeaderboardConfigJson) => void = () => undefined): string {
  const config = JSON.parse(
    readFileSync(join(process.cwd(), 'config/leaderboards.dev.json'), 'utf8'),
  ) as LeaderboardConfigJson;
  change(config);
  const path = join(mkdtempSync(join(tmpdir(), 'leaderboards-')), 'leaderboards.json');
  writeFileSync(path, JSON.stringify(config));
  return path;
}
