"""`kb ingest:matches` on small raw fixtures: VERIFIED, SINGLE_SOURCE, CONFLICT, coverage silence, DEC-67,
Transfermarkt rows checked against their events, inferred finals and unlinked covering sources."""

import csv
import os
from pathlib import Path

import pytest
from linking_fixtures import load_raw_source_files

TM_GAME_COLUMNS = (
    "game_id,competition_id,season,round,date,home_club_id,away_club_id,home_club_goals,away_club_goals,"
    "home_club_name,away_club_name,competition_type\n"
)
TRANSFERMARKT_FILES = {
    "games.csv": TM_GAME_COLUMNS
    # 2006 World Cup final: 6-4 includes the 5-3 shootout. Fjelstul and martj42 have it too → VERIFIED.
    + "1,FIWC,2005,Final,2006-07-09,3376,3377,6,4,Italy,France,national_team_competition\n"
    # Euro 2016 final: martj42 lists the host France first → swapped, VERIFIED.
    + "2,EURO,2015,Final,2016-07-10,3300,3377,1,0,Portugal,France,national_team_competition\n"
    # Champions League 2016 final: only Transfermarkt covers club matches → SINGLE_SOURCE.
    + "3,CL,2015,Final,2016-05-28,418,13,6,4,Real Madrid,Atlético de Madrid,international_cup\n"
    # Euro 2024: martj42 says 5-0 → CONFLICT.
    + "4,EURO,2023,Group A,2024-06-14,3262,3299,5,1,Germany,Scotland,national_team_competition\n"
    # DEC-67 and coverage: a qualifier, a 2011 league game (before Transfermarkt's club window), tier 3.
    + "5,CL,2016,Qualifying Round 1st leg,2016-07-12,418,13,1,0,Real Madrid,Atlético de Madrid,international_cup\n"
    + "6,GB1,2011,1. Matchday,2011-08-13,631,13,1,1,Chelsea,Atlético de Madrid,domestic_league\n"
    + "7,TR1,2016,1. Matchday,2016-08-13,631,13,1,1,Chelsea,Atlético de Madrid,domestic_league\n"
    # A club without a link: a claim, never a match.
    + "8,GB1,2012,1. Matchday,2012-08-18,631,999,2,0,Chelsea,Unlinked Town,domestic_league\n"
    # Rows that disagree with their own events (found 2026-11-18), never claims: the Europa League final
    # 2014 stored 4-2 for 0-0 and 4-2 on penalties with no events; Arsenal-Porto 2024 stored 4-2 although
    # the 4-2 shootout is in the events (really 1-0 after extra time).
    + "9,EL,2013,Final,2014-05-14,418,13,4,2,Sevilla,Benfica,other\n"
    + "10,CL,2023,last 16 2nd leg,2024-03-12,631,13,4,2,Arsenal,Porto,international_cup\n"
    # Stored 0-2 with events 1-1 (the shape of the awarded Union Berlin-Bochum 2024-12-14): refused, and the
    # martj42 match it would have checked is not usable until the row is reviewed.
    + "11,EURO,2023,Group A,2024-06-23,3299,3262,0,2,Scotland,Germany,national_team_competition\n",
    "game_events.csv": "game_id,minute,type,club_id,description\n"
    + "1,7,Goals,3377,\n1,19,Goals,3376,\n1,110,Cards,3377,Red card\n"
    + "".join(f"1,-1,Shootout,3376,{'Scored'}\n" for _ in range(5))
    + "1,-1,Shootout,3377,Scored\n" * 3
    + "1,-1,Shootout,3377,Missed\n"
    + "2,109,Goals,3300,\n"
    + "3,15,Goals,418,\n3,79,Goals,13,\n3,93,Cards,418,\n"
    + "3,-1,Shootout,418,Scored\n" * 5
    + "3,-1,Shootout,13,Scored\n" * 3
    + "3,-1,Shootout,13,Missed\n"
    + "4,10,Goals,3262,\n" * 5
    + "4,87,Goals,3299,\n"
    + "8,10,Goals,631,\n8,20,Goals,631,\n"
    + "10,105,Goals,631,\n"
    + "11,30,Goals,3299,\n11,60,Goals,3262,\n"
    + "10,-1,Shootout,631,Scored\n" * 4
    + "10,-1,Shootout,13,Scored\n" * 2,
    "national_teams.csv": "national_team_id,name\n3376,Italy\n3377,France\n",
}
FJELSTUL_FILES = {
    "matches.csv": "tournament_id,tournament_name,match_id,stage_name,match_date,home_team_id,home_team_name,"
    "away_team_id,away_team_name,home_team_score,away_team_score,extra_time,penalty_shootout,"
    "home_team_score_penalties,away_team_score_penalties\n"
    "WC-2006,2006 FIFA Men's World Cup,M-2006-64,final,2006-07-09,T-35,Italy,T-28,France,1,1,1,1,5,3\n"
    "WC-1998,1998 FIFA Men's World Cup,M-1998-64,final,1998-07-12,T-11,Brazil,T-28,France,0,3,0,0,0,0\n"
    # Fjelstul has this match, but its Sweden is not linked.
    "WC-2002,2002 FIFA Men's World Cup,M-2002-01,group stage,2002-06-02,T-27,England,T-73,Sweden,1,1,0,0,0,0\n",
    "teams.csv": "team_id,team_name\nT-35,Italy\nT-28,France\nT-27,England\nT-73,Sweden\n",
}
MARTJ42_FILES = {
    "results.csv": "date,home_team,away_team,home_score,away_score,tournament,city,country,neutral\n"
    "2006-07-09,Italy,France,1,1,FIFA World Cup,Berlin,Germany,TRUE\n"
    "2016-07-10,France,Portugal,0,1,UEFA Euro,Saint-Denis,France,FALSE\n"
    "2024-06-14,Germany,Scotland,5,0,UEFA Euro,Munich,Germany,FALSE\n"
    # Only martj42 covers AFCON 2017. The last match is the final: both teams won their semi-final (Egypt on
    # penalties), even though Burkina Faso and Ghana are not linked.
    "2017-02-01,Burkina Faso,Egypt,1,1,African Cup of Nations,Libreville,Gabon,TRUE\n"
    "2017-02-02,Cameroon,Ghana,2,0,African Cup of Nations,Franceville,Gabon,TRUE\n"
    "2017-02-05,Egypt,Cameroon,1,2,African Cup of Nations,Libreville,Gabon,TRUE\n"
    "2002-06-02,England,Sweden,1,1,FIFA World Cup,Saitama,Japan,TRUE\n"
    "2024-06-23,Scotland,Germany,0,2,UEFA Euro,Stuttgart,Germany,TRUE\n"
    # Fjelstul and Transfermarkt cover the 2022 World Cup but lack this match: SINGLE_SOURCE, not usable.
    "2022-12-18,Argentina,France,3,3,FIFA World Cup,Lusail,Qatar,TRUE\n"
    # After both windows end: only martj42 speaks, and that is enough.
    "2026-07-19,Argentina,Italy,1,0,FIFA World Cup,East Rutherford,United States,TRUE\n"
    "2021-03-24,Italy,France,1,0,FIFA World Cup qualification,Rome,Italy,FALSE\n"
    "2021-06-01,Italy,France,1,0,Friendly,Rome,Italy,FALSE\n"
    "2019-06-30,Atlantis,Egypt,0,2,African Cup of Nations,Cairo,Egypt,TRUE\n",
    "shootouts.csv": "date,home_team,away_team,winner,first_shooter\n"
    "2006-07-09,Italy,France,Italy,Italy\n2022-12-18,Argentina,France,Argentina,France\n"
    "2017-02-01,Burkina Faso,Egypt,Egypt,Egypt\n",
}
NATIONAL_TEAMS = {
    "wikidata:Q676899": "Italy national football team",
    "wikidata:Q47774": "France national football team",
    "wikidata:Q267245": "Portugal national football team",
    "wikidata:Q43310": "Germany national football team",
    "wikidata:Q34044": "Scotland national football team",
    "wikidata:Q79": "Egypt national football team",
    "wikidata:Q1": "Cameroon national football team",
    "wikidata:Q2": "Argentina men's national football team",
    "wikidata:Q47762": "England national football team",
    "wikidata:Q34027": "Sweden national football team",
}
CLUBS = ("wikidata:Q8682", "wikidata:Q8701", "wikidata:Q9616")
XREF = [
    ("transfermarkt", "NATIONAL_TEAM", "3376", "wikidata:Q676899"),
    ("transfermarkt", "NATIONAL_TEAM", "3377", "wikidata:Q47774"),
    ("transfermarkt", "NATIONAL_TEAM", "3300", "wikidata:Q267245"),
    ("transfermarkt", "NATIONAL_TEAM", "3262", "wikidata:Q43310"),
    ("transfermarkt", "NATIONAL_TEAM", "3299", "wikidata:Q34044"),
    ("transfermarkt", "CLUB", "418", "wikidata:Q8682"),
    ("transfermarkt", "CLUB", "13", "wikidata:Q8701"),
    ("transfermarkt", "CLUB", "631", "wikidata:Q9616"),
    ("fjelstul", "NATIONAL_TEAM", "T-35", "wikidata:Q676899"),
    ("fjelstul", "NATIONAL_TEAM", "T-28", "wikidata:Q47774"),
    ("fjelstul", "NATIONAL_TEAM", "T-27", "wikidata:Q47762"),
    ("transfermarkt", "NATIONAL_TEAM", "3557", "wikidata:Q34027"),
]


