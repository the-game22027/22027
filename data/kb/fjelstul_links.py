"""D.3b Fjelstul linking: World Cup players, national teams and coaches → Wikidata, through Wikipedia links.

Fjelstul has no outside ids, but every player, men's team and manager row carries its English Wikipedia
article. Wikidata knows which item owns each article (`schema:about`), so the link is exact (07 §5.10,
ADR-0022). Links that do not resolve (a renamed article, now a redirect) or that resolve to the wrong type of
item (a disambiguation page) are written to a review file and left unlinked: never guessed. So is a player
whose Fjelstul birth year is more than a year away from the Wikidata item's.
"""

import re
import urllib.parse
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

from kb.ingest import Snapshot, split_into_batches
from kb.linking import (
    REVIEW_DIR,
    Link,
    LinkReport,
    add_details_of_new_entities,
    can_link_to_entity_of_kind,
    count_linked,
    drop_new_entities_without_links,
    group_external_id_matches_from_rows,
    load_competition_tiers,
    load_existing_entities,
    reject_implausible_links,
    store_links,
    write_link_review_file,
    year_from_date_text,
)
from kb.wikidata import Row, WikidataClient, external_ref_from_qid, qid_from_uri

SOURCE = "fjelstul"
# DEC-67: matches before 2000 never become questions; the women's World Cup is out of scope. Enforced here
# as well as by the tier list, so a mistake in tiers.toml cannot pull those tournaments in.
FIRST_YEAR_IN_SCOPE = 2000
MENS_TOURNAMENT_MARKER = "Men's"

# Which Wikidata classes (P31) an item must have to be linked as each kind. Measured 2026-11-18: 60 of the 62
# men's teams at the 2002-2022 World Cups are Q135408445; Sweden and New Zealand point at disambiguation pages.
HUMAN = "Q5"
ACCEPTED_CLASSES = {
    "PLAYER": {HUMAN},
    "COACH": {HUMAN},
    "NATIONAL_TEAM": {
        "Q135408445",  # men's national association football team
        "Q6979593",  # national association football team
    },
}
# Players first, so a new person who is also a coach becomes a PLAYER entity and the coach link joins it.
KIND_ORDER = {"PLAYER": 0, "NATIONAL_TEAM": 1, "COACH": 2}

# MediaWiki writes article URLs with wfUrlencode: percent-encoding (UTF-8, upper-case hex) except for these
# characters, which stay literal. Wikidata stores sitelink URLs the same way: `N%27Golo_Kant%C3%A9`,
# `Ronaldo_(Brazilian_footballer)`.
TITLE_CHARACTERS_KEPT_LITERAL = ";@$!*(),/:"
WIKIPEDIA_HOST = re.compile(r"([a-z][a-z-]*)(?:\.m)?\.wikipedia\.org")


@dataclass(frozen=True)
class LinkCandidate:
    """One Fjelstul id to link, with the best (lowest) tier it appears in."""

    kind: str
    source_id: str
    tier: int
    name: str
    wikipedia_link: str | None
    birth_year: int | None = None  # players only


@dataclass(frozen=True)
class ArticleMatches:
    qid_by_article: dict[str, str]
    sitelinks_by_qid: dict[str, int]
    classes_by_qid: dict[str, set[str]]
    ambiguous_articles: set[str]


@dataclass
class LinkPlan:
    links: list[Link] = field(default_factory=list)
    # external_ref -> {kind, sitelinks, birth_year}
    new_entities: dict[str, dict] = field(default_factory=dict)
    # ids seen and left for review; ids linked are counted after the birth-year check
    report: LinkReport = field(default_factory=LinkReport)


def normalize_wikipedia_article_url(url: str | None) -> str | None:
    """Write a Wikipedia article URL the way Wikidata stores it, or None if it is not an article URL.

    https, desktop host, title with underscores, first letter upper case, wfUrlencode percent-encoding, no
    trailing slash. A section link (`#...`) or a query string is not an article about one thing: None.
    """
    if not url:
        return None
    parts = urllib.parse.urlsplit(url.strip())
    if parts.scheme not in ("http", "https") or parts.query or parts.fragment:
        return None
    host = WIKIPEDIA_HOST.fullmatch(parts.hostname or "")
    if not host or not parts.path.startswith("/wiki/"):
        return None
    title = urllib.parse.unquote(parts.path.removeprefix("/wiki/")).rstrip("/").replace(" ", "_")
    title = re.sub(r"_+", "_", title).strip("_")
    if not title:
        return None
    first_letter = title[0].upper()
    if len(first_letter) == 1:  # MediaWiki titles start upper case; "ß".upper() is two letters, left alone
        title = first_letter + title[1:]
    encoded = urllib.parse.quote(title, safe=TITLE_CHARACTERS_KEPT_LITERAL)
    return f"https://{host.group(1)}.wikipedia.org/wiki/{encoded}"


