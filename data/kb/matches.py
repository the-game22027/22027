"""`kb ingest:matches`: rebuild core.claim (match results), core.competition, core.edition and core.match from
raw.* and core.entity_xref, offline (07 §5.10 D.3c/D.3d, ADR-0022). The rules live in kb.match_claims,
kb.match_resolution and kb.team_names; this module reads the database, stores and reports.
"""

import csv
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from kb.competitions import Coverage, MatchConfig, load_match_config
from kb.linking import REVIEW_DIR, write_link_review_file
from kb.match_claims import (
    BAD_SCORE,
    FACT_MATCH_RESULT,
    MISSING_SCORE,
    UNLINKED_TEAM,
    UNRESOLVED_NAME,
    MatchClaim,
    RejectedClaim,
    TransfermarktEvents,
    check_row_is_in_scope,
    claim_from_fjelstul_match,
    claim_from_martj42_result,
    claim_from_transfermarkt_game,
    parse_day,
)
from kb.match_resolution import (
    CONFLICT,
    SINGLE_SOURCE,
    VERIFIED,
    ResolvedMatch,
    assign_editions,
    find_rejected_claims_of_match,
    find_unlinked_claims_of_match,
    group_claims_into_matches,
    index_claims_by_team_pair,
    index_claims_with_one_unlinked_team,
    infer_finals_from_last_match,
    resolve_match,
    result_from_home_side_of,
    results_agree,
)
from kb.team_names import (
    TeamNameResolution,
    build_team_name_index,
    resolve_team_name,
    short_name_from_wikidata_label,
)

EXAMPLES_PER_PAIR = 3
RAW_TABLES = {
    "transfermarkt": "transfermarkt__games",
    "fjelstul": "fjelstul__matches",
    "martj42": "martj42__results",
}


@dataclass
class PairCount:
    shared: int = 0  # matches both sources have
    disagreeing: int = 0
    swapped: int = 0  # merged with home and away swapped
    examples: list[str] = field(default_factory=list)


@dataclass
class MatchReport:
    claims: Counter = field(default_factory=Counter)  # source → claims
    skipped: Counter = field(default_factory=Counter)  # (source, reason) → rows
    matches: Counter = field(default_factory=Counter)  # (tier, status) → matches
    usable: Counter = field(default_factory=Counter)  # tier → usable matches
    pairs: dict[tuple[str, str], PairCount] = field(default_factory=lambda: defaultdict(PairCount))
    missing: Counter = field(default_factory=Counter)  # source missing from a single-source match → count
    missing_examples: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    unlinked: Counter = field(default_factory=Counter)  # source that has a single-source match, unlinked
    rejected: Counter = field(
        default_factory=Counter
    )  # source whose row for a single-source match was refused
    rejected_examples: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    unlinked_examples: dict[str, list[str]] = field(default_factory=lambda: defaultdict(list))
    unresolved_names: dict[str, tuple[str, int, int, str]] = field(default_factory=dict)  # name → reason etc.
    inferred_finals: int = 0
    inferred_finals_confirmed: int = 0  # another source's own stage says FINAL too
    inferred_finals_contradicted: list[str] = field(default_factory=list)

    def lines(self) -> list[str]:
        lines = ["claims: " + ", ".join(f"{s} {n:,}" for s, n in sorted(self.claims.items()))]
        lines.append("skipped source rows:")
        for (source, reason), count in sorted(self.skipped.items()):
            lines.append(f"  {source:<14} {reason:<20} {count:>8,}")
        lines.append("matches by tier and status:")
        for tier in sorted({tier for tier, _ in self.matches}):
            counts = {status: self.matches[(tier, status)] for status in (VERIFIED, SINGLE_SOURCE, CONFLICT)}
            total = sum(counts.values())
            lines.append(
                f"  tier {tier}: {total:,} = VERIFIED {counts[VERIFIED]:,}, SINGLE_SOURCE {counts[SINGLE_SOURCE]:,}, "
                f"CONFLICT {counts[CONFLICT]:,}; usable {self.usable[tier]:,}"
            )
        lines.append("source pairs (matches both have):")
        for (first, second), pair in sorted(self.pairs.items()):
            rate = 100 * pair.disagreeing / pair.shared if pair.shared else 0.0
            lines.append(
                f"  {first} × {second}: {pair.shared:,} shared, {pair.disagreeing:,} conflicts ({rate:.1f}%), "
                f"{pair.swapped:,} with home and away swapped"
            )
            lines.extend(f"    e.g. {example}" for example in pair.examples)
        lines.append("single-source matches that a covering source lacks (not usable):")
        for source, count in sorted(self.missing.items()):
            lines.append(f"  missing from {source}: {count:,}")
            lines.extend(f"    e.g. {example}" for example in self.missing_examples[source])
        lines.append(
            "single-source matches whose row in a covering source was refused (not usable, see review file):"
        )
        for source, count in sorted(self.rejected.items()):
            lines.append(f"  refused in {source}: {count:,}")
            lines.extend(f"    e.g. {example}" for example in self.rejected_examples[source])
        lines.append("single-source matches that a covering source has with a team it cannot link:")
        for source, count in sorted(self.unlinked.items()):
            lines.append(f"  cannot link in {source}: {count:,}")
            lines.extend(f"    e.g. {example}" for example in self.unlinked_examples[source])
        lines.append(
            f"martj42 finals read from the last match of an edition: {self.inferred_finals} "
            f"({self.inferred_finals_confirmed} confirmed by another source's stage, "
            f"{len(self.inferred_finals_contradicted)} contradicted)"
        )
        lines.extend(f"  contradicted: {example}" for example in self.inferred_finals_contradicted)
        lines.append(f"unresolved martj42 team names: {len(self.unresolved_names)} (matches skipped)")
        for name, (reason, tier, count, candidates) in sorted(self.unresolved_names.items()):
            extra = f" [{candidates}]" if candidates else ""
            lines.append(f"  {name} ({reason}, tier {tier}, {count} rows){extra}")
        return lines


