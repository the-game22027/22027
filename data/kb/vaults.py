"""VAULT (الخزنة) rounds: 4 questions whose answers are digits 0-9 (08 §12.4). Pure: no I/O here."""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.auctions import shorten_team_names
from kb.generate import LICENSES, SOURCES, Names

TEAM_GOALS = "TEAM_GOALS"
FINAL_TOTAL_GOALS = "FINAL_TOTAL_GOALS"
PLAYER_GOALS = "PLAYER_GOALS"
SHOOTOUT_SCORED = "SHOOTOUT_SCORED"
SHIRT_NUMBER = "SHIRT_NUMBER"
TITLES_SINCE_2000 = "TITLES_SINCE_2000"

DIGITS = 4
LARGEST_DIGIT = 9
FINAL = "FINAL"
KNOCKOUT_STAGES = ("ROUND_OF_16", "QUARTER_FINAL", "SEMI_FINAL", FINAL)
# A final is the best-known match of a competition season, a round of 16 the least.
DIFFICULTY_BY_STAGE = {FINAL: 1, "SEMI_FINAL": 2, "QUARTER_FINAL": 3, "ROUND_OF_16": 4}
EXTRA_DIFFICULTY_BY_TEMPLATE = {SHOOTOUT_SCORED: 1, SHIRT_NUMBER: 1}
TITLES_DIFFICULTY = 2
WELL_KNOWN_PLAYER_SITELINKS = 80
TITLES_FROM_YEAR = 2000
# A competition's title count is trusted only when its covered editions start this early.
TITLES_COVERAGE_MUST_START_BY = 2004

STAGE_NAMES = {
    FINAL: {"en": "final", "ar": "نهائي"},
    "SEMI_FINAL": {"en": "semi-final", "ar": "نصف نهائي"},
    "QUARTER_FINAL": {"en": "quarter-final", "ar": "ربع نهائي"},
    "ROUND_OF_16": {"en": "round of 16", "ar": "دور الـ16"},
}
LEG_NAMES = {1: {"en": "first leg of the ", "ar": "ذهاب "}, 2: {"en": "second leg of the ", "ar": "إياب "}}

QUESTION_TEMPLATES = {
    TEAM_GOALS: {
        "en": "How many goals did {team} score against {opponent} in the {stage} of the {season} {competition}?",
        "ar": "كم هدفًا سجل {team} في مرمى {opponent} في {stage} {competition} {season}؟",
    },
    FINAL_TOTAL_GOALS: {
        "en": "How many goals were scored in the {season} {competition} final, not counting the shootout?",
        "ar": "كم هدفًا سُجل في نهائي {competition} {season} دون احتساب ركلات الترجيح؟",
    },
    PLAYER_GOALS: {
        "en": "How many goals did {player} score against {opponent} in the {stage} of the {season} {competition}?",
        "ar": "كم هدفًا سجل {player} في مرمى {opponent} في {stage} {competition} {season}؟",
    },
    SHOOTOUT_SCORED: {
        "en": "How many penalties did {team} score in the shootout of the {stage} of the {season} {competition}?",
        "ar": "كم ركلة ترجيح سجل {team} في {stage} {competition} {season}؟",
    },
    SHIRT_NUMBER: {
        "en": "Which shirt number did {player} wear for {team} in the {stage} of the {season} {competition}?",
        "ar": "بأي رقم قميص لعب {player} مع {team} في {stage} {competition} {season}؟",
    },
    TITLES_SINCE_2000: {
        "en": "How many {competition} titles have {team} won since 2000?",
        "ar": "كم مرة فاز {team} بلقب {competition} منذ 2000؟",
    },
}


@dataclass(frozen=True)
class VaultMatch:
    match_id: int
    competition_key: str
    competition_names: Names
    competition_kind: str
    tier: int
    season_label: str
    final_year: int
    stage: str
    leg: int | None
    home_ref: str
    away_ref: str
    home_goals: int
    away_goals: int
    shootout_home: int | None
    shootout_away: int | None
    shootout_winner_ref: str | None
    goals_complete: bool  # the match's goal rows add up to its score


@dataclass(frozen=True)
class VaultFact:
    template: str
    key: str
    # Facts of one vault come from different groups (a match, or a competition's title table), so one fact
    # never gives another away.
    group: str
    text: Names
    answer: int
    difficulty: int


