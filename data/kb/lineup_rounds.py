"""LINEUP (التشكيلة) rounds: one team's starting XI in a famous match, with 3 shown names (08 §14.4). Pure.

A round is kept only when every starter is a catalog player (so every slot can be judged), enough of them are
known players, every starter has a position, and a known bench player of that team exists to be the fake.
"""

import hashlib
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.generate import LICENSES, SOURCES, Names
from kb.vaults import DIFFICULTY_BY_STAGE, FINAL, KNOCKOUT_STAGES, VaultMatch, _match_names

STARTERS = 11
SHOWN_REAL_NAMES = 2
KNOWN_PLAYER_SITELINKS = 40
# DEC-80: tier-1 knockouts from the round of 16 (World Cup included) and tier-2 finals.
FAMOUS_STAGES_BY_TIER = {1: KNOCKOUT_STAGES, 2: (FINAL,)}
# A well-known XI is easier to remember: below this share of known starters the round is one step harder.
EASY_KNOWN_SHARE = 0.8

LINES = ("GK", "DEF", "MID", "FWD")
# Roles in the order the app draws them, left to right inside a line.
ROLES = ("GK", "LB", "CB", "RB", "LM", "DM", "CM", "AM", "RM", "LW", "SS", "CF", "RW")
# Transfermarkt position names and Fjelstul position codes → (line, role); role None when the source is coarse.
POSITIONS = {
    "Goalkeeper": ("GK", "GK"),
    "Left-Back": ("DEF", "LB"),
    "Centre-Back": ("DEF", "CB"),
    "Sweeper": ("DEF", "CB"),
    "Right-Back": ("DEF", "RB"),
    "Defensive Midfield": ("MID", "DM"),
    "Central Midfield": ("MID", "CM"),
    "Attacking Midfield": ("MID", "AM"),
    "Left Midfield": ("MID", "LM"),
    "Right Midfield": ("MID", "RM"),
    "midfield": ("MID", None),
    "Left Winger": ("FWD", "LW"),
    "Right Winger": ("FWD", "RW"),
    "Second Striker": ("FWD", "SS"),
    "Centre-Forward": ("FWD", "CF"),
    "Attack": ("FWD", None),
    "GK": ("GK", "GK"),
    "LB": ("DEF", "LB"),
    "LWB": ("DEF", "LB"),
    "CB": ("DEF", "CB"),
    "SW": ("DEF", "CB"),
    "RB": ("DEF", "RB"),
    "RWB": ("DEF", "RB"),
    "DF": ("DEF", None),
    "DM": ("MID", "DM"),
    "CM": ("MID", "CM"),
    "AM": ("MID", "AM"),
    "LM": ("MID", "LM"),
    "RM": ("MID", "RM"),
    "MF": ("MID", None),
    "LW": ("FWD", "LW"),
    "LF": ("FWD", "LW"),
    "RW": ("FWD", "RW"),
    "RF": ("FWD", "RW"),
    "SS": ("FWD", "SS"),
    "CF": ("FWD", "CF"),
    "FW": ("FWD", None),
}

TITLE_TEMPLATE = {
    "en": "{team} against {opponent}, {stage} of the {season} {competition} ({score})",
    "ar": "{team} أمام {opponent}، {stage} {competition} {season} ({score})",
}
SHOOTOUT_TEMPLATE = {"en": "{goals}, {shootout} on penalties", "ar": "{goals}، {shootout} بركلات الترجيح"}


@dataclass(frozen=True)
class LineupPlayer:
    player_ref: str | None
    starter: bool
    position: str | None
    shirt_number: int | None
    captain: bool


@dataclass(frozen=True)
class SourcedLineup:
    """One team's stored lineup in one match (core.lineup_slot), with the source it came from."""

    match_id: int
    team_ref: str
    source: str
    license: str
    players: tuple[LineupPlayer, ...]


def is_famous_match(match: VaultMatch) -> bool:
    return match.stage in FAMOUS_STAGES_BY_TIER.get(match.tier, ())


def lineup_rounds(
    matches: Iterable[VaultMatch],
    lineups: Iterable[SourcedLineup],
    team_names_of: Callable[[str], Names | None],
    player_names_of: Callable[[str], Names | None],
    player_popularity_of: Callable[[str], int | None],
    kb_version: str,
    *,
    min_known: int = 6,
) -> list[dict]:
    """Every playable LINEUP round, most famous first (stage, tier, then the XI's popularity), sorted stably.

    `player_names_of` and `player_popularity_of` answer only for catalog players.
    """
    famous = {match.match_id: match for match in matches if is_famous_match(match)}
    rounds = []
    for lineup in lineups:
        match = famous.get(lineup.match_id)
        if match is None:
            continue
        line = _lineup_line(
            match, lineup, team_names_of, player_names_of, player_popularity_of, kb_version, min_known
        )
        if line is not None:
            rounds.append(line)
    return sorted(rounds, key=lambda line: (line["difficulty"], -line["_popularity"], line["externalKey"]))


def without_sort_fields(lines: list[dict]) -> list[dict]:
    """The bundle lines without the private `_popularity` used for ordering."""
    return [{key: value for key, value in line.items() if not key.startswith("_")} for line in lines]


