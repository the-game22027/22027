"""THREAD (الخيط) content: five rooms on one chain of facts, one answer per room (08 §17.4). Pure: no I/O.

A thread starts from a named final and walks hop by hop: the winner, the team they faced, a scorer, who set the
goal up, the captain, a team a player scored against in another named final, a player's country. Every hop names
its match or stays in the current one, so no question claims "ever" outside our data, and every room has exactly
one answer given the room before it.
"""

import hashlib
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.generate import LICENSES, SOURCES, Names
from kb.links import LinkMatch
from kb.vaults import FINAL

FINAL_WINNER = "FINAL_WINNER"
FINAL_OPPONENT = "FINAL_OPPONENT"
FIRST_SCORER = "FIRST_SCORER"
LAST_SCORER = "LAST_SCORER"
ASSIST = "ASSIST"
CAPTAIN = "CAPTAIN"
SCORED_IN_FINAL_AGAINST = "SCORED_IN_FINAL_AGAINST"
NATIONALITY = "NATIONALITY"
# The order hops are tried in, so the walk and its output are deterministic.
HOP_ORDER = (FINAL_OPPONENT, FIRST_SCORER, LAST_SCORER, ASSIST, CAPTAIN, SCORED_IN_FINAL_AGAINST, NATIONALITY)

DEFAULT_ROOMS = 5
DEFAULT_MIN_PLAYER_SITELINKS = 30
DEFAULT_THREADS_PER_FINAL = 3
# The least known player of a thread → difficulty: one unknown name is enough to stop you.
DIFFICULTY_BY_LEAST_KNOWN = ((80, 1), (60, 2), (45, 3), (35, 4), (0, 5))

# Question forms: a room's question about the answer before it (`{final}` is the named final).
QUESTIONS = {
    FINAL_WINNER: {"en": "Who won the {final} final?", "ar": "من فاز بنهائي {final}؟"},
    FINAL_OPPONENT: {"en": "Who did they face in that final?", "ar": "من واجههم في ذلك النهائي؟"},
    FIRST_SCORER: {
        "en": "Who scored their first goal in that final?",
        "ar": "من سجّل أول أهدافهم في ذلك النهائي؟",
    },
    LAST_SCORER: {
        "en": "Who scored their last goal in that final?",
        "ar": "من سجّل آخر أهدافهم في ذلك النهائي؟",
    },
    ASSIST: {"en": "Who set up that goal?", "ar": "من صنع ذلك الهدف؟"},
    CAPTAIN: {"en": "Who captained them in that final?", "ar": "من كان قائدهم في ذلك النهائي؟"},
    SCORED_IN_FINAL_AGAINST: {
        "en": "Which team did he score against in the {final} final?",
        "ar": "ضد أي فريق سجّل في نهائي {final}؟",
    },
    NATIONALITY: {"en": "Which country is he from?", "ar": "ما جنسيته؟"},
}
# Noun forms: the answer of a room described from the room before it, the subject of a jump question.
NOUNS = {
    FINAL_WINNER: {"en": "the winner of the {final} final", "ar": "الفائز بنهائي {final}"},
    FINAL_OPPONENT: {"en": "the team they faced in that final", "ar": "الفريق الذي واجههم في ذلك النهائي"},
    FIRST_SCORER: {
        "en": "the scorer of their first goal in that final",
        "ar": "مسجّل أول أهدافهم في ذلك النهائي",
    },
    LAST_SCORER: {
        "en": "the scorer of their last goal in that final",
        "ar": "مسجّل آخر أهدافهم في ذلك النهائي",
    },
    ASSIST: {"en": "the player who set up that goal", "ar": "اللاعب الذي صنع ذلك الهدف"},
    CAPTAIN: {"en": "their captain in that final", "ar": "قائدهم في ذلك النهائي"},
    SCORED_IN_FINAL_AGAINST: {
        "en": "the team he scored against in the {final} final",
        "ar": "الفريق الذي سجّل ضده في نهائي {final}",
    },
}
# Jump forms: a room's question with the room before it folded in as `{subject}` (08 §17.1 step 5).
JUMPS = {
    FINAL_OPPONENT: {"en": "Who did {subject} face?", "ar": "من واجه {subject}؟"},
    FIRST_SCORER: {"en": "Who scored the first goal for {subject}?", "ar": "من سجّل أول هدف لصالح {subject}؟"},
    LAST_SCORER: {"en": "Who scored the last goal for {subject}?", "ar": "من سجّل آخر هدف لصالح {subject}؟"},
    CAPTAIN: {"en": "Who captained {subject}?", "ar": "من كان قائد {subject}؟"},
    SCORED_IN_FINAL_AGAINST: {
        "en": "Which team did {subject} score against in the {final} final?",
        "ar": "ضد أي فريق سجّل {subject} في نهائي {final}؟",
    },
    NATIONALITY: {"en": "Which country is {subject} from?", "ar": "ما جنسية {subject}؟"},
}
# A scorer and his assist read better as one goal than as "the player who set up the goal of the scorer of …".
GOAL_JUMPS = {
    FIRST_SCORER: {
        "en": "Who set up their first goal in that final?",
        "ar": "من صنع أول أهدافهم في ذلك النهائي؟",
    },
    LAST_SCORER: {
        "en": "Who set up their last goal in that final?",
        "ar": "من صنع آخر أهدافهم في ذلك النهائي؟",
    },
}