def ingest_matches(
    connection: psycopg.Connection, config: MatchConfig | None = None, review_dir: Path = REVIEW_DIR
) -> MatchReport:
    config = config or load_match_config()
    report = MatchReport()
    coverage = Coverage(config.coverage, load_last_match_date_per_competition(connection, config))
    team_refs = load_team_refs(connection)

    def team_ref(source: str):
        return lambda kind, source_id: team_refs.get((source, kind, source_id))

    claims: list[MatchClaim] = []
    rejected: list[MatchClaim] = []
    score_review_rows: list[dict[str, str]] = []
    if raw_table_exists(connection, RAW_TABLES["transfermarkt"]):
        events = load_transfermarkt_events(connection)
        for row in read_rows(connection, RAW_TABLES["transfermarkt"]):
            outcome = claim_from_transfermarkt_game(row, config, coverage, team_ref("transfermarkt"), events)
            if isinstance(outcome, RejectedClaim):
                rejected.append(outcome.claim)
                score_review_rows.append(transfermarkt_score_review_row(row, events, outcome.reason))
                outcome = outcome.reason
            elif outcome == BAD_SCORE:
                score_review_rows.append(transfermarkt_score_review_row(row, events, outcome))
            add_claim_or_count_skipped_row(outcome, claims, report, "transfermarkt")
    write_transfermarkt_score_review_file(score_review_rows, review_dir)
    if raw_table_exists(connection, RAW_TABLES["fjelstul"]):
        for row in read_rows(connection, RAW_TABLES["fjelstul"]):
            add_claim_or_count_skipped_row(
                claim_from_fjelstul_match(row, config, coverage, team_ref("fjelstul")),
                claims,
                report,
                "fjelstul",
            )
    if raw_table_exists(connection, RAW_TABLES["martj42"]):
        claims.extend(read_martj42_claims(connection, config, coverage, report, review_dir))

    for claim in claims:
        report.claims[claim.source] += 1
        if not claim.has_both_teams_linked:
            reason = UNRESOLVED_NAME if claim.source == "martj42" else UNLINKED_TEAM
            report.skipped[(claim.source, reason)] += 1

    def precedence_of(competition_key: str) -> tuple[str, ...]:
        return config.precedence_for(FACT_MATCH_RESULT, config.competitions[competition_key])

    unlinked_index = index_claims_with_one_unlinked_team(claims)
    rejected_index = index_claims_by_team_pair(rejected)
    matches = []
    for members in group_claims_into_matches(claims, precedence_of):
        first = members[0]
        covering = coverage.sources_covering(first.competition_key, first.match_date)
        unlinked = find_unlinked_claims_of_match(members, unlinked_index)
        rejected_sources = {c.source for c in find_rejected_claims_of_match(members, rejected_index)}
        matches.append(
            resolve_match(members, precedence_of(first.competition_key), covering, unlinked, rejected_sources)
        )
    matches.sort(key=lambda m: (m.competition_key, m.match_date, m.home_ref, m.away_ref))
    count_matches(matches, report)
    store_claims_and_matches(connection, config, claims, matches)
    return report


