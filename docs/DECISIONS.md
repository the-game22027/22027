# Open Decisions Register

Every business rule that is **not decided** lives here. Code must treat these as configuration or explicit `TODO(DEC-xx)`; never as hard-coded constants or database constraints.

Status values: **Pending** (default in use, awaiting approval) · **Decided (date)** · **Deferred** (not needed until a later phase).

**Tuning values are deferred (product owner, 2026-11-07):** counts, durations, point values, wait times and windows (e.g. DEC-01, DEC-22 limits, DEC-24 N days, DEC-28, DEC-31, DEC-32, DEC-33 values, DEC-38 size, DEC-39 wait, DEC-43, DEC-44 window) are decided at playtesting, before release. Until then they live in config with obviously fake `DEV_ONLY` seed values. Only structural rules (what happens, who can do what) are decided during design.

When a decision is made: update its row (status, chosen option, date), update the config default, and add an ADR if it changes architecture.

## Predictions

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-01 | Prediction scoring formula: points for exact score, correct result, bonuses, penalties | Any weights; per-competition multipliers possible | None: rule set config must be filled by the product owner. Dev seed uses obviously fake values flagged `DEV_ONLY`. Product owner chose to decide later (2026-11-07); options offered: exact 3 / result 1 · exact 5 / goal diff 3 / result 2 · exact 10 / result 5 / +1 per team goals | `scoring_rule_sets` (`PREDICTION`) | Pending |
| DEC-02 | Which score counts in knockout matches | 90' only · 90' + extra time · including penalties | **Chosen: 90' + extra time; penalty shootouts excluded** (a 1-1 decided on penalties is a draw) | Prediction rule set `resultBasis` | Decided (2026-11-07) |
| DEC-03 | Which prediction types are mandatory | Result only · score only · both required · either | **Chosen: exact score only;** the result (home/draw/away) is derived from it. `RESULT` is never entered separately | Prediction config `requiredPicks` | Decided (2026-11-07) |
| DEC-21 | Prediction visibility to friends | Friends after kickoff · friends always · user-selectable among these · private option | **Chosen: friends see predictions only after kickoff.** Fixed platform rule, no per-user setting in v1.0 (prevents copying in leagues and the prize race) | `PredictionVisibilityPolicy` | Decided (2026-11-07) |
| DEC-24 | Postponement, kickoff change, cancellation, abandonment | See `03-workflows.md` §1.5 | Keep predictions on kickoff change; carry over on reschedule; void if not rescheduled in N days; void on cancel | Prediction policy config | Decided (2026-11-07): recommended default; values deferred to playtesting |
| DEC-51 | Highest score a user can enter in an exact-score pick | Any limit per team | 20 goals per team: high enough for any real result, and it stops junk values | `PREDICTION_MAX_GOALS` config | Pending |

## MOTM

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-04 | Aggregation formula | Plurality (most votes) · share of votes · weighted (e.g., by user reliability) · average of ratings (needs a different vote shape) | Plurality, stored as strategy `PLURALITY_V1` | `motm_polls.aggregation_strategy` + strategy registry | Decided (2026-11-07): recommended default |
| DEC-04b | Tie-breaking | Co-winners · earliest to reach the final count · random seeded by match id · no award | Co-winners (`winner_player_ids` array) | Strategy config | Decided (2026-11-07): recommended default |
| DEC-05 | Can users change their vote? | No · yes until close · yes N times | Yes until close (one active vote; `change_count` audited) | MOTM config | Decided (2026-11-07): recommended default |
| DEC-06 | Anonymity / visibility of tallies | Hidden until close then shares · live shares · winner only | Hidden until close, then winner + shares; individual votes never public | MOTM config | Decided (2026-11-07): recommended default |
| DEC-07 | Verified account required to vote | Any account · account age ≥ N days | Any active account (low friction); revisit if abuse appears | MOTM config | Decided (2026-11-07): recommended default |
| DEC-08 | MOTM and points: predicting the MOTM (when?) and/or points for voting | No points · MOTM prediction before kickoff scored against community result · points for voting with the majority | No points until decided; `MOTM` pick type disabled | Prediction + MOTM config | Decided (2026-11-07): recommended default |
| DEC-27 | Production source of MOTM candidates (squads) | Paid live provider · current squads from Wikidata (lower quality) · manual entry | **Now a v1.0 release blocker** (MOTM ships in v1.0, DEC-46). Decide together with DEC-45 (risk K-02) | `FootballDataProvider` adapter | Pending |
| DEC-29 | End-time correction after the poll was finalized | Keep result · reopen · recompute with votes inside the corrected window | Keep result, log the correction | MOTM policy | Decided (2026-11-07): recommended default |

