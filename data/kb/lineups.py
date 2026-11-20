"""D.3d lineups (07 §5.10, N3 and N5 slices): lineups of usable matches, from Transfermarkt and Fjelstul.

Rebuilt by `kb ingest:matches` after the goals. A source's match whose lineups fail a D.3f gate (11 starters, at
most one captain per team) is listed in `.out/review-lineups.csv` and none of that source's lineup is stored.
One lineup is kept per match and team: Transfermarkt's when it has one (captain, finer positions), otherwise
Fjelstul's (World Cup, no captain). When both have one and they name different starters, neither is kept.
"""

import csv
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

from kb.goals import license_of, raw_table_exists

LINEUPS_TABLE = "transfermarkt__game_lineups"
FJELSTUL_LINEUPS_TABLE = "fjelstul__player_appearances"
TRANSFERMARKT = "transfermarkt"
FJELSTUL = "fjelstul"
SOURCE_PRIORITY = (TRANSFERMARKT, FJELSTUL)
REVIEW_DIR = Path(".out")
STARTERS_PER_TEAM = 11
STARTER_TYPE = "starting_lineup"

WRONG_STARTER_COUNT = "WRONG_STARTER_COUNT"
SEVERAL_CAPTAINS = "SEVERAL_CAPTAINS"
ONE_TEAM_MISSING = "ONE_TEAM_MISSING"
SOURCES_DISAGREE = "SOURCES_DISAGREE"


@dataclass(frozen=True)
class LineupRow:
    row_id: str
    game_id: str
    club_id: str
    player_id: str
    starter: bool
    position: str | None
    shirt_number: int | None
    captain: bool


def parse_shirt_number(text: str | None) -> int | None:
    return int(text) if text and text.isdigit() else None


def find_lineup_problem(rows: list[LineupRow], team_club_ids: tuple[str, str]) -> str | None:
    """The first D.3f gate a match's lineup rows fail, or None when both teams pass."""
    by_club = defaultdict(list)
    for row in rows:
        by_club[row.club_id].append(row)
    for club_id in team_club_ids:
        team = by_club.get(club_id, [])
        if not team:
            return ONE_TEAM_MISSING
        if sum(row.starter for row in team) != STARTERS_PER_TEAM:
            return WRONG_STARTER_COUNT
        if sum(row.captain for row in team) > 1:
            return SEVERAL_CAPTAINS
    return None


@dataclass(frozen=True)
class LineupSlot:
    """One row of core.lineup_slot, before it is stored."""

    player_ref: str | None
    player_source_id: str
    starter: bool
    position: str | None
    shirt_number: int | None
    captain: bool
    source_row_id: str


@dataclass(frozen=True)
class TeamLineup:
    """One source's lineup of one team in one match, already through the D.3f gates."""

    match_id: int
    team_ref: str
    source: str
    license: str
    slots: tuple[LineupSlot, ...]


def do_lineups_name_different_starters(first: TeamLineup, second: TeamLineup) -> bool:
    """True when two sources' starters differ in a way their unlinked starters cannot explain.

    A linked starter missing from the other lineup is explained only by an unlinked starter there (the same
    player, not linked in that source).
    """

    def linked_and_unlinked_starters(lineup: TeamLineup) -> tuple[set[str], int]:
        starters = [slot for slot in lineup.slots if slot.starter]
        linked = {slot.player_ref for slot in starters if slot.player_ref}
        return linked, sum(slot.player_ref is None for slot in starters)

    first_linked, first_unlinked = linked_and_unlinked_starters(first)
    second_linked, second_unlinked = linked_and_unlinked_starters(second)
    return (
        len(first_linked - second_linked) > second_unlinked
        or len(second_linked - first_linked) > first_unlinked
    )


