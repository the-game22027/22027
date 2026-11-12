/**
 * Name normalization of 07 §5.7, the same rules as the pipeline's `data/kb/normalize.py`: typed text is compared
 * with catalog forms the pipeline normalized, so both sides must pass the same test vectors.
 */

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ARABIC_LETTERS: Record<string, string> = {
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ٱ: 'ا',
  ة: 'ه',
  ى: 'ي',
  ؤ: 'و',
  ئ: 'ي',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};
const ARABIC_LETTER_PATTERN = new RegExp(`[${Object.keys(ARABIC_LETTERS).join('')}]`, 'g');
const COMBINING_MARK = /\p{M}/gu;
const IGNORED_WORDS = new Set(['fc', 'cf', 'club', 'نادي']);

/** Rules 1-3 of 07 §5.7: case, spaces, Latin accents, Arabic diacritics and letter variants. */
export function normalizeName(text: string): string {
  const lowered = text.normalize('NFKC').trim().toLowerCase().replaceAll('ß', 'ss');
  // Only marks on Latin (and other pre-Arabic) letters are accents; Arabic marks are handled below.
  const withoutAccents = lowered
    .normalize('NFD')
    .replace(COMBINING_MARK, (mark) => (mark < '\u0600' ? '' : mark))
    .normalize('NFC');
  return withoutAccents
    .replace(ARABIC_DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(ARABIC_LETTER_PATTERN, (letter) => ARABIC_LETTERS[letter])
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rule 4 on top of normalizeName: the form typed text and catalog forms are compared in. */
export function convertToMatchingForm(text: string): string {
  return normalizeName(text)
    .split(' ')
    .filter((word) => !IGNORED_WORDS.has(word))
    .map((word) => (word.startsWith('ال') && word.length > 3 ? word.slice(2) : word))
    .join(' ');
}