@dataclass(frozen=True)
class FinalGoal:
    """A goal of a final. An own goal makes "their first goal" unclear, so its match has no scorer hops."""

    match_id: int
    team_ref: str
    scorer_ref: str
    minute: int | None
    assist_ref: str | None
    own_goal: bool = False


@dataclass(frozen=True)
class Room:
    hop: str
    answer: str
    match_id: int | None
    # The scorer's goal, for an ASSIST that follows.
    goal: FinalGoal | None = None


@dataclass(frozen=True)
class ThreadFacts:
    """Finals with a winner, their goals in minute order per team, captains and single citizenships."""

    finals: dict[int, LinkMatch]
    # Finals where scorer hops are safe: every goal has a minute and none is an own goal.
    scorer_safe: set[int]
    winners: dict[int, str]
    goals: dict[tuple[int, str], list[FinalGoal]]
    captains: dict[tuple[int, str], str]
    finals_scored_in: dict[str, list[tuple[int, str]]]
    citizenship: dict[str, str]


def collect_thread_facts(
    matches: Iterable[LinkMatch],
    goals: Iterable[FinalGoal],
    captains: Iterable[tuple[int, str, str]],
    citizenships: Iterable[tuple[str, str]],
) -> ThreadFacts:
    """Single-match finals with a known winner (a shootout counts), their goals, captains (match, team, player) and
    citizenships (player, country); a player with two countries has no NATIONALITY hop."""
    finals: dict[int, LinkMatch] = {}
    winners: dict[int, str] = {}
    for match in matches:
        if match.stage != FINAL or match.leg is not None:
            continue
        winner = _winner_of(match)
        if winner is not None:
            finals[match.match_id] = match
            winners[match.match_id] = winner
    by_team: dict[tuple[int, str], list[FinalGoal]] = defaultdict(list)
    scored_in: dict[str, set[tuple[int, str]]] = defaultdict(set)
    unsafe: set[int] = set()
    for goal in goals:
        if goal.match_id in finals and (goal.own_goal or goal.minute is None or not goal.scorer_ref):
            unsafe.add(goal.match_id)
        if goal.match_id in finals and not goal.own_goal:
            by_team[(goal.match_id, goal.team_ref)].append(goal)
            scored_in[goal.scorer_ref].add((goal.match_id, goal.team_ref))
    ordered = {
        key: sorted(found, key=lambda goal: (goal.minute is None, goal.minute or 0, goal.scorer_ref))
        for key, found in by_team.items()
    }
    countries: dict[str, set[str]] = defaultdict(set)
    for player, country in citizenships:
        countries[player].add(country)
    return ThreadFacts(
        finals=finals,
        scorer_safe=set(finals) - unsafe,
        winners=winners,
        goals=ordered,
        captains={(match, team): player for match, team, player in captains if match in finals},
        finals_scored_in={player: sorted(found) for player, found in scored_in.items()},
        citizenship={player: next(iter(found)) for player, found in countries.items() if len(found) == 1},
    )