def choose_one_lineup_per_team(lineups: list[TeamLineup]) -> tuple[list[TeamLineup], list[TeamLineup]]:
    """(kept, disagreeing): one lineup per match and team, by SOURCE_PRIORITY; when the two sources name
    different starters, neither is kept and both are returned as disagreeing."""
    by_team: dict[tuple[int, str], dict[str, TeamLineup]] = defaultdict(dict)
    for lineup in lineups:
        by_team[(lineup.match_id, lineup.team_ref)][lineup.source] = lineup
    kept: list[TeamLineup] = []
    disagreeing: list[TeamLineup] = []
    for key in sorted(by_team):
        candidates = [by_team[key][source] for source in SOURCE_PRIORITY if source in by_team[key]]
        if len(candidates) > 1 and do_lineups_name_different_starters(candidates[0], candidates[1]):
            disagreeing += candidates
            continue
        kept.append(candidates[0])
    return kept, disagreeing


@dataclass
class LineupReport:
    team_lineups: Counter = field(default_factory=Counter)  # kept, per source
    slots: int = 0
    unlinked_players: int = 0
    refused: Counter = field(default_factory=Counter)

    def lines(self) -> list[str]:
        refused = ", ".join(f"{reason} {count:,}" for reason, count in sorted(self.refused.items()))
        sources = ", ".join(f"{source} {self.team_lineups[source]:,}" for source in SOURCE_PRIORITY)
        return [
            f"lineups: {sum(self.team_lineups.values()):,} team lineups ({sources}), {self.slots:,} slots "
            f"(player not linked {self.unlinked_players:,}); refused: {refused or 'none'}"
        ]


def ingest_lineups(connection: psycopg.Connection, review_dir: Path = REVIEW_DIR) -> LineupReport:
    """Rebuild core.lineup_slot from the Transfermarkt and Fjelstul lineups of usable matches."""
    report = LineupReport()
    review: list[dict] = []
    lineups: list[TeamLineup] = []
    if raw_table_exists(connection, LINEUPS_TABLE):
        lineups += _gated_team_lineups(
            connection, TRANSFERMARKT, LINEUPS_TABLE, _transfermarkt_games(connection),
            _read_lineup_rows(connection), report, review,
        )  # fmt: skip
    if raw_table_exists(connection, FJELSTUL_LINEUPS_TABLE):
        lineups += _gated_team_lineups(
            connection, FJELSTUL, FJELSTUL_LINEUPS_TABLE, _fjelstul_games(connection),
            _read_fjelstul_lineup_rows(connection), report, review,
        )  # fmt: skip
    kept, disagreeing = choose_one_lineup_per_team(lineups)
    for lineup in disagreeing:
        if lineup.source == SOURCE_PRIORITY[0]:
            report.refused[SOURCES_DISAGREE] += 1
        review.append(
            {"source": lineup.source, "game_id": "", "match_id": lineup.match_id, "team_ref": lineup.team_ref,
             "reason": SOURCES_DISAGREE}
        )  # fmt: skip

    stored = []
    for lineup in kept:
        report.team_lineups[lineup.source] += 1
        for slot in lineup.slots:
            report.slots += 1
            report.unlinked_players += slot.player_ref is None
            stored.append(
                (lineup.match_id, lineup.team_ref, slot.player_ref, slot.player_source_id, slot.starter,
                 slot.position, slot.shirt_number, slot.captain, lineup.source, slot.source_row_id, lineup.license)
            )  # fmt: skip
    _store_lineups(connection, stored)
    _write_review_file(review, review_dir)
    return report


def _gated_team_lineups(
    connection: psycopg.Connection,
    source: str,
    table: str,
    match_of_game: dict[str, tuple[int, tuple[str, str]]],
    rows: list[LineupRow],
    report: LineupReport,
    review: list[dict],
) -> list[TeamLineup]:
    """One source's lineups of usable matches that pass the D.3f gates, one TeamLineup per linked team."""
    team_ref_of = _linked_refs(connection, source, ("CLUB", "NATIONAL_TEAM"))
    player_ref_of = _linked_refs(connection, source, ("PLAYER",))
    rows_of_game: dict[str, list[LineupRow]] = defaultdict(list)
    for row in rows:
        if row.game_id in match_of_game:
            rows_of_game[row.game_id].append(row)
    license = license_of(connection, table)
    lineups = []
    for game_id, game_rows in sorted(rows_of_game.items()):
        match_id, team_ids = match_of_game[game_id]
        problem = find_lineup_problem(game_rows, team_ids)
        if problem:
            report.refused[f"{source} {problem}"] += 1
            review.append(
                {
                    "source": source,
                    "game_id": game_id,
                    "match_id": match_id,
                    "team_ref": "",
                    "reason": problem,
                }
            )
            continue
        for team_id in team_ids:
            team_ref = team_ref_of.get(team_id)
            if team_ref is None:
                continue
            slots = tuple(
                LineupSlot(
                    player_ref_of.get(row.player_id),
                    row.player_id,
                    row.starter,
                    row.position,
                    row.shirt_number,
                    row.captain,
                    row.row_id,
                )  # fmt: skip
                for row in game_rows
                if row.club_id == team_id
            )
            lineups.append(TeamLineup(match_id, team_ref, source, license, slots))
    return lineups