def add_claim_or_count_skipped_row(
    outcome: MatchClaim | str, claims: list[MatchClaim], report: MatchReport, source: str
) -> None:
    if isinstance(outcome, str):
        report.skipped[(source, outcome)] += 1
    else:
        claims.append(outcome)


def read_martj42_claims(
    connection: psycopg.Connection,
    config: MatchConfig,
    coverage: Coverage,
    report: MatchReport,
    review_dir: Path,
) -> list[MatchClaim]:
    index = build_team_name_index(load_national_team_names(connection))
    shootout_winners: dict[tuple[str, str, str], str] = {}
    if raw_table_exists(connection, "martj42__shootouts"):
        for row in read_rows(connection, "martj42__shootouts"):
            shootout_winners[(row["date"], row["home_team"], row["away_team"])] = row["winner"]
    resolutions: dict[tuple[str, date], TeamNameResolution] = {}

    def team_ref_by_name(name: str, day: date) -> str | None:
        if (name, day) not in resolutions:
            resolutions[(name, day)] = resolve_team_name(name, day, index, config.martj42_dated_names)
        return resolutions[(name, day)].ref

    claims: list[MatchClaim] = []
    unscored_days: dict[str, list[date]] = defaultdict(list)  # competition key → days of unplayed rows
    for row in read_rows(connection, RAW_TABLES["martj42"]):
        winner = shootout_winners.get((row["date"], row["home_team"], row["away_team"]))
        outcome = claim_from_martj42_result(row, config, coverage, team_ref_by_name, winner)
        if outcome == MISSING_SCORE:
            scope = check_row_is_in_scope(
                config, coverage, "martj42", row.get("tournament") or "", parse_day(row.get("date"))
            )
            if not isinstance(scope, str):
                unscored_days[scope.key].append(parse_day(row["date"]))
        add_claim_or_count_skipped_row(outcome, claims, report, "martj42")

    unresolved: dict[str, list] = {}
    for claim in claims:
        for team in (claim.home, claim.away):
            resolution = resolutions[(team.name, claim.match_date)]
            if resolution.ref is None:
                entry = unresolved.setdefault(
                    team.name, [resolution.reason, claim.tier, 0, resolution.candidates]
                )
                entry[1], entry[2] = min(entry[1], claim.tier), entry[2] + 1
    review_rows = []
    for name, (reason, tier, count, candidates) in unresolved.items():
        report.unresolved_names[name] = (reason, tier, count, " ".join(candidates))
        review_rows.append(
            {
                "source_kind": "NATIONAL_TEAM",
                "source_id": name,
                "tier": str(tier),
                "name": name,
                "lookup_key": name,
                "reason": reason,
                "entity_ref": " ".join(candidates),
                "detail": f"{count} in-scope match rows skipped",
            }
        )
    write_link_review_file("martj42", review_rows, review_dir)

    # Finals from the last match of each edition, over every in-scope row (linked or not).
    inferred = infer_finals_from_last_match(claims, unscored_days)
    report.inferred_finals = sum(1 for claim in inferred if claim.stage_inferred)
    return inferred