def thread_rounds(
    facts: ThreadFacts,
    kind_of: Callable[[str], str | None],
    popularity_of: Callable[[str], int],
    kb_version: str,
    rooms: int = DEFAULT_ROOMS,
    min_player_sitelinks: int = DEFAULT_MIN_PLAYER_SITELINKS,
    threads_per_final: int = DEFAULT_THREADS_PER_FINAL,
) -> list[dict]:
    """Every valid thread, at most `threads_per_final` per final with different second rooms, the best known first
    within a final; sorted by final. `kind_of` is the catalog kind of an entity (None when it is not in the catalog)."""

    def is_known(ref: str) -> bool:
        kind = kind_of(ref)
        return kind is not None and (kind != "PLAYER" or popularity_of(ref) >= min_player_sitelinks)

    lines = []
    for match_id in sorted(facts.finals):
        winner = facts.winners[match_id]
        if not is_known(winner):
            continue
        found: list[list[Room]] = []
        _walk(facts, kind_of, is_known, rooms, [Room(FINAL_WINNER, winner, match_id)], found)
        found.sort(key=lambda thread: (-_least_known(thread, kind_of, popularity_of), _signature(thread)))
        second_rooms: set[tuple[str, str]] = set()
        for thread in found:
            key = (thread[1].hop, thread[1].answer)
            if key in second_rooms or len(second_rooms) >= threads_per_final:
                continue
            second_rooms.add(key)
            lines.append(_thread_line(facts, thread, kind_of, popularity_of, kb_version))
    return lines


def next_rooms(facts: ThreadFacts, kind_of: Callable[[str], str | None], room: Room) -> list[Room]:
    """The rooms that can follow `room`, each with exactly one answer given it."""
    kind = kind_of(room.answer)
    out: list[Room] = []
    if kind in ("CLUB", "NATIONAL_TEAM") and room.match_id is not None:
        match = facts.finals[room.match_id]
        if room.answer not in (match.home_ref, match.away_ref):
            return []
        out.append(Room(FINAL_OPPONENT, _other_team(match, room.answer), room.match_id))
        timed = (
            facts.goals.get((room.match_id, room.answer), []) if room.match_id in facts.scorer_safe else []
        )
        if timed and (len(timed) == 1 or timed[0].minute != timed[1].minute):
            out.append(Room(FIRST_SCORER, timed[0].scorer_ref, room.match_id, timed[0]))
        if len(timed) > 1 and timed[-1].minute != timed[-2].minute:
            out.append(Room(LAST_SCORER, timed[-1].scorer_ref, room.match_id, timed[-1]))
        captain = facts.captains.get((room.match_id, room.answer))
        if captain is not None:
            out.append(Room(CAPTAIN, captain, room.match_id))
    elif kind == "PLAYER":
        if room.goal is not None and room.goal.assist_ref is not None:
            out.append(Room(ASSIST, room.goal.assist_ref, room.match_id))
        for match_id, team in facts.finals_scored_in.get(room.answer, []):
            if match_id != room.match_id:
                out.append(Room(SCORED_IN_FINAL_AGAINST, _other_team(facts.finals[match_id], team), match_id))
        country = facts.citizenship.get(room.answer)
        if country is not None:
            out.append(Room(NATIONALITY, country, None))
    return sorted(
        out, key=lambda next_room: (HOP_ORDER.index(next_room.hop), next_room.answer, next_room.match_id or 0)
    )


def difficulty_from_least_known(sitelinks: int) -> int:
    return next(level for minimum, level in DIFFICULTY_BY_LEAST_KNOWN if sitelinks >= minimum)