def kb_url() -> str:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    return url


def load_fixture_entities(connection) -> None:
    connection.execute("TRUNCATE core.entity CASCADE")
    for ref in NATIONAL_TEAMS:
        connection.execute(
            "INSERT INTO core.entity (external_ref, kind, origin) VALUES (%s, 'NATIONAL_TEAM', 'LINKED')",
            (ref,),
        )
    for ref in CLUBS:
        connection.execute("INSERT INTO core.entity (external_ref, kind) VALUES (%s, 'CLUB')", (ref,))
    for ref, label in NATIONAL_TEAMS.items():
        connection.execute(
            "INSERT INTO core.entity_name (external_ref, locale, name, name_kind, source) VALUES (%s, 'en', %s, 'LABEL', 'wikidata')",
            (ref, label),
        )
    for source, kind, source_id, ref in XREF:
        connection.execute(
            "INSERT INTO core.entity_xref (source, source_kind, source_id, entity_ref, method) VALUES (%s, %s, %s, %s, 'WIKIDATA_ID')",
            (source, kind, source_id, ref),
        )
    connection.commit()


def read_matches(connection) -> dict[tuple[str, str], tuple]:
    rows = connection.execute(
        """SELECT m.match_date::text, c.key, m.status, m.usable, m.sources, m.missing_from, m.home_team_ref,
                  m.home_goals, m.away_goals, m.extra_time, m.shootout_home, m.shootout_away, m.shootout_winner_ref,
                  m.stage, e.season_label, m.licenses, cardinality(m.claim_ids), m.conflict, m.shootout_known,
                  m.unlinked_in, m.rejected_in
           FROM core.match m JOIN core.edition e ON e.id = m.edition_id
           JOIN core.competition c ON c.competition_ref = e.competition_ref"""
    ).fetchall()
    return {(row[0], row[1]): row[2:] for row in rows}