def slot_order_of(position: str) -> tuple[int, int]:
    line, role = POSITIONS[position]
    return LINES.index(line), ROLES.index(role) if role else len(ROLES)


def _lineup_line(
    match: VaultMatch,
    lineup: SourcedLineup,
    team_names_of: Callable[[str], Names | None],
    player_names_of: Callable[[str], Names | None],
    player_popularity_of: Callable[[str], int | None],
    kb_version: str,
    min_known: int,
) -> dict | None:
    starters = [player for player in lineup.players if player.starter]
    if len(starters) != STARTERS or len({player.player_ref for player in starters}) != STARTERS:
        return None
    if any(
        player.player_ref is None
        or player_names_of(player.player_ref) is None
        or player.position not in POSITIONS
        for player in starters
    ):
        return None
    popularity = {player.player_ref: player_popularity_of(player.player_ref) or 0 for player in starters}
    known = sum(value >= KNOWN_PLAYER_SITELINKS for value in popularity.values())
    if known < min_known:
        return None
    fake = _pick_fake(lineup, player_names_of, player_popularity_of)
    names = _match_names(match, lineup.team_ref, team_names_of)
    if fake is None or names is None:
        return None

    captains = [player for player in starters if player.captain]
    captain_ref = captains[0].player_ref if len(captains) == 1 else None
    ordered = sorted(
        starters, key=lambda player: (*slot_order_of(player.position), player.shirt_number or 99)
    )
    # Shown real names: the least known starters that are neither the captain nor the best-known player.
    best_known = max(popularity, key=lambda ref: (popularity[ref], ref))
    helpers = sorted(
        (ref for ref in popularity if ref not in (captain_ref, best_known)),
        key=lambda ref: (popularity[ref], ref),
    )[:SHOWN_REAL_NAMES]
    key = _round_key(match, lineup.team_ref)
    shown = sorted([*helpers, fake], key=lambda ref: hashlib.sha256(f"{key}:{ref}".encode()).hexdigest())

    difficulty = DIFFICULTY_BY_STAGE[match.stage] + (match.tier - 1) + (known / STARTERS < EASY_KNOWN_SHARE)
    return {
        "externalKey": key,
        "type": "GAME",
        "gameType": "LINEUP",
        "category": "lineups",
        "difficulty": min(5, difficulty),
        "content": {
            "title": _title(match, lineup.team_ref, names),
            "slots": [
                {
                    "line": POSITIONS[player.position][0],
                    "role": POSITIONS[player.position][1],
                    "shirtNumber": player.shirt_number,
                    "captain": player.player_ref == captain_ref,
                    "player": player.player_ref,
                }
                for player in ordered
            ],
            "shown": shown,
            "fake": fake,
        },
        "answers": [
            {"slot": 0, "entities": [player.player_ref for player in ordered]},
            {"slot": 1, "entities": [fake]},
        ],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, lineup.source],
            "licenses": sorted({*LICENSES, lineup.license}),
            "kbVersion": kb_version,
        },
        # A past match never changes.
        "validUntil": None,
        "humanReviewed": {"en": False, "ar": False},
        "_popularity": sum(popularity.values()),
    }


def _pick_fake(
    lineup: SourcedLineup,
    player_names_of: Callable[[str], Names | None],
    player_popularity_of: Callable[[str], int | None],
) -> str | None:
    """The best-known bench player of the team in that match: the most believable starter who was not."""
    starters = {player.player_ref for player in lineup.players if player.starter}
    bench = {
        player.player_ref
        for player in lineup.players
        if not player.starter
        and player.player_ref is not None
        and player.player_ref not in starters
        and player_names_of(player.player_ref) is not None
        and (player_popularity_of(player.player_ref) or 0) >= KNOWN_PLAYER_SITELINKS
    }
    if not bench:
        return None
    return max(bench, key=lambda ref: (player_popularity_of(ref) or 0, ref))


def _title(match: VaultMatch, team_ref: str, names: dict[str, Names]) -> Names:
    is_home = team_ref == match.home_ref
    goals = f"{match.home_goals}–{match.away_goals}" if is_home else f"{match.away_goals}–{match.home_goals}"
    score = {"en": goals, "ar": goals}
    if match.shootout_home is not None and match.shootout_away is not None:
        shootout = (
            f"{match.shootout_home}–{match.shootout_away}"
            if is_home
            else f"{match.shootout_away}–{match.shootout_home}"
        )
        score = {
            locale: SHOOTOUT_TEMPLATE[locale].format(goals=goals, shootout=shootout)
            for locale in ("en", "ar")
        }
    return {
        locale: TITLE_TEMPLATE[locale].format(
            **{part: value[locale] for part, value in names.items()}, score=score[locale]
        )
        for locale in ("en", "ar")
    }


def _round_key(match: VaultMatch, team_ref: str) -> str:
    """Stable across rebuilds (core.match ids are not): competition, season, stage, leg and the teams."""
    leg = f":leg{match.leg}" if match.leg else ""
    teams = f"{_qid(match.home_ref)}-{_qid(match.away_ref)}"
    return f"lineup:{match.competition_key}:{match.season_label}:{match.stage}{leg}:{teams}:{_qid(team_ref)}"


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")