def _linked_refs(connection: psycopg.Connection, source: str, kinds: tuple[str, ...]) -> dict[str, str]:
    return dict(
        connection.execute(
            "SELECT source_id, entity_ref FROM core.entity_xref WHERE source = %s AND source_kind = ANY (%s)",
            (source, list(kinds)),
        ).fetchall()
    )


def _transfermarkt_games(connection: psycopg.Connection) -> dict[str, tuple[int, tuple[str, str]]]:
    rows = connection.execute(
        """SELECT c.source_row_id, m.id, g.home_club_id, g.away_club_id
           FROM core.match m JOIN core.claim c ON c.id = ANY (m.claim_ids)
           JOIN raw.transfermarkt__games g ON g.game_id = c.source_row_id
           WHERE m.usable AND c.source = 'transfermarkt'"""
    ).fetchall()
    return {game_id: (match_id, (home, away)) for game_id, match_id, home, away in rows}


def _fjelstul_games(connection: psycopg.Connection) -> dict[str, tuple[int, tuple[str, str]]]:
    rows = connection.execute(
        """SELECT c.source_row_id, m.id, f.home_team_id, f.away_team_id
           FROM core.match m JOIN core.claim c ON c.id = ANY (m.claim_ids)
           JOIN raw.fjelstul__matches f ON f.match_id = c.source_row_id
           WHERE m.usable AND c.source = 'fjelstul'"""
    ).fetchall()
    return {game_id: (match_id, (home, away)) for game_id, match_id, home, away in rows}


def _read_lineup_rows(connection: psycopg.Connection) -> list[LineupRow]:
    return [
        LineupRow(
            row_id,
            game_id,
            club_id,
            player_id,
            kind == STARTER_TYPE,
            position or None,
            parse_shirt_number(number),
            captain == "1",
        )  # fmt: skip
        for row_id, game_id, club_id, player_id, kind, position, number, captain in connection.execute(
            f"""SELECT game_lineups_id, game_id, club_id, player_id, type, position, number, team_captain
                FROM raw.{LINEUPS_TABLE} WHERE coalesce(player_id, '') <> ''
                ORDER BY game_id, game_lineups_id"""
        )
    ]


def _read_fjelstul_lineup_rows(connection: psycopg.Connection) -> list[LineupRow]:
    """Fjelstul appearances as lineup rows: the position is its code (`CB`, `DF`), and there is no captain."""
    return [
        LineupRow(
            row_id,
            match_id,
            team_id,
            player_id,
            starter == "1",
            position or None,
            parse_shirt_number(number),
            False,
        )  # fmt: skip
        for row_id, match_id, team_id, player_id, starter, position, number in connection.execute(
            f"""SELECT key_id, match_id, team_id, player_id, starter, position_code, shirt_number
                FROM raw.{FJELSTUL_LINEUPS_TABLE} WHERE coalesce(player_id, '') <> ''
                ORDER BY match_id, key_id"""
        )
    ]


def _store_lineups(connection: psycopg.Connection, rows: list[tuple]) -> None:
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("TRUNCATE core.lineup_slot RESTART IDENTITY")
        with cursor.copy(
            """COPY core.lineup_slot (match_id, team_ref, player_ref, player_source_id, starter, position,
                 shirt_number, captain, source, source_row_id, license) FROM STDIN"""
        ) as copy:
            for row in rows:
                copy.write_row(row)


def _write_review_file(rows: list[dict], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "review-lineups.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, ["source", "game_id", "match_id", "team_ref", "reason"])
        writer.writeheader()
        writer.writerows(rows)
