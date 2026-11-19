"""HEX (الهجمة) boards: a letter pair per cell and lists whose names start with it (08 §13.5). Pure: no I/O."""

import hashlib
import re
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.auctions import KNOWN_PLAYER_MIN_SITELINKS, GoalList, eligible_goal_lists, title_of
from kb.generate import LICENSES, SOURCES, Names
from kb.normalize import matching_form_of_name

LOCALES = ("en", "ar")
# A letter counts in a language only in its own alphabet: an Arabic alias written in Latin letters says
# nothing about Arabic first letters.
ALPHABETS = {"en": re.compile(r"[a-z]"), "ar": re.compile(r"[ء-ي]")}
# Share of known right names → difficulty, as for AUCTION lists.
DIFFICULTY_BY_KNOWN_SHARE = ((0.9, 1), (0.8, 2), (0.7, 3), (0.5, 4), (0.0, 5))


@dataclass(frozen=True)
class LetterList:
    """A list a board can ask, with its right names grouped by the first letter of their name forms."""

    goal_list: GoalList
    team_names: Names
    names_by_letter: dict[str, dict[str, frozenset[str]]]  # locale → letter → entity refs


def first_letters_of(name_forms: Iterable[str], locale: str) -> set[str]:
    """First letters, in matching form, of the name forms that start with a letter of the locale's alphabet."""
    letters = set()
    for form in name_forms:
        matching = matching_form_of_name(form)
        if matching and ALPHABETS[locale].fullmatch(matching[0]):
            letters.add(matching[0])
    return letters


def letter_lists(
    goal_lists: Iterable[GoalList],
    player_popularity_of: Callable[[str], int | None],
    team_names_of: Callable[[str], Names | None],
    name_forms_of: Callable[[str, str], list[str]],
    *,
    min_answers: int = 6,
    max_answers: int = 30,
    known_share: float = 0.6,
) -> list[LetterList]:
    """The AUCTION lists (08 §11.4) with each name filed under the first letters of its forms, per language."""
    result = []
    for goal_list, team_names, _ in eligible_goal_lists(
        goal_lists,
        player_popularity_of,
        team_names_of,
        min_answers=min_answers,
        max_answers=max_answers,
        known_share=known_share,
    ):
        by_letter: dict[str, dict[str, set[str]]] = {locale: defaultdict(set) for locale in LOCALES}
        for ref in goal_list.answers:
            for locale in LOCALES:
                for letter in first_letters_of(name_forms_of(ref, locale), locale):
                    by_letter[locale][letter].add(ref)
        result.append(
            LetterList(
                goal_list,
                team_names,
                {
                    locale: {letter: frozenset(refs) for letter, refs in by_letter[locale].items()}
                    for locale in LOCALES
                },
            )
        )
    return result


def hex_rounds(
    lists: list[LetterList],
    player_popularity_of: Callable[[str], int | None],
    kb_version: str,
    *,
    count: int,
    size: int = 5,
    questions_per_cell: int = 3,
    min_answers_per_letter: int = 1,
    min_lists_per_letter: int = 20,
    max_letter_repeats: int = 2,
) -> list[dict]:
    """Up to `count` boards. Deterministic: board `n` rotates the letter pairs by `n`, and each cell takes the
    lists used least so far (ties by key), so the boards spread over all lists."""
    letters = {locale: _usable_letters(lists, locale, min_lists_per_letter) for locale in LOCALES}
    cells = size * size
    sequences = {locale: _letter_sequence(letters[locale], cells, max_letter_repeats) for locale in LOCALES}
    if any(sequence is None for sequence in sequences.values()):
        return []
    uses: Counter[str] = Counter()
    boards = []
    for board_no in range(count * 3):
        if len(boards) == count:
            break
        pairs = _letter_pairs(sequences["ar"], sequences["en"], board_no)
        board = _fill_board(pairs, lists, uses, questions_per_cell, min_answers_per_letter)
        if board is None:
            continue
        for _, picked in board:
            uses.update(item.goal_list.key for item in picked)
        boards.append(_hex_line(board, size, player_popularity_of, kb_version))
    return boards


