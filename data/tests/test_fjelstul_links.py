import csv
import os
from pathlib import Path

import pytest
from linking_fixtures import ENTITY, WIKI, FakeWikidata, load_raw_source_files

from kb.fjelstul_links import (
    ArticleMatches,
    LinkCandidate,
    group_article_matches_from_rows,
    normalize_wikipedia_article_url,
    plan_wikipedia_links,
)
from kb.linking import can_link_to_entity_of_kind, load_competition_tiers


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (WIKI + "N%27Golo_Kant%C3%A9", WIKI + "N%27Golo_Kant%C3%A9"),  # already as Wikidata stores it
        (WIKI + "N'Golo_Kanté", WIKI + "N%27Golo_Kant%C3%A9"),  # raw apostrophe and accent
        (WIKI + "Kylian_Mbapp%c3%a9", WIKI + "Kylian_Mbapp%C3%A9"),  # lower-case hex
        ("http://en.m.wikipedia.org/wiki/Samuel_Eto'o/", WIKI + "Samuel_Eto%27o"),  # http, mobile, slash
        ("https://EN.wikipedia.org/wiki/Lionel Messi", WIKI + "Lionel_Messi"),  # host case, space
        (WIKI + "lionel__Messi", WIKI + "Lionel_Messi"),  # first letter, doubled underscore
        (WIKI + "Ronaldo_%28Brazilian_footballer%29", WIKI + "Ronaldo_(Brazilian_footballer)"),
        (WIKI + "Australia_men's_national_soccer_team", WIKI + "Australia_men%27s_national_soccer_team"),
        (WIKI + "Bosnia_and_Herzegovina", WIKI + "Bosnia_and_Herzegovina"),
        (WIKI + "Trinidad_%26_Tobago", WIKI + "Trinidad_%26_Tobago"),
        (
            "https://fr.wikipedia.org/wiki/Zin%C3%A9dine_Zidane",
            "https://fr.wikipedia.org/wiki/Zin%C3%A9dine_Zidane",
        ),
    ],
)
def test_wikipedia_links_are_written_the_way_wikidata_stores_them(url: str, expected: str) -> None:
    assert normalize_wikipedia_article_url(url) == expected


@pytest.mark.parametrize(
    "url",
    [
        None,
        "",
        "not applicable",
        "https://example.org/wiki/Lionel_Messi",
        "https://en.wikipedia.org/w/index.php?title=Lionel_Messi",
        WIKI + "Lionel_Messi#International_career",  # a section, not an article about one thing
        WIKI,
        "ftp://en.wikipedia.org/wiki/Lionel_Messi",
    ],
)
def test_anything_but_an_article_url_is_not_normalized(url: str | None) -> None:
    assert normalize_wikipedia_article_url(url) is None


def test_the_project_tiers_list_the_mens_world_cups_from_2000() -> None:
    assert load_competition_tiers("fjelstul") == {
        "WC-2002": 1,
        "WC-2006": 1,
        "WC-2010": 1,
        "WC-2014": 1,
        "WC-2018": 1,
        "WC-2022": 1,
    }


def test_a_coach_may_be_a_known_player_but_nothing_else_mixes() -> None:
    assert can_link_to_entity_of_kind("COACH", "PLAYER")
    assert can_link_to_entity_of_kind("COACH", "COACH")
    assert not can_link_to_entity_of_kind("PLAYER", "COACH")
    assert not can_link_to_entity_of_kind("COACH", "CLUB")
    assert not can_link_to_entity_of_kind("NATIONAL_TEAM", "COUNTRY")


def matches_for(*items: tuple[str, str, str]) -> ArticleMatches:
    """(article title, qid, class) rows, as the Wikidata query returns them."""
    return group_article_matches_from_rows(
        {"article": WIKI + title, "item": ENTITY + qid, "sitelinks": "50", "class": ENTITY + cls}
        for title, qid, cls in items
    )


def test_a_new_person_who_is_player_and_coach_becomes_one_player_entity() -> None:
    plan = plan_wikipedia_links(
        [
            LinkCandidate("COACH", "M-1", 1, "Didier Deschamps", WIKI + "Didier_Deschamps"),
            LinkCandidate("PLAYER", "P-1", 1, "Didier Deschamps", WIKI + "Didier_Deschamps"),
        ],
        matches_for(("Didier_Deschamps", "Q190164", "Q5")),
        existing_kinds={},
    )
    assert plan.new_entities == {"wikidata:Q190164": {"kind": "PLAYER", "sitelinks": 50, "birth_year": None}}
    assert sorted(plan.links) == [("COACH", "M-1", "wikidata:Q190164"), ("PLAYER", "P-1", "wikidata:Q190164")]
    assert plan.report.review_rows == []


