"""Shared test doubles for the linkers: a fake Wikidata client and raw source files to load."""

import re
from pathlib import Path

ENTITY = "http://www.wikidata.org/entity/"
WIKI = "https://en.wikipedia.org/wiki/"
_QID_IN_QUERY = re.compile(r"wd:(Q\d+)\b")


class FakeWikidata:
    """Answers the linkers' queries from fixed facts, only for the ids, articles and items a query names."""

    def __init__(
        self,
        transfermarkt_players: dict[str, list[str]] | None = None,  # TM player id -> qids holding it
        transfermarkt_teams: dict[str, list[str]] | None = None,  # TM team id -> qids holding it
        articles: dict[str, tuple[str, str]] | None = None,  # article title -> (qid, P31 class)
        people: dict[str, tuple[str | None, str | None]] | None = None,  # qid -> (birth date, country qid)
        labels: dict[str, dict[str, str]] | None = None,  # qid -> {locale: label}
    ) -> None:
        self.transfermarkt_players = transfermarkt_players or {}
        self.transfermarkt_teams = transfermarkt_teams or {}
        self.articles = articles or {}
        self.people = people or {}
        self.labels = labels or {}
        self.asked_articles: set[str] = set()
        self.queries: list[str] = []

    def select_rows(self, query: str) -> list[dict]:
        self.queries.append(query)
        if "wdt:P2446" in query:
            return self._external_id_rows(query, self.transfermarkt_players)
        if "wdt:P7223" in query:
            return self._external_id_rows(query, self.transfermarkt_teams)
        if "schema:about" in query:
            rows = []
            for title, (qid, cls) in self.articles.items():
                if f"<{WIKI}{title}>" in query:
                    self.asked_articles.add(title)
                    rows.append(
                        {
                            "article": WIKI + title,
                            "item": ENTITY + qid,
                            "sitelinks": "80",
                            "class": ENTITY + cls,
                        }
                    )
            return rows
        asked = set(_QID_IN_QUERY.findall(query))
        if "wdt:P569" in query:
            rows = []
            for qid, (birth, country) in self.people.items():
                if qid in asked:
                    row = {"player": ENTITY + qid}
                    if birth:
                        row["birth"] = birth
                    if country:
                        row["sportCountry"] = ENTITY + country
                    rows.append(row)
            return rows
        if "rdfs:label" in query:
            return [
                {"item": ENTITY + qid, "name": name, "name@lang": locale, "kind": "LABEL"}
                for qid, names in self.labels.items()
                if qid in asked
                for locale, name in names.items()
            ]
        raise AssertionError(f"unexpected query: {query[:80]}")

    @staticmethod
    def _external_id_rows(query: str, holders: dict[str, list[str]]) -> list[dict]:
        return [
            {"id": source_id, "item": ENTITY + qid, "sitelinks": "50"}
            for source_id, qids in holders.items()
            if f'"{source_id}"' in query
            for qid in qids
        ]


def load_raw_source_files(connection, source: str, files: dict[str, str], tmp_path: Path) -> None:
    """Load CSV texts into raw.<source>__<file>, replacing whatever an earlier test loaded."""
    from kb.sources import SourceFile, download_source_file, load_file_into_raw

    connection.execute("DELETE FROM raw.source_snapshot WHERE source = %s", (source,))
    connection.commit()
    folder = tmp_path / source
    folder.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        published = folder / name
        published.write_text(text, encoding="utf-8")
        source_file = SourceFile(source, name, published.as_uri(), "test", None)
        load_file_into_raw(connection, download_source_file(source_file, folder / "downloads"))


# Transfermarkt: game 1 is tier 1 (CL), game 2 a tier-1 national-team game (EURO), game 3 in no tier.
TRANSFERMARKT_FILES = {
    "games.csv": "game_id,competition_id,home_club_id,away_club_id,competition_type\n"
    "1,CL,418,31,international_cup\n2,EURO,3300,3299,national_team_competition\n3,XX,418,9,other\n",
    "game_lineups.csv": "game_id,player_id\n1,8198\n2,8198\n3,555\n1,164590\n1,77777\n1,12ab\n",
    "game_events.csv": "game_id,player_id,player_in_id,player_assist_id\n1,148455,,8198\n",
    "players.csv": "player_id,name,date_of_birth\n"
    "8198,Cristiano Ronaldo,1985-02-05 00:00:00\n148455,Mohamed Salah,1992-06-15 00:00:00\n"
    "164590,Yazeed Al-Bakr,1996-01-01 00:00:00\n77777,Young Namesake,2001-03-03 00:00:00\n",
}


def transfermarkt_wikidata() -> FakeWikidata:
    return FakeWikidata(
        transfermarkt_players={
            "8198": ["Q11571"],
            "148455": ["Q1354960"],
            "164590": ["Q7403887"],  # stored on the wrong item: Saleh Al-Dosari, born 1988
            "77777": ["Q999"],  # an existing entity born 1970
        },
        transfermarkt_teams={
            "418": ["Q8682"],
            "3300": ["Q267245"],
            "31": ["Q11571"],  # a wrong P7223 on a player's item
        },
        people={
            "Q1354960": ("1992-06-15T00:00:00Z", "Q79"),
            "Q7403887": ("1988-05-01T00:00:00Z", "Q851"),
        },
        labels={
            "Q1354960": {"en": "Mohamed Salah", "ar": "محمد صلاح"},
            "Q7403887": {"en": "Saleh Al-Dosari"},
            "Q267245": {"en": "Portugal national football team"},
            "Q851": {"en": "Saudi Arabia"},
        },
    )