def _usable_letters(lists: list[LetterList], locale: str, min_lists: int) -> list[str]:
    """Letters that start a name in at least `min_lists` lists, most common first (ties by letter)."""
    counts = Counter(letter for item in lists for letter in item.names_by_letter[locale])
    return [
        letter
        for letter, number in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
        if number >= min_lists
    ]


def _letter_sequence(letters: list[str], cells: int, max_repeats: int) -> list[str] | None:
    """Every usable letter once, then the most common ones again, up to `max_repeats` each; None if too few."""
    sequence = list(letters) * max_repeats
    return sequence[:cells] if len(sequence) >= cells else None


def _letter_pairs(arabic: list[str], english: list[str], board_no: int) -> list[dict[str, str]]:
    shift = board_no % len(english)
    english_rotated = english[shift:] + english[:shift]
    pairs = [{"ar": ar, "en": en} for ar, en in zip(arabic, english_rotated, strict=True)]
    # Spread the common letters over the board: a fixed per-board permutation, the same on every run.
    return sorted(
        pairs, key=lambda pair: hashlib.sha1(f"{board_no}:{pair['ar']}:{pair['en']}".encode()).hexdigest()
    )


def _fill_board(
    pairs: list[dict[str, str]],
    lists: list[LetterList],
    uses: Counter[str],
    questions_per_cell: int,
    min_answers_per_letter: int,
) -> list[tuple[dict[str, str], list[LetterList]]] | None:
    used_in_board: set[str] = set()
    board = []
    for pair in pairs:
        fitting = [
            item
            for item in lists
            if item.goal_list.key not in used_in_board
            and all(
                len(item.names_by_letter[locale].get(pair[locale], ())) >= min_answers_per_letter
                for locale in LOCALES
            )
        ]
        if len(fitting) < questions_per_cell:
            return None
        picked = sorted(fitting, key=lambda item: (uses[item.goal_list.key], item.goal_list.key))[
            :questions_per_cell
        ]
        used_in_board.update(item.goal_list.key for item in picked)
        board.append((pair, picked))
    return board


def _difficulty_of_cell(
    pair: dict[str, str], picked: list[LetterList], popularity_of: Callable[[str], int | None]
) -> int:
    right = {
        ref
        for item in picked
        for locale in LOCALES
        for ref in item.names_by_letter[locale].get(pair[locale], ())
    }
    known = sum(1 for ref in right if (popularity_of(ref) or 0) >= KNOWN_PLAYER_MIN_SITELINKS)
    share = known / len(right) if right else 0.0
    return next(level for minimum, level in DIFFICULTY_BY_KNOWN_SHARE if share >= minimum)


def _hex_line(
    board: list[tuple[dict[str, str], list[LetterList]]],
    size: int,
    popularity_of: Callable[[str], int | None],
    kb_version: str,
) -> dict:
    signature = "|".join(
        f"{pair['ar']}{pair['en']}:" + ",".join(item.goal_list.key for item in picked)
        for pair, picked in board
    )
    answers = []
    for cell, (_, picked) in enumerate(board):
        for question, item in enumerate(picked):
            answers.append(
                {
                    "slot": cell * len(picked) + question,
                    "entities": sorted(
                        item.goal_list.answers, key=lambda ref: (-(popularity_of(ref) or 0), ref)
                    ),
                }
            )
    difficulties = [_difficulty_of_cell(pair, picked, popularity_of) for pair, picked in board]
    return {
        "externalKey": "hex:" + hashlib.sha1(signature.encode()).hexdigest()[:20],
        "type": "GAME",
        "gameType": "HEX",
        "category": "hexes",
        "difficulty": round(sum(difficulties) / len(difficulties)),
        "content": {
            "size": size,
            "cells": [
                {
                    "letter": dict(pair),
                    "questions": [
                        {"kind": item.goal_list.kind, "title": title_of(item.goal_list, item.team_names)}
                        for item in picked
                    ],
                }
                for pair, picked in board
            ],
        },
        "answers": answers,
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        "validUntil": None,  # past seasons do not change
        "humanReviewed": {"en": False, "ar": False},
    }
