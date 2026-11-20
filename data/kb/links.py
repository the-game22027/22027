"""ONE_TWO (وان تو) content: the link graph between catalog entities and the rally seeds (08 §15.4). Pure: no I/O.

A link joins two catalog entities through one match: they faced each other as starters in a final or a knockout
match, scored in the same match, one set up the other's goal, or a player scored against a club. Each link keeps
the most memorable match that makes it true, as its evidence.
"""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date

from kb.auctions import shorten_team_names
from kb.generate import LICENSES, SOURCES, Names
from kb.vaults import FINAL, KNOCKOUT_STAGES, LEG_NAMES, STAGE_NAMES

FACED_IN_FINAL = "FACED_IN_FINAL"
FACED_IN_KNOCKOUT = "FACED_IN_KNOCKOUT"
SCORED_IN_SAME_MATCH = "SCORED_IN_SAME_MATCH"
ASSISTED = "ASSISTED"
SCORED_AGAINST = "SCORED_AGAINST"
SYMMETRIC_TYPES = (FACED_IN_FINAL, FACED_IN_KNOCKOUT, SCORED_IN_SAME_MATCH)

# Pass types: how the app reads each link from the ball's side (08 §15.4).
ASSIST_GIVEN = "ASSIST_GIVEN"
ASSIST_RECEIVED = "ASSIST_RECEIVED"
CONCEDED_TO = "CONCEDED_TO"
PLAYER_PASS_TYPES = (
    FACED_IN_FINAL,
    FACED_IN_KNOCKOUT,
    SCORED_IN_SAME_MATCH,
    ASSIST_GIVEN,
    ASSIST_RECEIVED,
    SCORED_AGAINST,
)

# A final is the match fans remember best, then the later knockout rounds, then anything else.
MEMORY_RANK = {FINAL: 0, "SEMI_FINAL": 1, "QUARTER_FINAL": 2, "ROUND_OF_16": 3}
OTHER_STAGE_RANK = 4

EVIDENCE_TEMPLATE = {
    "en": "{season} {competition}{stage}: {home} {score} {away}",
    "ar": "{stage}{competition} {season}: {home} {score} {away}",
}
SHOOTOUT_TEMPLATE = {"en": "{goals} ({shootout} on penalties)", "ar": "{goals} ({shootout} بركلات الترجيح)"}

# Seeds: well-known players whose first offer is full (08 §15.4).
SEED_MIN_SITELINKS = 40
SEED_MIN_PASS_TYPES = 3
SEED_MIN_NEIGHBOURS = 5
# Sitelinks → difficulty: the better known the seed, the more names come to mind.
# Measured on 2026-11-20: seed sitelinks quintiles are about 43, 47, 53 and 61.
DIFFICULTY_BY_SITELINKS = ((80, 1), (60, 2), (50, 3), (44, 4), (0, 5))
# A seed whose third-best pass type has fewer neighbours than this is one step harder.
NARROW_OFFER_NEIGHBOURS = 10


@dataclass(frozen=True)
class LinkMatch:
    """A usable match of a tier-1 or tier-2 competition, with what its evidence text needs."""

    match_id: int
    competition_key: str
    competition_names: Names
    tier: int
    season_label: str
    stage: str | None
    leg: int | None
    match_date: date
    home_ref: str
    away_ref: str
    home_goals: int
    away_goals: int
    shootout_home: int | None
    shootout_away: int | None


@dataclass(frozen=True)
class LinkGraph:
    """The links (`from`, `type`, `to`, `match` key) and the evidence of every match they point at."""

    links: list[dict]
    matches: list[dict]

    def neighbour_counts(self) -> dict[tuple[str, str], int]:
        """(entity, pass type) → number of neighbours, reading every link from both ends."""
        counts: dict[tuple[str, str], int] = defaultdict(int)
        for link in self.links:
            for entity, pass_type in _pass_readings(link):
                counts[(entity, pass_type)] += 1
        return dict(counts)

    def keeping_only(self, entity_refs: set[str]) -> "LinkGraph":
        """The links whose two ends are in `entity_refs`, and only the matches they still point at."""
        links = [link for link in self.links if link["from"] in entity_refs and link["to"] in entity_refs]
        used = {link["match"] for link in links}
        return LinkGraph(links, [match for match in self.matches if match["key"] in used])