def count_matches(matches: list[ResolvedMatch], report: MatchReport) -> None:
    for match in matches:
        report.matches[(match.tier, match.status)] += 1
        if match.usable:
            report.usable[match.tier] += 1
        primary = match.claims[0]
        label = f"{match.match_date} {match.competition_key} {match.home_name} – {match.away_name}"
        for first, second in pairs_of_claims(match.claims):
            pair = report.pairs[tuple(sorted((first.source, second.source)))]
            pair.shared += 1
            if first.home.ref != second.home.ref:
                pair.swapped += 1
            a, b = result_from_home_side_of(first, primary), result_from_home_side_of(second, primary)
            if not results_agree(a, b):
                pair.disagreeing += 1
                if len(pair.examples) < EXAMPLES_PER_PAIR:
                    pair.examples.append(
                        f"{label}: {first.source} {format_result_for_report(a)} vs {second.source} {format_result_for_report(b)}"
                    )
        if match.status == SINGLE_SOURCE:
            for source in match.missing_from:
                report.missing[source] += 1
                if len(report.missing_examples[source]) < EXAMPLES_PER_PAIR:
                    report.missing_examples[source].append(f"{label} (only {match.sources[0]})")
            for source in match.rejected_in:
                report.rejected[source] += 1
                if len(report.rejected_examples[source]) < EXAMPLES_PER_PAIR:
                    report.rejected_examples[source].append(f"{label} (only {match.sources[0]})")
            for source in match.unlinked_in:
                report.unlinked[source] += 1
                if len(report.unlinked_examples[source]) < EXAMPLES_PER_PAIR:
                    report.unlinked_examples[source].append(f"{label} (only {match.sources[0]} links it)")
        inferred = [c for c in match.claims if c.stage_inferred]
        stated = [c.stage for c in match.claims if c.stage and not c.stage_inferred]
        if inferred and stated:
            if stated[0] == "FINAL":
                report.inferred_finals_confirmed += 1
            else:
                report.inferred_finals_contradicted.append(f"{label}: stated {stated[0]}")


def pairs_of_claims(claims: list[MatchClaim]):
    for i, first in enumerate(claims):
        for second in claims[i + 1 :]:
            yield first, second


def format_result_for_report(result) -> str:
    text = f"{result.home_goals}-{result.away_goals}"
    if result.extra_time:
        text += " aet"
    if result.shootout:
        kicks = f"{result.shootout.home}-{result.shootout.away} " if result.shootout.home is not None else ""
        text += f" ({kicks}pens {result.shootout.winner})"
    return text


SCORE_REVIEW_COLUMNS = [
    "game_id", "date", "competition_id", "round", "home_club_id", "home_club_name", "away_club_id",
    "away_club_name", "stored_score", "event_goals", "shootout_kicks_scored", "reason",
]  # fmt: skip


def transfermarkt_score_review_row(row: dict, events: TransfermarktEvents, reason: str) -> dict[str, str]:
    """One refused Transfermarkt row with what its events say, for curation (kb_overrides later)."""
    home, away, game = row.get("home_club_id") or "", row.get("away_club_id") or "", row["game_id"]
    goals = events.goal_events.get(game, {})
    kicks = events.kicks.get(game, {})
    return {
        "game_id": game,
        "date": row.get("date") or "",
        "competition_id": row.get("competition_id") or "",
        "round": row.get("round") or "",
        "home_club_id": home,
        "home_club_name": row.get("home_club_name") or "",
        "away_club_id": away,
        "away_club_name": row.get("away_club_name") or "",
        "stored_score": f"{row.get('home_club_goals')}-{row.get('away_club_goals')}",
        "event_goals": f"{goals.get(home, 0)}-{goals.get(away, 0)}",
        "shootout_kicks_scored": f"{kicks.get(home, (0, 0))[0]}-{kicks.get(away, (0, 0))[0]}",
        "reason": reason,
    }


def write_transfermarkt_score_review_file(rows: list[dict[str, str]], out_dir: Path) -> Path:
    """`.out/review-transfermarkt-scores.csv`: in-scope rows refused because their events contradict them."""
    path = out_dir / "review-transfermarkt-scores.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=SCORE_REVIEW_COLUMNS)
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda r: (r["reason"], r["date"], r["game_id"])))
    return path


# ---- reading ----


def raw_table_exists(connection: psycopg.Connection, table: str) -> bool:
    return connection.execute("SELECT to_regclass(%s) IS NOT NULL", (f"raw.{table}",)).fetchone()[0]


def read_rows(connection: psycopg.Connection, table: str) -> list[dict]:
    with connection.cursor(row_factory=dict_row) as cursor:
        return cursor.execute(f"SELECT * FROM raw.{table}").fetchall()  # table names are our constants


def load_last_match_date_per_competition(
    connection: psycopg.Connection, config: MatchConfig
) -> dict[tuple[str, str], date]:
    """(source, competition key) → the source's last match date there, for windows that end at "latest"."""
    queries = {
        "transfermarkt": "SELECT competition_id, max(left(date, 10)) FROM raw.transfermarkt__games",
        "fjelstul": "SELECT tournament_id, max(left(match_date, 10)) FROM raw.fjelstul__matches",
        "martj42": "SELECT tournament, max(left(date, 10)) FROM raw.martj42__results",
    }
    column = {"transfermarkt": "date", "fjelstul": "match_date", "martj42": "date"}
    last: dict[tuple[str, str], date] = {}
    for source, query in queries.items():
        if not raw_table_exists(connection, RAW_TABLES[source]):
            continue
        valid_date = f" WHERE {column[source]} ~ '^\\d{{4}}-\\d{{2}}-\\d{{2}}' GROUP BY 1"
        for competition_id, value in connection.execute(query + valid_date):
            competition = config.competition_of_source_id(source, competition_id or "")
            if competition is None or not value:
                continue
            key, day = (source, competition.key), date.fromisoformat(value)
            last[key] = max(last.get(key, day), day)
    return last