## Quiz battles (real-time PvP, the only quiz mode, ADR-0010)

Confirmed on 2026-11-07 by the product owner: no Daily Quiz, no solo mode, no async play. Players meet through random matchmaking (1v1) or private rooms joined with a code. A bot fills in when matchmaking finds no human.

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-31 | Questions (rounds) per battle | Any N; same or different for rooms | Config; dev seed uses a placeholder flagged `DEV_ONLY` | Battle config `roundCount` | Pending |
| DEC-32 | Battle timers | Round duration; ready timeout; reconnect grace; latency grace | Config | Battle config | Pending |
| DEC-33 | Battle scoring, ties, placements, forfeits, abandoned battles | Points per correct · speed bonus · difficulty weighting · streaks; tie-break (total answer time, shared placement); forfeit = win with or without points; N-player placement points | Config; ties share placement; abandoned = no points | Rule set (`BATTLE`) | Pending |
| DEC-37 | Matchmaking strategy | FIFO random · rating bands · region · locale | FIFO random in MVP; rating later | Matchmaking config | Decided (2026-11-07): recommended default |
| DEC-38 | Private room size and start rule | Max players: 2 (1v1 only) or up to N; start: host only · auto-start when full · both | **Rooms are multiplayer (decided 2026-11-10): more than 2 players can play in one room.** Still pending: the limit N (`room.maxPlayers` is config, picked at playtesting; the dev seed is `DEV_ONLY`) and the start rule (default: the host starts once at least 2 members are present) | Room config | Decided in part |
| DEC-39 | Bot fallback | Bots on/off; wait before a bot joins; bots in rooms too | Bots on in matchmaking only; wait = `matchmaking.botFallbackAfterMs` (product picks the value; dev seed `DEV_ONLY`) | Matchmaking config | Pending |
| DEC-40 | Bot disclosure | Clearly labeled as a bot · presented as a normal player | **Clearly labeled.** Every payload carries `kind: "BOT"` and the UI shows it. Hiding bots in a prize-linked game risks user trust, app-store review and consumer-protection problems | Protocol + UI | Decided (2026-11-07): recommended default |
| DEC-41 | Which battle modes earn leaderboard points | Matchmaking vs human · vs bot · private room; each full, reduced or none | Matchmaking vs human: per rule set. **Vs bot: none** (bots are easy to farm). **Private room: none** (friends can collude, or one person can play their own second account, for the monthly prize). All three are values in the rule set's `modes` section, so changing them needs no code | Rule set (`BATTLE`) `modes.*` | Decided (2026-11-07): recommended default |
| DEC-42 | Room lifetime and rematch | Room closes after one battle · stays open for "play again" until an idle timeout | Stays open for rematches; closes after an idle timeout (config); empty room closes immediately | Room config | Decided (2026-11-07): recommended default; values deferred to playtesting |
| DEC-43 | Bot skill | One fixed profile · a few profiles picked at random · matched to the player's recent accuracy | A few fixed profiles in config (accuracy per difficulty + answer-delay range); skill matching later | Bot config | Pending |
| DEC-44 | Question repetition and option order | Exclude questions a participant saw in the last N battles or D days; shuffle option order per player or not | Exclude each participant's recent exposures within a config window, relaxing it when the bank cannot satisfy it. Option order no longer applies: answers are typed (DEC-55) | Battle config `selection.*` | Pending |

### Game types (ADR-0015, product owner 2026-11-10)