def test_kind_clash_wrong_type_ambiguous_and_missing_links_are_left_for_review() -> None:
    matches = matches_for(
        ("Aliou_Ciss%C3%A9", "Q311042", "Q5"),
        ("Sweden_national_football_team", "Q127925698", "Q4167410"),  # a disambiguation page
        ("Twice", "Q1", "Q5"),
        ("Twice", "Q2", "Q5"),
    )
    plan = plan_wikipedia_links(
        [
            LinkCandidate("PLAYER", "P-6", 1, "Aliou Cissé", WIKI + "Aliou_Ciss%C3%A9"),
            LinkCandidate("NATIONAL_TEAM", "T-9", 1, "Sweden", WIKI + "Sweden_national_football_team"),
            LinkCandidate("PLAYER", "P-8", 1, "Twice", WIKI + "Twice"),
            LinkCandidate("PLAYER", "P-9", 1, "Renamed", WIKI + "Old_title"),
            LinkCandidate("PLAYER", "P-7", 1, "No link", "not applicable"),
        ],
        matches,
        existing_kinds={"wikidata:Q311042": "COACH"},  # a player link onto a known coach
    )
    assert plan.links == [] and plan.new_entities == {}
    reasons = {row["source_id"]: row["reason"] for row in plan.report.review_rows}
    assert reasons == {
        "P-6": "KIND_CLASH",
        "T-9": "WRONG_TYPE",
        "P-8": "AMBIGUOUS",
        "P-9": "NOT_ON_WIKIDATA",
        "P-7": "INVALID_LINK",
    }
    assert plan.report.seen[("PLAYER", 1)] == 4


def fjelstul_wikidata() -> FakeWikidata:
    return FakeWikidata(
        articles={
            "Didier_Deschamps": ("Q190164", "Q5"),
            "Kylian_Mbapp%C3%A9": ("Q21621995", "Q5"),
            "Antoine_Griezmann": ("Q61772", "Q5"),
            "France_national_football_team": ("Q47774", "Q135408445"),
            "Sweden_national_football_team": ("Q127925698", "Q4167410"),
            "Aliou_Ciss%C3%A9": ("Q311042", "Q5"),
            "Zin%C3%A9dine_Zidane": ("Q1835", "Q5"),
            "Ada_Hegerberg": ("Q2347937", "Q5"),
            "Hugo_Lloris": ("Q193496", "Q5"),
        },
        people={
            "Q21621995": ("1998-12-20T00:00:00Z", "Q142"),
            # Fjelstul says 1986: the article's item is someone else
            "Q193496": ("1975-01-01T00:00:00Z", None),
        },
        labels={
            "Q21621995": {"en": "Kylian Mbappé", "ar": "كيليان مبابي"},
            "Q311042": {"en": "Aliou Cissé"},
            "Q47774": {"en": "France national football team"},
            "Q193496": {"en": "Hugo Lloris"},
        },
    )


# Two men's World Cups and one women's; only the tiered men's World Cup from 2000 is in scope, even though the
# test's tier list also names the other two.
RAW_FILES = {
    "tournaments.csv": "tournament_id,tournament_name,year\n"
    "WC-1998,1998 FIFA Men's World Cup,1998\nWC-2019,2019 FIFA Women's World Cup,2019\n"
    "WC-2022,2022 FIFA Men's World Cup,2022\n",
    "players.csv": "player_id,given_name,family_name,player_wikipedia_link,birth_date\n"
    f"P-1,Didier,Deschamps,{WIKI}Didier_Deschamps,1968-10-15\n"
    f"P-2,Kylian,Mbappé,{WIKI}Kylian_Mbapp%C3%A9,1998-12-20\n"
    f"P-3,Zinedine,Zidane,{WIKI}Zin%C3%A9dine_Zidane,1972-06-23\n"
    f"P-4,Ada,Hegerberg,{WIKI}Ada_Hegerberg,1995-07-10\n"
    f"P-5,Some,One,{WIKI}Renamed_since,not available\n"
    "P-6,Antoine,Griezmann,http://en.m.wikipedia.org/wiki/Antoine_Griezmann/,1991-03-21\n"
    f"P-7,Hugo,Lloris,{WIKI}Hugo_Lloris,1986-12-26\n",
    "teams.csv": "team_id,team_name,mens_team_wikipedia_link,womens_team_wikipedia_link\n"
    f"T-1,France,{WIKI}France_national_football_team,not applicable\n"
    f"T-2,Sweden,{WIKI}Sweden_national_football_team,not applicable\n"
    f"T-3,Norway,{WIKI}Norway_national_football_team,{WIKI}Norway_women%27s_national_football_team\n",
    "managers.csv": "manager_id,given_name,family_name,manager_wikipedia_link\n"
    f"M-1,Didier,Deschamps,{WIKI}Didier_Deschamps\n"
    f"M-2,Aliou,Cissé,{WIKI}Aliou_Ciss%C3%A9\n"
    f"M-3,Aimé,Jacquet,{WIKI}Aim%C3%A9_Jacquet\n",
    "player_appearances.csv": "tournament_id,player_id\nWC-2022,P-2\nWC-2022,P-6\nWC-2022,P-7\nWC-1998,P-1\nWC-1998,P-3\n",
    "goals.csv": "tournament_id,player_id\nWC-2022,P-2\nWC-1998,P-3\n",
    "squads.csv": "tournament_id,team_id,player_id\nWC-2022,T-1,P-5\nWC-2019,T-3,P-4\n",
    "team_appearances.csv": "tournament_id,team_id\nWC-2022,T-1\nWC-2022,T-2\nWC-2019,T-3\n",
    "manager_appearances.csv": "tournament_id,manager_id\nWC-2022,M-1\nWC-2022,M-2\nWC-1998,M-3\n",
}