def _walk(
    facts: ThreadFacts,
    kind_of: Callable[[str], str | None],
    is_known: Callable[[str], bool],
    rooms: int,
    path: list[Room],
    found: list[list[Room]],
) -> None:
    if len(path) == rooms:
        found.append(list(path))
        return
    for room in next_rooms(facts, kind_of, path[-1]):
        if (
            room.hop == path[-1].hop
            or not is_known(room.answer)
            or any(room.answer == r.answer for r in path)
        ):
            continue
        # A country leads nowhere: it can only close the thread.
        if room.hop == NATIONALITY and len(path) != rooms - 1:
            continue
        path.append(room)
        _walk(facts, kind_of, is_known, rooms, path, found)
        path.pop()


def _thread_line(
    facts: ThreadFacts,
    thread: list[Room],
    kind_of: Callable[[str], str | None],
    popularity_of: Callable[[str], int],
    kb_version: str,
) -> dict:
    rooms = []
    for index, room in enumerate(thread):
        following = thread[index + 1] if index + 1 < len(thread) else None
        rooms.append(
            {
                "hop": room.hop,
                "answerKind": kind_of(room.answer),
                "text": _fill(QUESTIONS[room.hop], facts, room),
                "jumpText": _jump_text(facts, room, following) if following else None,
            }
        )
    return {
        "externalKey": "thread:" + hashlib.sha1(_signature(thread).encode()).hexdigest()[:20],
        "type": "GAME",
        "gameType": "THREAD",
        "category": "threads",
        "difficulty": difficulty_from_least_known(_least_known(thread, kind_of, popularity_of)),
        "content": {"rooms": rooms},
        "answers": [{"slot": index, "entities": [room.answer]} for index, room in enumerate(thread)],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt", "fjelstul"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        "validUntil": None,
        "humanReviewed": {"en": False, "ar": False},
    }


def _jump_text(facts: ThreadFacts, room: Room, following: Room) -> Names:
    """The question for `following` with `room` folded in: answering it skips both rooms."""
    if following.hop == ASSIST and room.hop in GOAL_JUMPS:
        return dict(GOAL_JUMPS[room.hop])
    subject = _fill(NOUNS[room.hop], facts, room)
    final = _final_names(facts, following.match_id)
    return {
        locale: JUMPS[following.hop][locale].format(subject=subject[locale], final=final[locale])
        for locale in ("en", "ar")
    }


def _fill(template: Names, facts: ThreadFacts, room: Room) -> Names:
    final = _final_names(facts, room.match_id)
    return {locale: template[locale].format(final=final[locale]) for locale in ("en", "ar")}


def _final_names(facts: ThreadFacts, match_id: int | None) -> Names:
    """ "2013-14 UEFA Champions League" and "دوري أبطال أوروبا 2013-14"; empty for a room with no match."""
    if match_id is None:
        return {"en": "", "ar": ""}
    match = facts.finals[match_id]
    return {
        "en": f"{match.season_label} {match.competition_names['en']}",
        "ar": f"{match.competition_names['ar']} {match.season_label}",
    }


def _least_known(
    thread: list[Room], kind_of: Callable[[str], str | None], popularity_of: Callable[[str], int]
) -> int:
    players = [popularity_of(room.answer) for room in thread if kind_of(room.answer) == "PLAYER"]
    return min(players, default=100)


def _signature(thread: list[Room]) -> str:
    return "|".join(f"{room.hop}:{room.answer}:{room.match_id}" for room in thread)


def _winner_of(match: LinkMatch) -> str | None:
    if match.home_goals != match.away_goals:
        return match.home_ref if match.home_goals > match.away_goals else match.away_ref
    if (
        match.shootout_home is not None
        and match.shootout_away is not None
        and match.shootout_home != match.shootout_away
    ):
        return match.home_ref if match.shootout_home > match.shootout_away else match.away_ref
    return None


def _other_team(match: LinkMatch, team: str) -> str:
    return match.away_ref if team == match.home_ref else match.home_ref
