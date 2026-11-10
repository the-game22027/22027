"""Name normalization shared by the pipeline and the app (docs/architecture/07 §5.7).

The app normalizes what the user types with the same rules, so both sides must pass the
same test vectors (tests/test_normalize.py).
"""

import re
import unicodedata

_ARABIC_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭ]")
_TATWEEL = "ـ"
_ARABIC_LETTER_MAP = str.maketrans(
    {
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ة": "ه",
        "ى": "ي",
        "ؤ": "و",
        "ئ": "ي",
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9",
    }
)
_IGNORED_WORDS = {"fc", "cf", "club", "نادي"}
_SPACES = re.compile(r"\s+")


def normalize_name(text: str) -> str:
    """Return the display-independent form of a name: rules 1-3 of 07 §5.7."""
    text = unicodedata.normalize("NFKC", text).strip().lower()
    text = text.replace("ß", "ss")
    decomposed = unicodedata.normalize("NFD", text)
    without_latin_accents = "".join(
        char for char in decomposed if not (unicodedata.combining(char) and char < "؀")
    )
    text = unicodedata.normalize("NFC", without_latin_accents)
    text = _ARABIC_DIACRITICS.sub("", text).replace(_TATWEEL, "")
    text = text.translate(_ARABIC_LETTER_MAP)
    return _SPACES.sub(" ", text).strip()


def matching_form_of_name(text: str) -> str:
    """Return the form used for search matching: rule 4 of 07 §5.7 on top of normalize_name."""
    words = []
    for word in normalize_name(text).split(" "):
        if word in _IGNORED_WORDS:
            continue
        if word.startswith("ال") and len(word) > 3:
            word = word[2:]
        words.append(word)
    return " ".join(words)