def load_team_refs(connection: psycopg.Connection) -> dict[tuple[str, str, str], str]:
    rows = connection.execute(
        """SELECT source, source_kind, source_id, entity_ref FROM core.entity_xref
           WHERE source_kind IN ('CLUB', 'NATIONAL_TEAM')"""
    ).fetchall()
    return {(source, kind, source_id): ref for source, kind, source_id, ref in rows}


def load_transfermarkt_events(connection: psycopg.Connection) -> TransfermarktEvents:
    if not raw_table_exists(connection, "transfermarkt__game_events"):
        return TransfermarktEvents({}, set(), set(), {})
    kicks: dict[str, dict[str, tuple[int, int]]] = defaultdict(dict)
    for game_id, club_id, scored, taken in connection.execute(
        """SELECT game_id, club_id, count(*) FILTER (WHERE description ILIKE '%%scored%%'), count(*)
           FROM raw.transfermarkt__game_events WHERE type = 'Shootout' GROUP BY 1, 2"""
    ):
        kicks[game_id][club_id] = (scored, taken)
    extra_time = {
        row[0]
        for row in connection.execute(
            """SELECT DISTINCT game_id FROM raw.transfermarkt__game_events
               WHERE type <> 'Shootout' AND minute ~ '^[0-9]+$' AND minute::int > 90"""
        )
    }
    with_events = {
        row[0] for row in connection.execute("SELECT DISTINCT game_id FROM raw.transfermarkt__game_events")
    }
    goal_events: dict[str, dict[str, int]] = defaultdict(dict)
    for game_id, club_id, count in connection.execute(
        "SELECT game_id, club_id, count(*) FROM raw.transfermarkt__game_events WHERE type = 'Goals' GROUP BY 1, 2"
    ):
        goal_events[game_id][club_id] = count
    return TransfermarktEvents(dict(kicks), extra_time, with_events, dict(goal_events))


def load_national_team_names(connection: psycopg.Connection) -> list[tuple[str, str]]:
    """(entity ref, name) for every linked national team: Fjelstul and Transfermarkt names, Wikidata labels."""
    names: list[tuple[str, str]] = []
    if raw_table_exists(connection, "fjelstul__teams"):
        names += connection.execute(
            """SELECT x.entity_ref, t.team_name FROM core.entity_xref x
               JOIN raw.fjelstul__teams t ON t.team_id = x.source_id
               WHERE x.source = 'fjelstul' AND x.source_kind = 'NATIONAL_TEAM' AND t.team_name IS NOT NULL"""
        ).fetchall()
    if raw_table_exists(connection, "transfermarkt__national_teams"):
        names += connection.execute(
            """SELECT x.entity_ref, t.name FROM core.entity_xref x
               JOIN raw.transfermarkt__national_teams t ON t.national_team_id = x.source_id
               WHERE x.source = 'transfermarkt' AND x.source_kind = 'NATIONAL_TEAM' AND t.name IS NOT NULL"""
        ).fetchall()
    if raw_table_exists(connection, "transfermarkt__games"):
        names += connection.execute(
            """SELECT DISTINCT x.entity_ref, g.name FROM core.entity_xref x
               JOIN (SELECT home_club_id AS team_id, home_club_name AS name FROM raw.transfermarkt__games
                     WHERE competition_type = 'national_team_competition'
                     UNION SELECT away_club_id, away_club_name FROM raw.transfermarkt__games
                     WHERE competition_type = 'national_team_competition') g ON g.team_id = x.source_id
               WHERE x.source = 'transfermarkt' AND x.source_kind = 'NATIONAL_TEAM' AND g.name IS NOT NULL"""
        ).fetchall()
    for ref, label in connection.execute(
        """SELECT n.external_ref, n.name FROM core.entity_name n JOIN core.entity e USING (external_ref)
           WHERE e.kind = 'NATIONAL_TEAM' AND n.locale = 'en'"""
    ):
        short = short_name_from_wikidata_label(label)
        if short:
            names.append((ref, short))
    return names


