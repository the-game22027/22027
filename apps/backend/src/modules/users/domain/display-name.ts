import { InvalidDisplayNameError } from './user-errors';

export const DISPLAY_NAME_MAX_LENGTH = 40;

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export function displayNameFrom(hint: string | undefined, randomSuffix: () => string): string {
  const cleaned = collapseWhitespace(hint ?? '');
  if (cleaned.length === 0) return `Player-${randomSuffix()}`;
  // Slice by code points so an emoji is never cut in half.
  return [...cleaned].slice(0, DISPLAY_NAME_MAX_LENGTH).join('').trim();
}

export function chosenDisplayName(value: string): string {
  const cleaned = collapseWhitespace(value);
  if (cleaned.length === 0 || [...cleaned].length > DISPLAY_NAME_MAX_LENGTH) throw new InvalidDisplayNameError();
  return cleaned;
}
