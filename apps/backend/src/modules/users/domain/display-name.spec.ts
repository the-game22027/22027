import { chosenDisplayName, DISPLAY_NAME_MAX_LENGTH, displayNameFrom } from './display-name';
import { InvalidDisplayNameError } from './user-errors';

const suffix = () => 'a1b2';

describe('displayNameFrom', () => {
  it('uses the provider name, with whitespace collapsed', () => {
    expect(displayNameFrom('  Mohamed   Salah ', suffix)).toBe('Mohamed Salah');
  });

  it('falls back to a generated name when the provider gives none', () => {
    expect(displayNameFrom(undefined, suffix)).toBe('Player-a1b2');
    expect(displayNameFrom('   ', suffix)).toBe('Player-a1b2');
  });

  it('cuts long names without splitting characters', () => {
    const long = '⚽'.repeat(DISPLAY_NAME_MAX_LENGTH + 5);
    const name = displayNameFrom(long, suffix);
    expect([...name]).toHaveLength(DISPLAY_NAME_MAX_LENGTH);
    expect(name).toBe('⚽'.repeat(DISPLAY_NAME_MAX_LENGTH));
  });
});

describe('chosenDisplayName', () => {
  it('collapses whitespace', () => {
    expect(chosenDisplayName('  Mo   Salah ')).toBe('Mo Salah');
  });

  it('counts an emoji as one character', () => {
    const name = '⚽'.repeat(DISPLAY_NAME_MAX_LENGTH);
    expect(chosenDisplayName(name)).toBe(name);
  });

  it('rejects a blank or too long name', () => {
    expect(() => chosenDisplayName('   ')).toThrow(InvalidDisplayNameError);
    expect(() => chosenDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toThrow(InvalidDisplayNameError);
  });
});
