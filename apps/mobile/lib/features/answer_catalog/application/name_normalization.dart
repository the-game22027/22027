import 'package:unorm_dart/unorm_dart.dart' as unorm;

/// Name normalization shared with the data pipeline (`docs/architecture/07` §5.7,
/// `data/kb/normalize.py`). The catalog already stores the matching form of every name; the
/// app applies the same rules only to what the player types. Both sides pass the same test
/// vectors (`data/tests/test_normalize.py`, `test/features/answer_catalog/`).

/// Arabic harakat, Quranic marks and the superscript alef.
final _arabicDiacritics = RegExp(
  '[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]',
);
const _tatweel = '\u0640';
const _arabicLetterReplacements = {
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ة': 'ه',
  'ى': 'ي',
  'ؤ': 'و',
  'ئ': 'ي',
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
const _wordsIgnoredForMatching = {'fc', 'cf', 'club', 'نادي'};
final _spaces = RegExp(r'\s+');
final _combiningMarks = RegExp(r'\p{Mn}', unicode: true);

/// Rules 1-3: NFKC, trim, lower case; Latin accents removed, `ß → ss`; Arabic diacritics and
/// tatweel removed, letter variants unified, Arabic-Indic digits to ASCII.
String normalizeName(String text) {
  var normalized = unorm.nfkc(text).trim().toLowerCase().replaceAll('ß', 'ss');
  // Accents are combining marks after decomposition. Only Latin-range marks (below the
  // Arabic block) go here; Arabic marks follow their own rule below.
  normalized = unorm.nfc(
    unorm
        .nfd(normalized)
        .replaceAllMapped(
          _combiningMarks,
          (match) => match[0]!.codeUnitAt(0) < 0x0600 ? '' : match[0]!,
        ),
  );
  normalized = normalized
      .replaceAll(_arabicDiacritics, '')
      .replaceAll(_tatweel, '');
  normalized = normalized.split('').map((character) {
    return _arabicLetterReplacements[character] ?? character;
  }).join();
  return normalized.replaceAll(_spaces, ' ').trim();
}

/// Rule 4 on top of [normalizeName]: drops `fc` / `cf` / `club` / `نادي` and a leading `ال`
/// on words longer than three letters. This is the form stored in the catalog's `search`.
String convertNameToMatchingForm(String text) => normalizeName(text)
    .split(' ')
    .where((word) => !_wordsIgnoredForMatching.contains(word))
    .map(
      (word) =>
          word.startsWith('ال') && word.length > 3 ? word.substring(2) : word,
    )
    .join(' ');