def collect_fjelstul_candidates(connection: psycopg.Connection, tiers: dict[str, int]) -> list[LinkCandidate]:
    """Players (appearance, goal or squad), men's teams and managers of the tiered men's World Cups from 2000."""
    scope = """WITH tier(tournament_id, level) AS (SELECT * FROM unnest(%s::text[], %s::int[])),
               t AS (SELECT tournament_id, tier.level FROM tier JOIN raw.fjelstul__tournaments USING (tournament_id)
                     WHERE position(%s in tournament_name) > 0 AND year::int >= %s)"""
    params = (list(tiers), list(tiers.values()), MENS_TOURNAMENT_MARKER, FIRST_YEAR_IN_SCOPE)
    queries = {
        "PLAYER": """
            SELECT a.player_id, min(t.level), p.given_name, p.family_name, p.player_wikipedia_link, p.birth_date
            FROM (SELECT tournament_id, player_id FROM raw.fjelstul__player_appearances
                  UNION ALL SELECT tournament_id, player_id FROM raw.fjelstul__goals
                  UNION ALL SELECT tournament_id, player_id FROM raw.fjelstul__squads) a
            JOIN t USING (tournament_id) LEFT JOIN raw.fjelstul__players p USING (player_id)
            GROUP BY 1, 3, 4, 5, 6""",
        "NATIONAL_TEAM": """
            SELECT a.team_id, min(t.level), NULL, tm.team_name, tm.mens_team_wikipedia_link, NULL
            FROM (SELECT tournament_id, team_id FROM raw.fjelstul__team_appearances
                  UNION ALL SELECT tournament_id, team_id FROM raw.fjelstul__squads) a
            JOIN t USING (tournament_id) LEFT JOIN raw.fjelstul__teams tm USING (team_id)
            GROUP BY 1, 3, 4, 5""",
        "COACH": """
            SELECT a.manager_id, min(t.level), m.given_name, m.family_name, m.manager_wikipedia_link, NULL
            FROM raw.fjelstul__manager_appearances a
            JOIN t USING (tournament_id) LEFT JOIN raw.fjelstul__managers m USING (manager_id)
            GROUP BY 1, 3, 4, 5""",
    }
    candidates = []
    for kind, query in queries.items():
        for source_id, level, given_name, family_name, link, birth_date in connection.execute(
            scope + query, params
        ):
            names = [n for n in (given_name, family_name) if n and n != "not applicable"]
            candidates.append(
                LinkCandidate(kind, source_id, level, " ".join(names), link, year_from_date_text(birth_date))
            )
    return candidates


def find_wikidata_items_by_wikipedia_article(
    client: WikidataClient, articles: Iterable[str]
) -> ArticleMatches:
    """Which Wikidata item owns each article, with its sitelinks and classes. Articles must be normalized."""
    rows: list[Row] = []
    for batch in split_into_batches(sorted(articles)):
        iris = " ".join(f"<{article}>" for article in batch)
        rows.extend(
            client.select_rows(
                f"""SELECT ?article ?item ?sitelinks ?class WHERE {{
                  VALUES ?article {{ {iris} }}
                  ?article schema:about ?item .
                  OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks }}
                  OPTIONAL {{ ?item wdt:P31 ?class }}
                }}"""
            )
        )
    return group_article_matches_from_rows(rows)


def group_article_matches_from_rows(rows: Iterable[Row]) -> ArticleMatches:
    rows = list(rows)
    by_id = group_external_id_matches_from_rows({**row, "id": row["article"]} for row in rows)
    classes: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        if "class" in row:
            classes[qid_from_uri(row["item"])].add(qid_from_uri(row["class"]))
    return ArticleMatches(
        by_id.qid_by_source_id, by_id.sitelinks_by_qid, dict(classes), by_id.ambiguous_source_ids
    )


