"""D.3d first goals slice (07 §5.10, N2): goals of usable matches, from Transfermarkt goal events.

Rebuilt by `kb ingest:matches` right after the matches. Own goals are kept and flagged. An assist is kept only
when it is a real assist by a player in the scoring team's lineup for that match.
"""

import csv
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

GOAL_EVENTS_TABLE = "transfermarkt__game_events"
LINEUPS_TABLE = "transfermarkt__game_lineups"
REVIEW_DIR = Path(".out")

# Transfermarkt's event descriptions, for example ", Penalty, 1. Tournament Goal Assist: , Penalty: Fouled player".
OWN_GOAL_MARK = "own-goal"
PENALTY_MARK = ", penalty,"
# On a penalty the assist field names the fouled player: not an assist.
FOULED_PLAYER_MARK = "penalty: fouled player"

NO_ASSIST = "NO_ASSIST"
FOULED_PLAYER = "FOULED_PLAYER"
OWN_GOAL = "OWN_GOAL"
NO_LINEUP = "NO_LINEUP"
NOT_IN_LINEUP = "NOT_IN_LINEUP"


@dataclass(frozen=True)
class GoalEvent:
    event_id: str
    game_id: str
    club_id: str
    player_id: str
    assist_player_id: str | None
    minute: str | None
    description: str


@dataclass(frozen=True)
class GoalFacts:
    own_goal: bool
    penalty: bool
    # The assist provider's source id when the assist is kept, else None and the reason in `assist_dropped`.
    assist_player_id: str | None
    assist_dropped: str | None


def read_goal_facts(event: GoalEvent, lineup_of_game: set[tuple[str, str]] | None) -> GoalFacts:
    """What one goal event says, with the assist checked. `lineup_of_game` holds (club_id, player_id) pairs, or
    is None when the source has no lineup for the match (the assist cannot be checked, so it is dropped)."""
    text = f"{event.description.lower()},"
    own_goal = OWN_GOAL_MARK in text
    penalty = PENALTY_MARK in text

    def facts(assist: str | None, dropped: str | None) -> GoalFacts:
        return GoalFacts(own_goal, penalty, assist, dropped)

    if not event.assist_player_id:
        return facts(None, None)
    if FOULED_PLAYER_MARK in text:
        return facts(None, FOULED_PLAYER)
    if own_goal:
        return facts(None, OWN_GOAL)
    if lineup_of_game is None:
        return facts(None, NO_LINEUP)
    if (event.club_id, event.assist_player_id) not in lineup_of_game:
        return facts(None, NOT_IN_LINEUP)
    return facts(event.assist_player_id, None)


def parse_minute(text: str | None) -> int | None:
    return int(text) if text and text.isdigit() else None


@dataclass
class GoalReport:
    goals: int = 0
    own_goals: int = 0
    penalties: int = 0
    unlinked_scorers: int = 0
    assists_kept: int = 0
    assists_dropped: Counter = field(default_factory=Counter)

    def lines(self) -> list[str]:
        dropped = ", ".join(f"{reason} {count:,}" for reason, count in sorted(self.assists_dropped.items()))
        return [
            f"goals: {self.goals:,} (own goals {self.own_goals:,}, penalties {self.penalties:,}, "
            f"scorer not linked {self.unlinked_scorers:,})",
            f"assists kept: {self.assists_kept:,}; dropped: {dropped or 'none'}",
        ]