def load_latest_snapshots(connection: psycopg.Connection) -> dict[str, tuple[int, str]]:
    """raw table (without schema) → (snapshot id, licence) of the file loaded into it last."""
    rows = connection.execute(
        """SELECT DISTINCT ON (raw_table) raw_table, id, license FROM raw.source_snapshot
           ORDER BY raw_table, loaded_at DESC, id DESC"""
    ).fetchall()
    return {table.removeprefix("raw."): (snapshot_id, license) for table, snapshot_id, license in rows}


# ---- storing ----


def store_claims_and_matches(
    connection: psycopg.Connection,
    config: MatchConfig,
    claims: list[MatchClaim],
    matches: list[ResolvedMatch],
) -> None:
    """Swap the match-result claims and the match tables in one transaction."""
    snapshots = load_latest_snapshots(connection)
    editions, edition_keys = assign_editions(matches, config.competitions)
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM core.claim WHERE fact_type = %s", (FACT_MATCH_RESULT,))
        cursor.execute("TRUNCATE core.goal, core.match, core.edition, core.competition RESTART IDENTITY")
        with cursor.copy(
            """COPY core.claim (source, source_row_id, snapshot_id, fact_type, fact_key, value, license)
               FROM STDIN"""
        ) as copy:
            copy.set_types(["text", "text", "int8", "text", "text", "jsonb", "text"])
            for claim in claims:
                snapshot_id, license = snapshots[RAW_TABLES[claim.source]]
                copy.write_row(
                    (
                        claim.source,
                        claim.source_row_id,
                        snapshot_id,
                        FACT_MATCH_RESULT,
                        claim.fact_key(),
                        Jsonb(claim.value()),
                        license,
                    )
                )
        claim_id = {
            (source, row_id): claim_id
            for claim_id, source, row_id in cursor.execute(
                "SELECT id, source, source_row_id FROM core.claim WHERE fact_type = %s", (FACT_MATCH_RESULT,)
            ).fetchall()
        }
        license_of_source = {
            source: snapshots[table][1] for source, table in RAW_TABLES.items() if table in snapshots
        }
        cursor.executemany(
            """INSERT INTO core.competition (competition_ref, key, name_en, name_ar, kind, tier)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            [(c.ref, c.key, c.name_en, c.name_ar, c.kind, c.tier) for c in config.competitions.values()],
        )
        edition_id = {}
        for edition in editions:
            competition = config.competitions[edition.competition_key]
            edition_id[(edition.competition_key, edition.season_label)] = cursor.execute(
                """INSERT INTO core.edition (competition_ref, season_label, final_year) VALUES (%s, %s, %s)
                   RETURNING id""",
                (competition.ref, edition.season_label, edition.final_year),
            ).fetchone()[0]
        with cursor.copy(
            """COPY core.match (edition_id, stage, leg, match_date, home_team_ref, away_team_ref, home_goals,
                 away_goals, extra_time, shootout_home, shootout_away, shootout_winner_ref, status, usable, sources,
                 licenses, missing_from, claim_ids, conflict, shootout_known, unlinked_in, rejected_in) FROM STDIN"""
        ) as copy:
            copy.set_types(
                ["int8", "text", "int2", "date", "text", "text", "int2", "int2", "bool", "int2", "int2", "text",
                 "text", "bool", "text[]", "text[]", "text[]", "int8[]", "jsonb", "bool", "text[]", "text[]"]
            )  # fmt: skip
            for match, key in zip(matches, edition_keys, strict=True):
                copy.write_row(
                    (
                        edition_id[key],
                        match.stage,
                        match.leg,
                        match.match_date,
                        match.home_ref,
                        match.away_ref,
                        match.home_goals,
                        match.away_goals,
                        match.extra_time,
                        match.shootout_home,
                        match.shootout_away,
                        match.shootout_winner_ref,
                        match.status,
                        match.usable,
                        match.sources,
                        sorted({license_of_source[source] for source in match.sources}),
                        match.missing_from,
                        [claim_id[(c.source, c.source_row_id)] for c in match.claims],
                        Jsonb(match.conflict) if match.conflict else None,
                        match.shootout_known,
                        match.unlinked_in,
                        match.rejected_in,
                    )
                )