def plan_wikipedia_links(
    candidates: Iterable[LinkCandidate], matches: ArticleMatches, existing_kinds: dict[str, str]
) -> LinkPlan:
    """Decide every candidate: linked (to a known or a new entity) or left for review, with the reason."""
    plan = LinkPlan()

    def leave_for_review(
        candidate: LinkCandidate, article: str | None, reason: str, item: str = "", detail: str = ""
    ) -> None:
        plan.report.leave_for_review(
            candidate.kind,
            candidate.source_id,
            candidate.tier,
            reason,
            name=candidate.name,
            lookup_key=article or candidate.wikipedia_link or "",
            entity_ref=external_ref_from_qid(item) if item else "",
            detail=detail,
        )

    for candidate in sorted(candidates, key=lambda c: (KIND_ORDER[c.kind], c.source_id)):
        plan.report.seen[(candidate.kind, candidate.tier)] += 1
        article = normalize_wikipedia_article_url(candidate.wikipedia_link)
        if article is None:
            leave_for_review(candidate, None, "INVALID_LINK")
            continue
        if article in matches.ambiguous_articles:
            leave_for_review(candidate, article, "AMBIGUOUS")
            continue
        qid = matches.qid_by_article.get(article)
        if qid is None:
            leave_for_review(candidate, article, "NOT_ON_WIKIDATA", detail="redirect or renamed article?")
            continue
        classes = matches.classes_by_qid.get(qid, set())
        if not classes & ACCEPTED_CLASSES[candidate.kind]:
            leave_for_review(candidate, article, "WRONG_TYPE", qid, " ".join(sorted(classes)))
            continue
        ref = external_ref_from_qid(qid)
        known_kind = existing_kinds.get(ref) or plan.new_entities.get(ref, {}).get("kind")
        if known_kind and not can_link_to_entity_of_kind(candidate.kind, known_kind):
            leave_for_review(candidate, article, "KIND_CLASH", qid, f"entity is {known_kind}")
            continue
        if not known_kind:
            plan.new_entities[ref] = {
                "kind": candidate.kind,
                "sitelinks": matches.sitelinks_by_qid.get(qid, 0),
                "birth_year": None,
            }
        plan.links.append((candidate.kind, candidate.source_id, ref))
    return plan


def link_fjelstul(
    connection: psycopg.Connection,
    client: WikidataClient,
    log: Callable[[str], None] = print,
    review_dir: Path = REVIEW_DIR,
    tiers: dict[str, int] | None = None,
) -> LinkReport:
    """Replace every Fjelstul link, adding the linked entities the knowledge base does not have yet."""
    candidates = collect_fjelstul_candidates(
        connection, load_competition_tiers(SOURCE) if tiers is None else tiers
    )
    per_kind: dict[str, int] = defaultdict(int)
    for candidate in candidates:
        per_kind[candidate.kind] += 1
    log(f"fjelstul ids: {dict(per_kind)}")
    articles = {a for c in candidates if (a := normalize_wikipedia_article_url(c.wikipedia_link))}
    matches = find_wikidata_items_by_wikipedia_article(client, articles)
    existing_kinds, existing_birth_years = load_existing_entities(connection)

    plan = plan_wikipedia_links(candidates, matches, existing_kinds)
    new_entities = Snapshot(entities=plan.new_entities)
    add_details_of_new_entities(client, new_entities, existing_kinds)
    entity_birth_years = {
        **existing_birth_years,
        **{ref: entity["birth_year"] for ref, entity in new_entities.entities.items()},
    }
    candidate_by_id = {(c.kind, c.source_id): c for c in candidates}
    links = reject_implausible_links(
        plan.links,
        plan.report,
        {k: c.birth_year for k, c in candidate_by_id.items()},
        entity_birth_years,
        {k: c.tier for k, c in candidate_by_id.items()},
        {k: c.name for k, c in candidate_by_id.items()},
    )
    drop_new_entities_without_links(new_entities, links)
    count_linked(plan.report, links, {k: c.tier for k, c in candidate_by_id.items()})
    plan.report.new_entities = len(new_entities.entities)
    new_per_kind: dict[str, int] = defaultdict(int)
    for entity in new_entities.entities.values():
        new_per_kind[entity["kind"]] += 1
    log(f"new entities per kind: {dict(new_per_kind)}")
    path = write_link_review_file(SOURCE, plan.report.review_rows, review_dir)
    log(f"{len(plan.report.review_rows):,} unlinked ids → {path}")
    store_links(connection, SOURCE, links, new_entities, method="WIKIPEDIA_LINK")
    return plan.report
