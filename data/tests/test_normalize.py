import pytest

from kb.normalize import matching_form_of_name, normalize_name

# The same vectors are listed in docs/architecture/07 §5.7; the app's implementation must pass them too.
NORMALIZE_VECTORS = [
    ("Álvaro Morata", "alvaro morata"),
    ("أنخيل دي ماريا", "انخيل دي ماريا"),
    ("كرة", "كره"),
    ("مُحَمَّد صَلاح", "محمد صلاح"),
    ("٢٠١٠", "2010"),
    ("  Thomas   Müller ", "thomas muller"),
    ("Franz Beckenbauer ß", "franz beckenbauer ss"),
    ("مـــصر", "مصر"),
]

MATCHING_VECTORS = [
    ("الأهلي", "اهلي"),
    ("Real Madrid CF", "real madrid"),
    ("نادي الزمالك", "زمالك"),
    ("ال", "ال"),
]


@pytest.mark.parametrize(("raw", "expected"), NORMALIZE_VECTORS)
def test_normalize_name_matches_shared_vectors(raw: str, expected: str) -> None:
    assert normalize_name(raw) == expected


@pytest.mark.parametrize(("raw", "expected"), MATCHING_VECTORS)
def test_matching_form_drops_article_and_club_words(raw: str, expected: str) -> None:
    assert matching_form_of_name(raw) == expected


def test_arabic_diacritics_are_removed_but_letters_kept() -> None:
    assert normalize_name("رونالدو") == normalize_name("رُونَالْدُو")
