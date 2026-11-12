import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/name_normalization.dart';

/// The same vectors as `data/tests/test_normalize.py` and `docs/architecture/07` §5.7: the
/// Python pipeline and the app must agree on every one of them.
const _normalizeVectors = [
  ('Álvaro Morata', 'alvaro morata'),
  ('أنخيل دي ماريا', 'انخيل دي ماريا'),
  ('كرة', 'كره'),
  ('مُحَمَّد صَلاح', 'محمد صلاح'),
  ('٢٠١٠', '2010'),
  ('  Thomas   Müller ', 'thomas muller'),
  ('Franz Beckenbauer ß', 'franz beckenbauer ss'),
  ('مـــصر', 'مصر'),
];

const _matchingVectors = [
  ('الأهلي', 'اهلي'),
  ('Real Madrid CF', 'real madrid'),
  ('نادي الزمالك', 'زمالك'),
  ('ال', 'ال'),
];

void main() {
  for (final (raw, expected) in _normalizeVectors) {
    test('normalizeName("$raw") is "$expected"', () {
      expect(normalizeName(raw), expected);
    });
  }

  for (final (raw, expected) in _matchingVectors) {
    test('convertNameToMatchingForm("$raw") is "$expected"', () {
      expect(convertNameToMatchingForm(raw), expected);
    });
  }

  test('Arabic diacritics are removed but letters are kept', () {
    expect(normalizeName('رُونَالْدُو'), normalizeName('رونالدو'));
  });

  test('full-width Latin letters become plain ones (NFKC)', () {
    expect(normalizeName('ＭＥＳＳＩ'), 'messi');
  });
}
