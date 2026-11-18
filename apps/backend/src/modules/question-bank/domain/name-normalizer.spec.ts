import { convertToMatchingForm, normalizeName } from './name-normalizer';

// The same vectors as data/tests/test_normalize.py (07 §5.7): both implementations must pass them.
const NORMALIZE_VECTORS: [string, string][] = [
  ['Álvaro Morata', 'alvaro morata'],
  ['أنخيل دي ماريا', 'انخيل دي ماريا'],
  ['كرة', 'كره'],
  ['مُحَمَّد صَلاح', 'محمد صلاح'],
  ['٢٠١٠', '2010'],
  ['  Thomas   Müller ', 'thomas muller'],
  ['Franz Beckenbauer ß', 'franz beckenbauer ss'],
  ['مـــصر', 'مصر'],
];

const MATCHING_VECTORS: [string, string][] = [
  ['الأهلي', 'اهلي'],
  ['Real Madrid CF', 'real madrid'],
  ['نادي الزمالك', 'زمالك'],
  ['ال', 'ال'],
];

describe('normalizeName', () => {
  it.each(NORMALIZE_VECTORS)('normalizes %s to %s', (raw, expected) => {
    expect(normalizeName(raw)).toBe(expected);
  });

  it('removes Arabic diacritics but keeps the letters', () => {
    expect(normalizeName('رُونَالْدُو')).toBe('رونالدو');
  });
});

describe('convertToMatchingForm', () => {
  it.each(MATCHING_VECTORS)('turns %s into %s', (raw, expected) => {
    expect(convertToMatchingForm(raw)).toBe(expected);
  });

  it('gives an empty form to blank text', () => {
    expect(convertToMatchingForm('  \u0640 ')).toBe('');
  });
});