def build_link_graph(
    matches: Iterable[LinkMatch],
    starters: Iterable[tuple[int, str, str]],
    goals: Iterable[tuple[int, str, str, str | None]],
    is_catalog_player: Callable[[str], bool],
    is_catalog_club: Callable[[str], bool],
    team_names_of: Callable[[str], Names | None],
) -> LinkGraph:
    """The link graph from tier-1/2 `matches`, their `starters` (match, team, player) and `goals` (match, team,
    scorer, assist provider; own goals already left out). Matches whose teams have no names in both languages
    cannot be shown as evidence and are skipped. Deterministic: the same input gives the same output."""
    by_id: dict[int, LinkMatch] = {}
    evidence: dict[int, dict] = {}
    for match in matches:
        text = _evidence_text(match, team_names_of)
        if text is not None:
            by_id[match.match_id] = match
            evidence[match.match_id] = {"key": match_key(match), "evidence": text}

    # (type, from, to) → the best match id found so far.
    best: dict[tuple[str, str, str], int] = {}

    def offer(link_type: str, first: str, second: str, match_id: int) -> None:
        if first == second:
            return
        if link_type in SYMMETRIC_TYPES and second < first:
            first, second = second, first
        key = (link_type, first, second)
        current = best.get(key)
        if current is None or _memory_order(by_id[match_id]) < _memory_order(by_id[current]):
            best[key] = match_id

    starters_by_match: dict[int, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for match_id, team_ref, player_ref in starters:
        if match_id in by_id and is_catalog_player(player_ref):
            starters_by_match[match_id][team_ref].add(player_ref)
    for match_id, teams in starters_by_match.items():
        stage = by_id[match_id].stage
        if stage not in KNOCKOUT_STAGES or len(teams) != 2:
            continue
        home, away = (sorted(players) for players in teams.values())
        for player in home:
            for opponent in away:
                offer(FACED_IN_KNOCKOUT, player, opponent, match_id)
                if stage == FINAL:
                    offer(FACED_IN_FINAL, player, opponent, match_id)

    scorers_by_match: dict[int, set[str]] = defaultdict(set)
    for match_id, team_ref, scorer_ref, assist_ref in goals:
        if match_id not in by_id or not is_catalog_player(scorer_ref):
            continue
        scorers_by_match[match_id].add(scorer_ref)
        if assist_ref is not None and is_catalog_player(assist_ref):
            offer(ASSISTED, assist_ref, scorer_ref, match_id)
        match = by_id[match_id]
        opponent = match.away_ref if team_ref == match.home_ref else match.home_ref
        if is_catalog_club(opponent):
            offer(SCORED_AGAINST, scorer_ref, opponent, match_id)
    for match_id, scorers in scorers_by_match.items():
        ordered = sorted(scorers)
        for index, scorer in enumerate(ordered):
            for other in ordered[index + 1 :]:
                offer(SCORED_IN_SAME_MATCH, scorer, other, match_id)

    links = [
        {"from": first, "type": link_type, "to": second, "match": evidence[match_id]["key"]}
        for (link_type, first, second), match_id in sorted(best.items())
    ]
    used = sorted(set(best.values()), key=lambda match_id: evidence[match_id]["key"])
    return LinkGraph(links, [evidence[match_id] for match_id in used])


def one_two_rounds(
    graph: LinkGraph,
    player_popularity_of: Callable[[str], int | None],
    kb_version: str,
) -> list[dict]:
    """Every seed round: a well-known catalog player with at least `SEED_MIN_PASS_TYPES` pass types of
    `SEED_MIN_NEIGHBOURS` or more neighbours, so the first offer is full. Sorted by difficulty, then
    popularity, then key."""
    counts = graph.neighbour_counts()
    seeds = []
    for entity in sorted({entity for entity, _ in counts}):
        popularity = player_popularity_of(entity)
        if popularity is None or popularity < SEED_MIN_SITELINKS:
            continue
        sizes = sorted((counts.get((entity, pass_type), 0) for pass_type in PLAYER_PASS_TYPES), reverse=True)
        if sizes[SEED_MIN_PASS_TYPES - 1] < SEED_MIN_NEIGHBOURS:
            continue
        difficulty = next(level for minimum, level in DIFFICULTY_BY_SITELINKS if popularity >= minimum)
        if sizes[SEED_MIN_PASS_TYPES - 1] < NARROW_OFFER_NEIGHBOURS:
            difficulty = min(5, difficulty + 1)
        seeds.append((difficulty, -popularity, entity))
    return [_seed_line(entity, difficulty, kb_version) for difficulty, _, entity in sorted(seeds)]


def match_key(match: LinkMatch) -> str:
    """Stable across rebuilds (core.match ids are not): competition, season, stage, date and the teams."""
    stage = match.stage or "MATCH"
    leg = f":leg{match.leg}" if match.leg else ""
    teams = f"{_qid(match.home_ref)}-{_qid(match.away_ref)}"
    return f"{match.competition_key}:{match.season_label}:{stage}{leg}:{match.match_date.isoformat()}:{teams}"


def _pass_readings(link: dict) -> list[tuple[str, str]]:
    """(ball, pass type) for both ends of a link: the pass types under which each end finds the other."""
    if link["type"] in SYMMETRIC_TYPES:
        return [(link["from"], link["type"]), (link["to"], link["type"])]
    if link["type"] == ASSISTED:
        return [(link["from"], ASSIST_GIVEN), (link["to"], ASSIST_RECEIVED)]
    return [(link["from"], SCORED_AGAINST), (link["to"], CONCEDED_TO)]


def _memory_order(match: LinkMatch) -> tuple:
    """Smaller is more memorable: the stage, then the tier (a Champions League final before a super cup), then
    the latest match, then the id for a stable result."""
    return (
        MEMORY_RANK.get(match.stage or "", OTHER_STAGE_RANK),
        match.tier,
        -match.match_date.toordinal(),
        match.match_id,
    )


def _evidence_text(match: LinkMatch, team_names_of: Callable[[str], Names | None]) -> Names | None:
    home, away = team_names_of(match.home_ref), team_names_of(match.away_ref)
    if home is None or away is None:
        return None
    home, away = shorten_team_names(home), shorten_team_names(away)
    goals = f"{match.home_goals}–{match.away_goals}"
    score = {"en": goals, "ar": goals}
    if match.shootout_home is not None and match.shootout_away is not None:
        shootout = f"{match.shootout_home}–{match.shootout_away}"
        score = {locale: SHOOTOUT_TEMPLATE[locale].format(goals=goals, shootout=shootout) for locale in score}
    stage = {"en": "", "ar": ""}
    if match.stage in STAGE_NAMES:
        leg = LEG_NAMES.get(match.leg, {"en": "", "ar": ""})
        stage = {
            "en": f" {STAGE_NAMES[match.stage]['en']}" + (f", leg {match.leg}" if match.leg else ""),
            "ar": f"{leg['ar']}{STAGE_NAMES[match.stage]['ar']} ",
        }
    return {
        locale: EVIDENCE_TEMPLATE[locale].format(
            stage=stage[locale],
            season=match.season_label,
            competition=match.competition_names[locale],
            home=home[locale],
            away=away[locale],
            score=score[locale],
        )
        for locale in ("en", "ar")
    }


def _seed_line(entity: str, difficulty: int, kb_version: str) -> dict:
    return {
        "externalKey": f"one-two:{_qid(entity)}",
        "type": "GAME",
        "gameType": "ONE_TWO",
        "category": "one-twos",
        "difficulty": difficulty,
        "content": {"seed": entity},
        # Accepted answers come from the link graph (links.jsonl), not from the question (ADR-0024).
        "answers": [],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        "validUntil": None,
        "humanReviewed": {"en": False, "ar": False},
    }


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")