A battle now has a **game type**. Multiple choice is not a game: players type their answer. DEC-31/32/33/43 above become per-game-type configuration.

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-53 | Game types in v1.0 | Any subset of the researched formats | **Chosen: `BUZZER`, `CAREER`, `WHO_IS_PLAYER`, `GRID` (football tic-tac-toe; only if a data check shows our data supports it), and `IMPOSTER` in private rooms only, built with P8.** The auction game is dropped for now | Game type registry | Decided (2026-11-10) |
| DEC-54 | Buzz mechanic (shared by `BUZZER`, `CAREER`, `WHO_IS_PLAYER`) | Reveal pauses on a buzz or keeps running; one or several attempts; what a wrong answer costs | **Chosen (structure):** the server reveals clues one by one; it accepts only the first valid buzz; an accepted buzz pauses the reveal; the player gets an answer window; correct ends the round; wrong or timed out locks that player out of the round and the reveal resumes. **Values are config, picked at playtesting:** reveal pace, answer window, attempts per player (default 1), final timer after the last clue, points | Game config per game type | Decided (2026-11-10): structure; values deferred |
| DEC-55 | How a typed answer is judged | Free text with fuzzy matching · pick from suggestions, matched by id | **Chosen: suggestions from an answer catalog (players, clubs, national teams, competitions, with Arabic and English names and alternative names); the client sends the entity id; numbers are sent as numbers.** No fuzzy text matching | Answer catalog + protocol | Decided (2026-11-10) |
| DEC-57 | Game types after launch | Top 10 list · Higher/Lower · Complete the lineup · Rarest answer · Draft XI · Auction | Next candidates: **Top 10** and **Higher/Lower**. The rest are judged later by data availability and player engagement | Roadmap | Deferred (after launch) |
| DEC-58 | Imposter rules | Text chat or fixed clue turns; minimum players; does the imposter win by naming the player; how the secret name is kept out of the chat; chat moderation | Owner's outline: the name is shown to everyone but the imposter; a timed chat; then everyone votes. Points: for a correct vote, more if you were the only one right; the imposter scores for every player who did not pick them. Recommended additions: the server blocks the name and its alternative names in chat; minimum 4 players; report and mute tools before strangers can ever play it | Game config (`IMPOSTER`) | Pending (decide before P8) |
| DEC-59 | Random matchmaking and game types | The player picks a game (one queue per game) · one mixed queue with a random game · a match made of rounds from different games | The player picks a game; one queue per game type; the bot fallback covers empty queues. Revisit with real traffic, because separate queues split a small player base | Matchmaking config | Pending |
| DEC-61 | Players in a `GRID` battle | Exactly 2 · 2+ with one symbol each · teams | Exactly 2: tic-tac-toe is a two-player game, and a third player can only block. A room starts `GRID` only with 2 members (`GAME_TYPE_PLAYER_COUNT`) | Game config (`GRID`) | Pending |
| DEC-60 | Do the other players see a wrong typed answer during the round? | Shown live · shown only when the round ends | Shown live (the owner's original outline). It tells the remaining players what is wrong, which is part of the game; a config flag lets playtesting switch it | Game config per game type | Pending |

## Monetization

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-56 | Membership and premium features | Free daily matches then pay · subscription for unlimited matches · rewarded ads for extra matches · paid room hosting or credits | **No monetization at launch: everyone plays freely.** Planned about two months after launch from real engagement data. The architecture keeps one play-access check point so limits can be added without a redesign (ADR-0016). Every price and limit will be configuration | Future `entitlements` module | Deferred (about 2 months after launch) |

## Leaderboards

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-15 | Weekly boundary and timezone | Week start day; IANA timezone | Monday 00:00 in one platform timezone (choose the launch market's, e.g. `Africa/Cairo` or `Asia/Riyadh`) | Leaderboard config | Pending |
| DEC-16 | Monthly boundary and timezone | Calendar month in a timezone | Same timezone as DEC-15 | Leaderboard config | Pending |
| DEC-17 | Season definition | Football season (e.g., Aug–May) · calendar year · per competition | Football season, fixed dates in `season_calendar` | `season_calendar` | Pending |
| DEC-18 | Leaderboard categories | One overall board · separate prediction/battle boards · both | **Chosen: two separate boards, PREDICTIONS and BATTLES; no OVERALL board.** How the monthly prize applies to two boards is DEC-47 | `leaderboard_category` config | Decided (2026-11-07) |
| DEC-47 | Monthly prize with two leaderboards | One prize per board (two monthly winners) · prize only on one board · alternate | One prize per board (each board has its own monthly leader) | Leaderboard/prize config | Pending |
| DEC-23 | Tie-breaking | Earliest to reach the score · more exact scores · fewer predictions · shared rank | Shared rank in display; deterministic ordering by configured tie-breakers for prizes | Leaderboard config (`tiebreak_1/2` mapping) | Pending |
| DEC-28 | Finalization grace window (result corrections before prize snapshot) | 0 · 24h · 72h | 72h after period end | Leaderboard config | Pending |
| DEC-35 | Prize fulfillment | Manual · integrated | Manual (out of technical scope) | — | Deferred |

## Leagues and social

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-19 | Join mechanism | Invite code/link · owner invites friends · request + approval | Invite code/link (shareable on X) | League settings | Decided (2026-11-07): recommended default |
| DEC-20 | Which points count in a league | From competition start · from member join date | From member join date (fair for late joiners, no back-dated points) | `league_competitions.counting_policy` | Decided (2026-11-07): recommended default |
| DEC-22 | League rules: max members, duration, visibility, owner/admin permissions, both modes at once | — | Max members configurable; no end date by default; private only; OWNER full control, ADMIN invites/removes; both modes allowed | League settings + `LeaguePolicy` | Decided (2026-11-07): recommended default; values deferred to playtesting |
| DEC-34 | Social activity feed scope | None · friends' predictions after lock · achievements · results | None in MVP | — | Deferred |

## Identity and platform

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-49 | Username format | Letters, digits and underscore · also Arabic letters · no usernames | `^[A-Za-z0-9_]{3,20}$`: easy to type, search and share; revisit for Arabic-first users | `USERNAME_PATTERN` config | Pending |
| DEC-50 | How recent a sign-in must be to delete an account | 5 min · 10 min · always re-verify with the provider | 10 min since the real sign-in, not the last token refresh | `ACCOUNT_DELETION_RECENT_SIGN_IN_SECONDS` config | Pending |
| DEC-25 | Identity broker | In-house verification · Firebase Auth · self-hosted broker | In-house (`04-auth.md` §3.5) | Auth adapters | Pending |
| DEC-26 | Sign-in providers at launch | All four at once · phased · phone optional | **Decided (2026-11-08, ADR-0012): Google, Facebook and X in v1.0, built in that order. Phone number sign-in removed (no SMS cost).** Apple: DEC-48 | Auth config | Decided (2026-11-08) |
| DEC-48 | Sign in with Apple (App Store guideline 4.8) | Add Sign in with Apple · release Android first, iOS later · no social sign-in on iOS | Add Sign in with Apple before the iOS release: free with the Apple Developer account the iOS release needs anyway, same `(provider, subject)` model (`04-auth.md` §3.4) | Auth adapters | Pending (decide before R2) |
| DEC-62 | App language vs profile `locale` (`PATCH /v1/me`) | Independent (device setting only) · app language follows the profile · changing either updates both | Changing the app language while signed in also sends `PATCH /v1/me {locale}` (best effort); after signing in to an existing account, a device with no saved language adopts the profile `locale`; a new account (its `locale` is only the server default) gets the app language instead. One language per player across devices, and offline changes still work | Mobile `AppLanguageController` | Pending |

## Release

| ID | Decision | Options | Recommended default | Lives in | Status |
|---|---|---|---|---|---|
| DEC-45 | Production football data provider (fixtures, live results) | A free tier of a football API (check commercial-use terms and delays) · paid API · semi-manual entry for a limited set of competitions | Shortlist free tiers in R1, verify licence and latency, keep the mock for dev; budget for paid data if no free licence allows commercial use | `FootballDataProvider` adapter | Pending |
| DEC-52 | Mobile application id / bundle id (and the `--org` used by `flutter create`) | Decide now · decide with the final product name | Decide with the product name, before the first store upload. Until then the placeholder is `com.example.thegame` (`.dev` suffix for the dev flavor), which Google Play rejects, so it cannot ship by accident (ADR-0014) | Android `applicationId`, iOS bundle id, flavor config | Pending (decide before R2) |
| DEC-46 | Release scope | Everything in one release · staged releases | **Chosen: everything in v1.0** (predictions, MOTM, battles with matchmaking/bots/rooms, friends, leagues, leaderboards, Google/Facebook/X sign-in; phone removed by ADR-0012) | Roadmap | Decided (2026-11-07) |

## Withdrawn

IDs are never reused, so old references stay unambiguous.

| ID | Was | Withdrawn because |
|---|---|---|
| DEC-09 | Daily Quiz question count | Daily Quiz removed (ADR-0010, 2026-11-07). Battle round count is DEC-31 |
| DEC-10 | Quiz timer | Same. Battle timers are DEC-32 |
| DEC-11 | Quiz scoring | Same. Battle scoring is DEC-33 |
| DEC-12 | Quiz retries and session expiry | Same. Battles are played any time; there are no sessions to expire |
| DEC-13 | Quiz randomization | Same. Option shuffling for battles is part of DEC-44 |
| DEC-14 | Can quiz answers be changed? | Same. Battles keep "first answer wins" (protocol rule) |
| DEC-30 | When the correct answer is revealed | Same. Battles reveal it in `round:result` after each round closes |
| DEC-36 | Quiz modes beyond daily | Same. Modes are now battle modes (matchmaking, room); new ones need a new ADR |
