"""D.3d lineups slice (07 §5.10, N3): lineups of usable matches, from Transfermarkt.

Rebuilt by `kb ingest:matches` after the goals. A match whose lineups fail a D.3f gate (11 starters, at most one
captain per team) is listed in `.out/review-lineups.csv` and none of its lineup is stored.
"""

import csv
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

from kb.goals import license_of, raw_table_exists

LINEUPS_TABLE = "transfermarkt__game_lineups"
REVIEW_DIR = Path(".out")
STARTERS_PER_TEAM = 11
STARTER_TYPE = "starting_lineup"

WRONG_STARTER_COUNT = "WRONG_STARTER_COUNT"
SEVERAL_CAPTAINS = "SEVERAL_CAPTAINS"
ONE_TEAM_MISSING = "ONE_TEAM_MISSING"


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


@dataclass
class LineupReport:
    matches: int = 0
    slots: int = 0
    unlinked_players: int = 0
    refused: Counter = field(default_factory=Counter)

    def lines(self) -> list[str]:
        refused = ", ".join(f"{reason} {count:,}" for reason, count in sorted(self.refused.items()))
        return [
            f"lineups: {self.matches:,} matches, {self.slots:,} slots (player not linked {self.unlinked_players:,}); "
            f"matches refused: {refused or 'none'}"
        ]


def ingest_lineups(connection: psycopg.Connection, review_dir: Path = REVIEW_DIR) -> LineupReport:
    """Rebuild core.lineup_slot from the Transfermarkt lineups of usable matches."""
    report = LineupReport()
    if not raw_table_exists(connection, LINEUPS_TABLE):
        return report
    game_rows = connection.execute(
        """SELECT c.source_row_id, m.id, g.home_club_id, g.away_club_id
           FROM core.match m JOIN core.claim c ON c.id = ANY (m.claim_ids)
           JOIN raw.transfermarkt__games g ON g.game_id = c.source_row_id
           WHERE m.usable AND c.source = 'transfermarkt'"""
    ).fetchall()
    match_of_game = {game_id: (match_id, (home, away)) for game_id, match_id, home, away in game_rows}
    team_ref_of = dict(
        connection.execute(
            """SELECT source_id, entity_ref FROM core.entity_xref
               WHERE source = 'transfermarkt' AND source_kind IN ('CLUB', 'NATIONAL_TEAM')"""
        ).fetchall()
    )
    player_ref_of = dict(
        connection.execute(
            """SELECT source_id, entity_ref FROM core.entity_xref
               WHERE source = 'transfermarkt' AND source_kind = 'PLAYER'"""
        ).fetchall()
    )
    rows_of_game: dict[str, list[LineupRow]] = defaultdict(list)
    for row in _read_lineup_rows(connection):
        if row.game_id in match_of_game:
            rows_of_game[row.game_id].append(row)
    license = license_of(connection, LINEUPS_TABLE)

    stored = []
    review = []
    for game_id, rows in sorted(rows_of_game.items()):
        match_id, team_club_ids = match_of_game[game_id]
        problem = find_lineup_problem(rows, team_club_ids)
        if problem:
            report.refused[problem] += 1
            review.append({"game_id": game_id, "match_id": match_id, "reason": problem})
            continue
        report.matches += 1
        for row in rows:
            team_ref = team_ref_of.get(row.club_id)
            if team_ref is None:
                continue
            player_ref = player_ref_of.get(row.player_id)
            report.slots += 1
            report.unlinked_players += player_ref is None
            stored.append(
                (match_id, team_ref, player_ref, row.player_id, row.starter, row.position, row.shirt_number,
                 row.captain, "transfermarkt", row.row_id, license)
            )  # fmt: skip
    _store_lineups(connection, stored)
    _write_review_file(review, review_dir)
    return report


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
        writer = csv.DictWriter(file, ["game_id", "match_id", "reason"])
        writer.writeheader()
        writer.writerows(rows)