def vault_facts(
    matches: Iterable[VaultMatch],
    player_goals: Iterable[tuple[int, str, str, int]],
    shirts: Iterable[tuple[int, str, str, int]],
    covered_editions: Iterable[tuple[str, int, bool]],
    team_names_of: Callable[[str], Names | None],
    player_names_of: Callable[[str], Names | None],
    player_popularity_of: Callable[[str], int | None],
    *,
    min_player_sitelinks: int = 40,
) -> list[VaultFact]:
    """Every fact a vault can use, sorted by key.

    `player_goals` rows are (match_id, team_ref, scorer_ref, goals); `shirts` rows (match_id, team_ref,
    player_ref, shirt_number) of starters; `covered_editions` rows (competition_key, final_year, has_final)
    of international competitions. Players must be catalog players with `min_player_sitelinks`.
    """
    usable = {match.match_id: match for match in matches if _is_vault_match(match)}
    facts: list[VaultFact] = []
    for match in usable.values():
        facts += _match_facts(match, team_names_of)

    def known_player(ref: str) -> Names | None:
        popularity = player_popularity_of(ref)
        if popularity is None or popularity < min_player_sitelinks:
            return None
        return player_names_of(ref)

    for match_id, team_ref, scorer_ref, goals in player_goals:
        match = usable.get(match_id)
        if not match or not match.goals_complete or not 2 <= goals <= LARGEST_DIGIT:
            continue
        names = _match_names(match, team_ref, team_names_of)
        player = known_player(scorer_ref)
        if names and player:
            facts.append(
                _fact(
                    PLAYER_GOALS, match, goals, {**names, "player": player}, scorer_ref, player_popularity_of
                )
            )

    best_shirt: dict[tuple[str, str, int], tuple[VaultMatch, Names]] = {}
    for match_id, team_ref, player_ref, number in shirts:
        match = usable.get(match_id)
        if not match or not 1 <= number <= LARGEST_DIGIT:
            continue
        names = _match_names(match, team_ref, team_names_of)
        player = known_player(player_ref)
        if not names or not player:
            continue
        # One fact per player, team and number (D.3e `player_shirt`): the best-known match that shows it.
        key = (player_ref, team_ref, number)
        current = best_shirt.get(key)
        if current is None or _match_order(match) < _match_order(current[0]):
            best_shirt[key] = (match, {**names, "player": player})
    for (player_ref, _, number), (match, names) in best_shirt.items():
        facts.append(_fact(SHIRT_NUMBER, match, number, names, player_ref, player_popularity_of))

    facts += _title_facts(usable.values(), covered_editions, team_names_of)
    return sorted(facts, key=lambda fact: fact.key)


def vault_rounds(
    facts: Iterable[VaultFact], kb_version: str, *, count: int, max_per_template: int = 2
) -> list[dict]:
    """Up to `count` vaults of 4 facts, spread over difficulties. Facts of one vault share a difficulty, come
    from different groups, and repeat a template at most `max_per_template` times. Deterministic."""
    by_difficulty: dict[int, list[VaultFact]] = defaultdict(list)
    for fact in facts:
        by_difficulty[fact.difficulty].append(fact)
    queues = [
        _build_vaults(group, max_per_template)
        for _, group in sorted(by_difficulty.items())
        if len(group) >= DIGITS
    ]
    picked: list[dict] = []
    while len(picked) < count and any(queues):
        for queue in queues:
            if queue and len(picked) < count:
                picked.append(_vault_line(queue.pop(0), kb_version))
    return picked


def _build_vaults(facts: list[VaultFact], max_per_template: int) -> list[list[VaultFact]]:
    """Take facts template by template, the template with the most facts left first, so small templates are
    spread over many vaults instead of used up together."""
    queues: dict[str, list[VaultFact]] = defaultdict(list)
    for fact in sorted(facts, key=lambda fact: fact.key):
        queues[fact.template].append(fact)
    vaults = []
    while True:
        vault: list[VaultFact] = []
        for template in sorted(queues, key=lambda name: (-len(queues[name]), name)):
            while len(vault) < DIGITS and sum(fact.template == template for fact in vault) < max_per_template:
                fact = next((f for f in queues[template] if all(f.group != v.group for v in vault)), None)
                if fact is None:
                    break
                queues[template].remove(fact)
                vault.append(fact)
            if len(vault) == DIGITS:
                break
        if len(vault) < DIGITS:
            return vaults
        vaults.append(vault)


def _is_vault_match(match: VaultMatch) -> bool:
    if match.stage == FINAL:
        return True
    return match.tier == 1 and match.stage in KNOCKOUT_STAGES


def _match_facts(match: VaultMatch, team_names_of: Callable[[str], Names | None]) -> list[VaultFact]:
    facts = []
    for team_ref, goals, shootout in (
        (match.home_ref, match.home_goals, match.shootout_home),
        (match.away_ref, match.away_goals, match.shootout_away),
    ):
        names = _match_names(match, team_ref, team_names_of)
        if not names:
            continue
        if goals <= LARGEST_DIGIT:
            facts.append(_fact(TEAM_GOALS, match, goals, names, _qid(team_ref)))
        if shootout is not None and shootout <= LARGEST_DIGIT:
            facts.append(_fact(SHOOTOUT_SCORED, match, shootout, names, _qid(team_ref)))
    total = match.home_goals + match.away_goals
    if match.stage == FINAL and total <= LARGEST_DIGIT and match.leg is None:
        names = _match_names(match, match.home_ref, team_names_of)
        if names:
            facts.append(_fact(FINAL_TOTAL_GOALS, match, total, names, ""))
    return facts


