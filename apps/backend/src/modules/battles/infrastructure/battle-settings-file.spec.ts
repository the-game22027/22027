import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InvalidBattleSettingsError, loadBattleSettingsFile } from './battle-settings-file';

const DEV_FILE = join(process.cwd(), 'config/battles.dev.json');

const writeVariant = (change: (json: Record<string, unknown>) => void): string => {
  const json = JSON.parse(readFileSync(DEV_FILE, 'utf8')) as Record<string, unknown>;
  change(json);
  const path = join(mkdtempSync(join(tmpdir(), 'battles-')), 'battles.json');
  writeFileSync(path, JSON.stringify(json));
  return path;
};

describe('the battle config file', () => {
  it('loads the shipped development file', () => {
    const settings = loadBattleSettingsFile(DEV_FILE, false);
    expect(settings.devOnly).toBe(true);
    expect(settings.gameTypes.BUZZER?.roundCount).toBeGreaterThan(0);
  });

  it('refuses placeholder values in production', () => {
    expect(() => loadBattleSettingsFile(DEV_FILE, true)).toThrow('devOnly');
  });

  it('names the exact problem in an invalid file', () => {
    const path = writeVariant((json) => {
      (json.engine as Record<string, unknown>).readyTimeoutMs = -1;
    });
    expect(() => loadBattleSettingsFile(path, false)).toThrow(InvalidBattleSettingsError);
    expect(() => loadBattleSettingsFile(path, false)).toThrow('engine.readyTimeoutMs');
  });

  it('refuses unknown keys, so a typo cannot silently fall back to nothing', () => {
    const path = writeVariant((json) => {
      json.matchmakng = {};
    });
    expect(() => loadBattleSettingsFile(path, false)).toThrow('matchmakng');
  });
});