@pytest.mark.db
def test_fjelstul_links_players_teams_and_coaches_through_wikipedia(tmp_path: Path) -> None:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.fjelstul_links import link_fjelstul
    from kb.ingest import Snapshot
    from kb.store import replace_knowledge_base_contents

    with connect_to_knowledge_base(url) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(
            connection,
            Snapshot(
                entities={
                    # Deschamps is in the knowledge base as a player (D.1); Griezmann too.
                    "wikidata:Q190164": {"kind": "PLAYER", "sitelinks": 90, "birth_year": 1968},
                    "wikidata:Q61772": {"kind": "PLAYER", "sitelinks": 80, "birth_year": 1991},
                    "wikidata:Q142": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
                }
            ),
        )
        load_raw_source_files(connection, "fjelstul", RAW_FILES, tmp_path)

        client = fjelstul_wikidata()
        tiers = {"WC-1998": 1, "WC-2019": 1, "WC-2022": 1}
        report = link_fjelstul(connection, client, log=lambda _: None, review_dir=tmp_path, tiers=tiers)

        links = connection.execute(
            """SELECT source_kind, source_id, entity_ref, method FROM core.entity_xref
               WHERE source = 'fjelstul' ORDER BY source_kind, source_id"""
        ).fetchall()
        assert links == [
            ("COACH", "M-1", "wikidata:Q190164", "WIKIPEDIA_LINK"),  # the coach is the known player
            ("COACH", "M-2", "wikidata:Q311042", "WIKIPEDIA_LINK"),
            ("NATIONAL_TEAM", "T-1", "wikidata:Q47774", "WIKIPEDIA_LINK"),
            ("PLAYER", "P-2", "wikidata:Q21621995", "WIKIPEDIA_LINK"),
            ("PLAYER", "P-6", "wikidata:Q61772", "WIKIPEDIA_LINK"),  # http + mobile host + slash
        ]
        # The 1998 and women's World Cup people and teams are not even looked up.
        assert client.asked_articles.isdisjoint(
            {"Zin%C3%A9dine_Zidane", "Ada_Hegerberg", "Aim%C3%A9_Jacquet"}
        )

        entities = {
            ref: (kind, origin)
            for ref, kind, origin in connection.execute("SELECT external_ref, kind, origin FROM core.entity")
        }
        # The known player is not turned into, or duplicated as, a coach.
        assert entities["wikidata:Q190164"] == ("PLAYER", "SCOPE")
        assert entities["wikidata:Q311042"] == ("COACH", "LINKED")
        assert entities["wikidata:Q47774"] == ("NATIONAL_TEAM", "LINKED")
        assert entities["wikidata:Q21621995"] == ("PLAYER", "LINKED")
        assert "wikidata:Q127925698" not in entities  # Sweden's link is a disambiguation page
        assert "wikidata:Q193496" not in entities  # born 1975 on Wikidata, 1986 in Fjelstul
        assert connection.execute(
            "SELECT birth_year FROM core.entity WHERE external_ref = 'wikidata:Q21621995'"
        ).fetchone() == (1998,)
        assert connection.execute(
            "SELECT country_ref FROM core.player_country WHERE player_ref = 'wikidata:Q21621995'"
        ).fetchall() == [("wikidata:Q142",)]
        assert connection.execute(
            "SELECT name FROM core.entity_name WHERE external_ref = 'wikidata:Q21621995' AND locale = 'ar'"
        ).fetchall() == [("كيليان مبابي",)]

        assert (report.seen[("PLAYER", 1)], report.linked[("PLAYER", 1)]) == (4, 2)
        assert (report.seen[("NATIONAL_TEAM", 1)], report.linked[("NATIONAL_TEAM", 1)]) == (2, 1)
        assert (report.seen[("COACH", 1)], report.linked[("COACH", 1)]) == (2, 2)
        assert report.new_entities == 3
        with (tmp_path / "link-review-fjelstul.csv").open(encoding="utf-8", newline="") as file:
            review = {(row["source_id"], row["reason"], row["detail"]) for row in csv.DictReader(file)}
        assert review == {
            ("P-5", "NOT_ON_WIKIDATA", "redirect or renamed article?"),
            ("T-2", "WRONG_TYPE", "Q4167410"),
            ("P-7", "BIRTH_YEAR_MISMATCH", "source 1986, wikidata 1975"),
        }

        # A rerun gives the same links and adds nothing.
        again = link_fjelstul(connection, client, log=lambda _: None, review_dir=tmp_path, tiers=tiers)
        assert again.new_entities == 0
        assert (
            connection.execute(
                """SELECT source_kind, source_id, entity_ref, method FROM core.entity_xref
                   WHERE source = 'fjelstul' ORDER BY source_kind, source_id"""
            ).fetchall()
            == links
        )