def _title_facts(
    matches: Iterable[VaultMatch],
    covered_editions: Iterable[tuple[str, int, bool]],
    team_names_of: Callable[[str], Names | None],
) -> list[VaultFact]:
    editions: dict[str, list[tuple[int, bool]]] = defaultdict(list)
    for competition_key, final_year, has_final in covered_editions:
        if final_year >= TITLES_FROM_YEAR:
            editions[competition_key].append((final_year, has_final))
    complete = {
        key
        for key, rows in editions.items()
        if all(has_final for _, has_final in rows)
        and min(year for year, _ in rows) <= TITLES_COVERAGE_MUST_START_BY
    }
    titles: dict[tuple[str, str], int] = defaultdict(int)
    competition_names: dict[str, Names] = {}
    for match in matches:
        if (
            match.stage != FINAL
            or match.competition_key not in complete
            or match.final_year < TITLES_FROM_YEAR
        ):
            continue
        competition_names[match.competition_key] = match.competition_names
        winner = _winner_of(match)
        for team_ref in (match.home_ref, match.away_ref):
            titles[(match.competition_key, team_ref)] += team_ref == winner
    facts = []
    for (competition_key, team_ref), count in sorted(titles.items()):
        team = team_names_of(team_ref)
        if team is None or count > LARGEST_DIGIT:
            continue
        text = _render(
            TITLES_SINCE_2000,
            {"team": shorten_team_names(team), "competition": competition_names[competition_key]},
        )
        facts.append(
            VaultFact(
                TITLES_SINCE_2000,
                f"vault:{TITLES_SINCE_2000}:{_qid(team_ref)}:{competition_key}",
                f"titles:{competition_key}",
                text,
                count,
                TITLES_DIFFICULTY,
            )
        )
    return facts


def _winner_of(match: VaultMatch) -> str | None:
    if match.home_goals != match.away_goals:
        return match.home_ref if match.home_goals > match.away_goals else match.away_ref
    return match.shootout_winner_ref


def _match_names(
    match: VaultMatch, team_ref: str, team_names_of: Callable[[str], Names | None]
) -> dict[str, Names] | None:
    opponent_ref = match.away_ref if team_ref == match.home_ref else match.home_ref
    team, opponent = team_names_of(team_ref), team_names_of(opponent_ref)
    if team is None or opponent is None:
        return None
    stage = STAGE_NAMES[match.stage]
    leg = LEG_NAMES.get(match.leg, {"en": "", "ar": ""})
    return {
        "team": shorten_team_names(team),
        "opponent": shorten_team_names(opponent),
        "stage": {locale: leg[locale] + stage[locale] for locale in ("en", "ar")},
        "season": {"en": match.season_label, "ar": match.season_label},
        "competition": match.competition_names,
    }


def _fact(
    template: str,
    match: VaultMatch,
    answer: int,
    names: dict[str, Names],
    subject: str,
    player_popularity_of: Callable[[str], int | None] | None = None,
) -> VaultFact:
    difficulty = (
        DIFFICULTY_BY_STAGE[match.stage] + (match.tier - 1) + EXTRA_DIFFICULTY_BY_TEMPLATE.get(template, 0)
    )
    if (
        player_popularity_of is not None
        and (player_popularity_of(subject) or 0) < WELL_KNOWN_PLAYER_SITELINKS
    ):
        difficulty += 1
    suffix = f":{_qid(subject)}" if subject else ""
    return VaultFact(
        template,
        f"vault:{template}:{match.match_id}{suffix}",
        f"match:{match.match_id}",
        _render(template, names),
        answer,
        min(5, difficulty),
    )


def _render(template: str, names: dict[str, Names]) -> Names:
    return {
        locale: QUESTION_TEMPLATES[template][locale].format(
            **{part: value[locale] for part, value in names.items()}
        )
        for locale in ("en", "ar")
    }


def _match_order(match: VaultMatch) -> tuple[int, int, int]:
    return (DIFFICULTY_BY_STAGE[match.stage], match.tier, match.match_id)


def _vault_line(vault: list[VaultFact], kb_version: str) -> dict:
    return {
        "externalKey": "vault:" + "+".join(fact.key.removeprefix("vault:") for fact in vault),
        "type": "GAME",
        "gameType": "VAULT",
        "category": "vaults",
        "difficulty": round(sum(fact.difficulty for fact in vault) / len(vault)),
        "content": {
            "questions": [
                {"template": fact.template, "text": fact.text, "answerNumber": fact.answer} for fact in vault
            ]
        },
        "answers": [],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        # Title counts change after a final; every bundle is regenerated (DEC-62), past matches never change.
        "validUntil": None,
        "humanReviewed": {"en": False, "ar": False},
    }


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")