def ingest_goals(connection: psycopg.Connection, review_dir: Path = REVIEW_DIR) -> GoalReport:
    """Rebuild core.goal from the goal events of usable matches that have a Transfermarkt claim."""
    report = GoalReport()
    if not _raw_table_exists(connection, GOAL_EVENTS_TABLE):
        return report
    match_of_game = dict(
        connection.execute(
            """SELECT c.source_row_id, m.id FROM core.match m JOIN core.claim c ON c.id = ANY (m.claim_ids)
               WHERE m.usable AND c.source = 'transfermarkt'"""
        ).fetchall()
    )
    team_ref_of = {
        source_id: ref
        for source_id, ref in connection.execute(
            """SELECT source_id, entity_ref FROM core.entity_xref
               WHERE source = 'transfermarkt' AND source_kind IN ('CLUB', 'NATIONAL_TEAM')"""
        )
    }
    player_ref_of = dict(
        connection.execute(
            """SELECT source_id, entity_ref FROM core.entity_xref
               WHERE source = 'transfermarkt' AND source_kind = 'PLAYER'"""
        ).fetchall()
    )
    lineups: dict[str, set[tuple[str, str]]] = defaultdict(set)
    if _raw_table_exists(connection, LINEUPS_TABLE):
        for game_id, club_id, player_id in connection.execute(
            f"SELECT game_id, club_id, player_id FROM raw.{LINEUPS_TABLE}"
        ):
            if game_id in match_of_game:
                lineups[game_id].add((club_id, player_id))
    license = _license_of(connection, GOAL_EVENTS_TABLE)

    rows = []
    review = []
    for event in _read_goal_events(connection):
        match_id = match_of_game.get(event.game_id)
        team_ref = team_ref_of.get(event.club_id)
        if match_id is None or team_ref is None:
            continue
        facts = read_goal_facts(event, lineups.get(event.game_id))
        scorer_ref = player_ref_of.get(event.player_id)
        assist_ref = player_ref_of.get(facts.assist_player_id) if facts.assist_player_id else None
        report.goals += 1
        report.own_goals += facts.own_goal
        report.penalties += facts.penalty
        report.unlinked_scorers += scorer_ref is None
        if facts.assist_player_id:
            report.assists_kept += 1
        elif facts.assist_dropped:
            report.assists_dropped[facts.assist_dropped] += 1
            if facts.assist_dropped == NOT_IN_LINEUP:
                review.append(
                    {"game_id": event.game_id, "event_id": event.event_id, "club_id": event.club_id,
                     "assist_player_id": event.assist_player_id or "", "description": event.description}
                )  # fmt: skip
        rows.append(
            (match_id, team_ref, scorer_ref, event.player_id, parse_minute(event.minute), facts.penalty,
             facts.own_goal, assist_ref, facts.assist_player_id, "transfermarkt", event.event_id, license)
        )  # fmt: skip
    _store_goals(connection, rows)
    _write_assist_review_file(review, review_dir)
    return report


def _read_goal_events(connection: psycopg.Connection) -> list[GoalEvent]:
    return [
        GoalEvent(*row)
        for row in connection.execute(
            f"""SELECT game_event_id, game_id, club_id, player_id, NULLIF(player_assist_id, ''), minute,
                       coalesce(description, '')
                FROM raw.{GOAL_EVENTS_TABLE} WHERE type = 'Goals' AND coalesce(player_id, '') <> ''
                ORDER BY game_id, game_event_id"""
        )
    ]


def _store_goals(connection: psycopg.Connection, rows: list[tuple]) -> None:
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("TRUNCATE core.goal RESTART IDENTITY")
        with cursor.copy(
            """COPY core.goal (match_id, team_ref, scorer_ref, scorer_source_id, minute, penalty, own_goal,
                 assist_ref, assist_source_id, source, source_row_id, license) FROM STDIN"""
        ) as copy:
            for row in rows:
                copy.write_row(row)


def _write_assist_review_file(rows: list[dict[str, str]], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "review-assists.csv"
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, ["game_id", "event_id", "club_id", "assist_player_id", "description"])
        writer.writeheader()
        writer.writerows(rows)


def _raw_table_exists(connection: psycopg.Connection, table: str) -> bool:
    return connection.execute("SELECT to_regclass(%s)", (f"raw.{table}",)).fetchone()[0] is not None


def _license_of(connection: psycopg.Connection, table: str) -> str:
    row = connection.execute(
        """SELECT license FROM raw.source_snapshot WHERE raw_table = %s ORDER BY loaded_at DESC, id DESC LIMIT 1""",
        (f"raw.{table}",),
    ).fetchone()
    return row[0] if row else "unknown"
