export const DISPLAY_NAME_MAX_LENGTH = 40;

export function displayNameFrom(hint: string | undefined, randomSuffix: () => string): string {
  const cleaned = (hint ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return `Player-${randomSuffix()}`;
  // Slice by code points so an emoji is never cut in half.
  return [...cleaned].slice(0, DISPLAY_NAME_MAX_LENGTH).join('').trim();
}