@pytest.mark.db
def test_ingest_matches_resolves_claims_from_three_sources(tmp_path: Path) -> None:
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.matches import ingest_matches

    with connect_to_knowledge_base(kb_url()) as connection:
        apply_pending_migrations(connection)
        connection.commit()
        load_raw_source_files(connection, "transfermarkt", TRANSFERMARKT_FILES, tmp_path)
        load_raw_source_files(connection, "fjelstul", FJELSTUL_FILES, tmp_path)
        load_raw_source_files(connection, "martj42", MARTJ42_FILES, tmp_path)
        load_fixture_entities(connection)

        report = ingest_matches(connection, review_dir=tmp_path)
        matches = read_matches(connection)

        italy, france, real_madrid = "wikidata:Q676899", "wikidata:Q47774", "wikidata:Q8682"
        final_2006 = matches[("2006-07-09", "world-cup")]
        assert final_2006[:5] == ("VERIFIED", True, ["fjelstul", "transfermarkt", "martj42"], [], italy)
        assert final_2006[5:12] == (1, 1, True, 5, 3, italy, "FINAL")
        assert final_2006[12] == "2006" and final_2006[14] == 3
        assert final_2006[13] == ["test"]  # the fixtures' licence, once

        euro_2016 = matches[("2016-07-10", "euro")]
        assert euro_2016[:5] == ("VERIFIED", True, ["martj42", "transfermarkt"], [], france)
        assert euro_2016[5:8] == (0, 1, True) and euro_2016[12] == "2016"

        ucl_2016 = matches[("2016-05-28", "champions-league")]
        assert ucl_2016[:5] == ("SINGLE_SOURCE", True, ["transfermarkt"], [], real_madrid)
        assert ucl_2016[5:12] == (1, 1, True, 5, 3, real_madrid, "FINAL") and ucl_2016[12] == "2015-16"

        conflict = matches[("2024-06-14", "euro")]
        assert conflict[:3] == ("CONFLICT", False, ["martj42", "transfermarkt"])
        assert conflict[5:7] == (5, 0)  # provisional: martj42 first for national-team results
        assert conflict[15]["transfermarkt"]["away_goals"] == 1

        afcon = matches[("2017-02-05", "africa-cup-of-nations")]
        assert afcon[:4] == ("SINGLE_SOURCE", True, ["martj42"], [])
        assert afcon[11] == "FINAL"  # inferred from the semi-finals
        assert afcon[16] is False  # martj42 has no shootout row for it: unknown, not "none"

        lacking = matches[("2022-12-18", "world-cup")]
        # Transfermarkt's World Cup window ends at its last row there (2006-07-09 in these fixtures).
        assert lacking[:4] == ("SINGLE_SOURCE", False, ["martj42"], ["fjelstul"])
        assert lacking[16] is True
        assert lacking[8:11] == (None, None, "wikidata:Q2")  # martj42 knows only the shootout winner

        silent_window = matches[("2026-07-19", "world-cup")]
        assert silent_window[:4] == ("SINGLE_SOURCE", True, ["martj42"], [])

        sweden = matches[("2002-06-02", "world-cup")]
        assert sweden[:4] == ("SINGLE_SOURCE", True, ["martj42"], []) and sweden[17] == ["fjelstul"]

        refused = matches[("2024-06-23", "euro")]
        assert refused[:4] == ("SINGLE_SOURCE", False, ["martj42"], []) and refused[18] == ["transfermarkt"]

        assert len(matches) == 9
        usable = connection.execute(
            "SELECT count(*), count(*) FILTER (WHERE status = 'CONFLICT') FROM core.usable_match"
        ).fetchone()
        assert usable == (6, 0)

        assert report.skipped[("transfermarkt", "EXCLUDED_ROUND")] == 1
        assert report.skipped[("transfermarkt", "OUTSIDE_COVERAGE")] == 1
        assert report.skipped[("transfermarkt", "OUTSIDE_TIERS")] == 1
        assert report.skipped[("transfermarkt", "UNLINKED_TEAM")] == 1
        assert report.skipped[("transfermarkt", "NO_GOAL_EVENTS")] == 1
        assert report.skipped[("transfermarkt", "SCORE_DISAGREES_WITH_EVENTS")] == 2
        assert report.rejected["transfermarkt"] == 1 and "transfermarkt" not in report.missing
        assert report.skipped[("fjelstul", "UNLINKED_TEAM")] == 1
        assert report.unlinked["fjelstul"] == 1 and report.missing["fjelstul"] == 1
        assert report.skipped[("fjelstul", "BEFORE_FIRST_DATE")] == 1
        assert report.skipped[("martj42", "EXCLUDED_TOURNAMENT")] == 2
        assert report.skipped[("martj42", "UNRESOLVED_NAME")] == 3
        assert report.pairs[("martj42", "transfermarkt")].disagreeing == 1
        assert report.pairs[("martj42", "transfermarkt")].swapped == 1

        # Every in-scope row is a claim, linked or not; nothing out of scope is.
        claims = dict(
            connection.execute(
                "SELECT source, count(*) FROM core.claim WHERE fact_type = 'MATCH_RESULT' GROUP BY 1"
            ).fetchall()
        )
        assert claims == {"transfermarkt": 5, "fjelstul": 2, "martj42": 11}
        assert connection.execute(
            "SELECT fact_key FROM core.claim WHERE source = 'transfermarkt' AND source_row_id = '8'"
        ).fetchone() == ("premier-league|2012-08-18|wikidata:Q9616|?transfermarkt:999",)

        with (tmp_path / "link-review-martj42.csv").open(encoding="utf-8", newline="") as file:
            review = [(row["source_id"], row["reason"]) for row in csv.DictReader(file)]
        assert review == [
            ("Atlantis", "NO_LINKED_TEAM"),
            ("Burkina Faso", "NO_LINKED_TEAM"),
            ("Ghana", "NO_LINKED_TEAM"),
        ]

        with (tmp_path / "review-transfermarkt-scores.csv").open(encoding="utf-8", newline="") as file:
            scores = [
                (r["game_id"], r["stored_score"], r["event_goals"], r["reason"]) for r in csv.DictReader(file)
            ]
        assert scores == [
            ("9", "4-2", "0-0", "NO_GOAL_EVENTS"),
            ("10", "4-2", "1-0", "SCORE_DISAGREES_WITH_EVENTS"),
            ("11", "0-2", "1-1", "SCORE_DISAGREES_WITH_EVENTS"),
        ]

        # A rerun gives the same tables.
        ingest_matches(connection, review_dir=tmp_path)
        assert read_matches(connection) == matches
