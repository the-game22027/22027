from kb.lineup_rounds import LineupPlayer, SourcedLineup, lineup_rounds, without_sort_fields
from kb.vaults import VaultMatch

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
TEAMS = {
    "wikidata:Q1": {"en": "Liverpool F.C.", "ar": "نادي ليفربول"},
    "wikidata:Q2": {"en": "Tottenham Hotspur F.C.", "ar": "توتنهام هوتسبير"},
}
# Starters Q101..Q111 in a 4-3-3, listed out of order to check the slot order; Q101 is the captain.
POSITIONS = [
    "Centre-Forward", "Goalkeeper", "Left-Back", "Centre-Back", "Centre-Back", "Right-Back",
    "Defensive Midfield", "Central Midfield", "Central Midfield", "Left Winger", "Right Winger",
]  # fmt: skip
STARTER_REFS = [f"wikidata:Q{n}" for n in range(101, 112)]
BENCH_REFS = ["wikidata:Q201", "wikidata:Q202"]
POPULARITY = {ref: 100 + index for index, ref in enumerate(STARTER_REFS)} | {
    "wikidata:Q201": 90,  # the best-known bench player: the fake
    "wikidata:Q202": 60,
}


def match(match_id=1, stage="FINAL", tier=1, shootout=None):
    return VaultMatch(
        match_id=match_id,
        competition_key="champions-league",
        competition_names=UCL,
        competition_kind="CUP",
        tier=tier,
        season_label="2018-19",
        final_year=2019,
        stage=stage,
        leg=None,
        home_ref="wikidata:Q2",
        away_ref="wikidata:Q1",
        home_goals=0,
        away_goals=2,
        shootout_home=shootout[0] if shootout else None,
        shootout_away=shootout[1] if shootout else None,
        shootout_winner_ref=None,
        goals_complete=True,
    )


def lineup(
    match_id=1, starters=None, captains=("wikidata:Q101",), bench=None, positions=None, source="transfermarkt"
):
    starters = STARTER_REFS if starters is None else starters
    positions = POSITIONS if positions is None else positions
    players = [
        LineupPlayer(ref, True, position, number, ref in captains)
        for number, (ref, position) in enumerate(zip(starters, positions, strict=True), start=1)
    ]
    players += [
        LineupPlayer(ref, False, None, 20 + n, False)
        for n, ref in enumerate(BENCH_REFS if bench is None else bench)
    ]
    return SourcedLineup(match_id, "wikidata:Q1", source, "CC0-1.0", tuple(players))


def rounds(matches, lineups, popularity=POPULARITY, **options):
    return lineup_rounds(
        matches,
        lineups,
        TEAMS.get,
        lambda ref: {"en": ref, "ar": ref} if ref in popularity else None,
        popularity.get,
        "kb-test",
        **options,
    )


def test_a_famous_final_becomes_one_round_with_the_xi_in_drawing_order():
    [line] = without_sort_fields(rounds([match()], [lineup()]))

    assert line["externalKey"] == "lineup:champions-league:2018-19:FINAL:Q2-Q1:Q1"
    assert line["gameType"] == "LINEUP" and line["difficulty"] == 1
    assert [(slot["line"], slot["role"]) for slot in line["content"]["slots"]] == [
        ("GK", "GK"), ("DEF", "LB"), ("DEF", "CB"), ("DEF", "CB"), ("DEF", "RB"),
        ("MID", "DM"), ("MID", "CM"), ("MID", "CM"), ("FWD", "LW"), ("FWD", "CF"), ("FWD", "RW"),
    ]  # fmt: skip
    assert [slot["player"] for slot in line["content"]["slots"] if slot["captain"]] == ["wikidata:Q101"]
    assert line["answers"] == [
        {"slot": 0, "entities": [slot["player"] for slot in line["content"]["slots"]]},
        {"slot": 1, "entities": ["wikidata:Q201"]},
    ]
    assert "_popularity" not in line


def test_the_shown_names_are_the_fake_and_the_two_least_known_starters_but_never_the_captain():
    [line] = rounds([match()], [lineup(captains=("wikidata:Q102",))])

    assert line["content"]["fake"] == "wikidata:Q201"
    # Q102 is the least known starter but wears the armband, so Q101 and Q103 are shown instead.
    assert sorted(line["content"]["shown"]) == ["wikidata:Q101", "wikidata:Q103", "wikidata:Q201"]


def test_the_title_reads_from_the_team_side_with_the_shootout():
    [line] = rounds([match(shootout=(3, 4))], [lineup()])

    assert line["content"]["title"] == {
        "en": "Liverpool against Tottenham Hotspur, final of the 2018-19 UEFA Champions League "
        "(2–0, 4–3 on penalties)",
        "ar": "ليفربول أمام توتنهام هوتسبير، نهائي دوري أبطال أوروبا 2018-19 (2–0، 4–3 بركلات الترجيح)",
    }


def test_only_famous_matches_are_used():
    matches = [
        match(1, "GROUP"),
        match(2, "QUARTER_FINAL", tier=2),
        match(3, "FINAL", tier=2),
        match(4, "ROUND_OF_16"),
    ]
    lines = rounds(matches, [lineup(n) for n in (1, 2, 3, 4)])

    assert sorted((line["externalKey"].split(":")[3], line["difficulty"]) for line in lines) == [
        ("FINAL", 2),
        ("ROUND_OF_16", 4),
    ]


def test_a_lineup_with_a_starter_outside_the_catalog_is_skipped():
    popularity = {ref: value for ref, value in POPULARITY.items() if ref != "wikidata:Q105"}
    assert rounds([match()], [lineup()], popularity=popularity) == []


def test_a_lineup_with_too_few_known_starters_is_skipped_and_a_weaker_one_is_harder():
    popularity = POPULARITY | {ref: 10 for ref in STARTER_REFS[:6]}
    assert rounds([match()], [lineup()], popularity=popularity) == []  # 5 known, 6 needed
    [line] = rounds([match()], [lineup()], popularity=popularity, min_known=5)
    assert line["difficulty"] == 2  # 5 of 11 known is below the easy share


def test_a_lineup_without_a_known_bench_player_has_no_fake_and_is_skipped():
    assert rounds([match()], [lineup(bench=[])]) == []
    assert rounds([match()], [lineup(bench=["wikidata:Q999"])]) == []


def test_without_one_captain_no_slot_wears_the_armband():
    for captains in ((), ("wikidata:Q101", "wikidata:Q102")):
        [line] = rounds([match()], [lineup(captains=captains)])
        assert not any(slot["captain"] for slot in line["content"]["slots"])


def test_coarse_fjelstul_positions_keep_the_line_without_a_role():
    positions = ["FW", "GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW"]
    [line] = rounds([match()], [lineup(positions=positions, source="fjelstul")])

    assert [slot["line"] for slot in line["content"]["slots"]] == [
        "GK",
        *["DEF"] * 4,
        *["MID"] * 3,
        *["FWD"] * 3,
    ]
    assert {slot["role"] for slot in line["content"]["slots"][1:]} == {None}
    assert "fjelstul" in line["provenance"]["sources"]


def test_an_unknown_position_skips_the_lineup():
    assert rounds([match()], [lineup(positions=["Unknown", *POSITIONS[1:]])]) == []
