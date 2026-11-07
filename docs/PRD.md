# Product Requirements Document (PRD) — v1.0

- **Status:** v1.0 scope decided (2026-11-07). Tuning values (counts, timers, point values, windows) are decided at playtesting (`DECISIONS.md`).
- **Readers:** the product owner and coding agents. This file says **what** the product does and **which rules apply**. **How** it is built lives in `architecture/`, `api/` and `ROADMAP.md`.
- **Rule of precedence:** when this PRD and another doc disagree, `DECISIONS.md` wins for rules, the architecture docs win for technical design, and this PRD is updated.

## 1. Product in one paragraph

A football social game for Arabic- and English-speaking fans. Players predict match scores, battle each other in real-time football trivia at any time, vote for the Man of the Match, compete with friends in private leagues, and climb weekly, monthly, seasonal and all-time leaderboards. The monthly leader wins a prize. Fair play is a core promise: the server decides every lock, timer and score.

## 2. Goals and non-goals

**Goals (v1.0)**
1. A reason to open the app on every matchday (predictions, MOTM) **and** between matchdays (battles, any time).
2. Social pull: friends, private rooms, private leagues.
3. Trustworthy competition: no copying, no client-side cheating, transparent points, fair prize rankings.
4. Arabic-first experience with full English support.

**Non-goals (v1.0)**: Daily Quiz, solo/practice quiz, async (turn-based) battles, activity feed, push notifications, achievements, public profiles/following, web client, in-app purchases, admin dashboard UI.

## 3. Users

| Persona | What they want | Main features |
|---|---|---|
| Matchday predictor | Prove they read the game best; beat friends | Predictions, MOTM, prediction leaderboard, leagues |
| Trivia competitor | Quick competitive fun any time | Quiz battles (random + rooms), battle leaderboard |
| Friend-group organizer | A private competition for their group | Private rooms, private leagues, friends |

Assumptions: native mobile apps on Android and iOS (A-01, Flutter A-09); one platform timezone for leaderboard periods (A-06); launch scale < 50k users (A-07).

## 4. Release scope

**v1.0 ships everything below** (DEC-46). Build order and phases: `ROADMAP.md`.

| # | Feature | Section |
|---|---|---|
| F1 | Accounts and sign-in (Google, phone, Facebook, X) | 5.1 |
| F2 | Matches and predictions | 5.2 |
| F3 | Man of the Match voting | 5.3 |
| F4 | Quiz battles: random matchmaking, bots, private rooms (**core**) | 5.4 |
| F5 | Friends and blocking | 5.5 |
| F6 | Private leagues | 5.6 |
| F7 | Leaderboards and the monthly prize | 5.7 |
| F8 | Football data and question content | 5.8 |

## 5. Features

Each feature lists user stories, the rules that apply (decided or open), and acceptance points. "Server decides" means the client never computes or enforces the rule itself.

### 5.1 F1 — Accounts and sign-in

**Stories**
- As a new user, I sign in with Google, Facebook, X or my phone number, without creating a password.
- As a user, I link several sign-in methods to one account and unlink any but the last.
- As a user, I see my active sessions, sign out of one or all, and delete my account.

**Rules**
- All four providers ship in v1.0 (DEC-26). Accounts are never merged automatically by email (`04-auth.md`).
- Account deletion anonymizes the profile; points history stays for leaderboard integrity (`04-auth.md` §8).
- Profile: display name, optional username, avatar, language (Arabic default), favourite team.

**Open:** production SMS vendor for phone codes (DEC-26, paid, decide before release); identity broker approach (DEC-25, recommended in-house).

### 5.2 F2 — Matches and predictions

**Stories**
- As a fan, I browse fixtures of the top-5 European leagues and national-team matches by date and competition.
- As a predictor, I enter an exact score for a match and change it as often as I like until kickoff.
- As a predictor, I see my points after the match, with an explanation.
- As a friend, I see my friends' predictions for a match once it has kicked off.

**Rules**
- Predictions lock at **kickoff**, decided by the server clock (Confirmed).
- The user enters an **exact score only**; win/draw/loss is derived from it (DEC-03).
- Knockout matches count **90 minutes + extra time**; penalty shootouts do not count (DEC-02).
- Predictions are private; **friends see them only after kickoff**, with no per-user setting (DEC-21).
- Postponed and rescheduled: predictions carry over and reopen until the new kickoff. Cancelled: predictions void. Abandoned: wait for a replay, then void (DEC-24; time limits at playtesting).
- Result corrections rescore automatically; points history keeps the trail.

**Open:** the scoring formula (DEC-01; values at playtesting).

### 5.3 F3 — Man of the Match voting

**Stories**
- As a fan, after the final whistle I vote for the best player from the two squads.
- As a voter, I see the community result when voting closes.

**Rules**
- Voting opens at the authoritative match end and closes **exactly 1 hour later** (Confirmed), by the server clock.
- One vote per user per match; the vote can be changed until close (DEC-05). Any active account can vote (DEC-07).
- Winner = most votes; ties = co-winners (DEC-04/04b). Tallies are hidden until close, then the winner and vote shares are shown; individual votes are never public (DEC-06).
- MOTM gives no points in v1.0 (DEC-08).
- If the match end time is corrected after the result is final, the result stays (DEC-29).

**Open (release blocker):** where candidates (match squads/lineups) come from in production (DEC-27, with DEC-45).

### 5.4 F4 — Quiz battles (core)

**Stories**
- As a player, I tap "Play" and get a real-time football trivia battle against a random opponent at any time.
- As a player, if nobody is online I still get a game, against a clearly labeled bot.
- As a host, I create a private room, share its code, and start a battle with the friends who joined; we can rematch in the same room.
- As a player, if my connection drops for a moment I rejoin the battle where it is.

**Rules**
- Real-time only; no async play, no solo mode (ADR-0010).
- Random matchmaking is 1v1, first come first served (DEC-37). After a wait, a **bot** fills in (DEC-39). Bots are **always labeled** (DEC-40).
- Private rooms: joined with a code; the host starts once at least 2 members are present; rooms stay open for rematches until idle (DEC-38, DEC-42). Blocked users cannot join each other's rooms.
- Everyone in a battle gets the same questions in the same order, in their own language. The server decides correctness, timing and scores; the first answer per round counts.
- A player can be in only one of: the queue, a room, a battle.
- Disconnects: the battle continues; a player who does not return within a grace period forfeits.
- **Only random battles against a human give leaderboard points.** Room and bot battles are for fun and stats (DEC-41).

**Open (tuning at playtesting):** rounds per battle, round and grace timers, scoring and tie rules, room size limit, bot wait and skill, question repetition window (DEC-31/32/33/38/39/43/44).

### 5.5 F5 — Friends and blocking

**Stories**
- As a user, I search for people, send friend requests, accept or decline, and unfriend.
- As a user, I block someone so they cannot find me, friend me, see my predictions, or share a room or match with me.

**Rules:** friendships are mutual (A-02). Blocking removes the friendship and pending requests.

### 5.6 F6 — Private leagues

**Stories**
- As an organizer, I create a league and share an invite code.
- As a member, I see a league ranking for predictions and/or battles.

**Rules**
- Join by invite code or link (DEC-19). Roles: owner (full control, transfers ownership), admin (invites and removals), member (DEC-22).
- A member's points count **from the date they joined** (DEC-20).
- League rankings are computed from the same points as the global leaderboards; nothing is double counted.

**Open (tuning):** member limit (DEC-22).

### 5.7 F7 — Leaderboards and the monthly prize

**Stories**
- As a player, I see my rank this week, month, season and all-time, and the people around me.

**Rules**
- **Two separate boards: predictions and battles.** No combined board (DEC-18).
- Four periods: weekly, monthly, seasonal, all-time (Confirmed). One platform timezone (A-06).
- Rankings are rebuilt from the points history, so corrections are always reflected until a period is finalized.
- The monthly prize is backed by a frozen snapshot of the final ranking.

**Open:** how the prize applies to two boards (DEC-47, recommended: one prize per board); tie-breaks (DEC-23); week/month boundaries and timezone (DEC-15/16); season definition (DEC-17); finalization grace (DEC-28); prize fulfillment (DEC-35, manual).

### 5.8 F8 — Football data and question content

**Rules**
- Development uses mock football data and a match simulator. Production uses a real provider behind the same interface (R1, DEC-45; must also provide lineups for MOTM, DEC-27).
- Questions come from a fact-checked football knowledge base and are generated offline, validated, and reviewed by a native Arabic speaker before publishing (`07-football-data-and-questions.md`). The app never calls an AI model during play.
- Users can report a wrong question; reported questions can be disabled immediately.
- The question bank must be large enough that active players rarely see repeats (risk K-09).

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Fairness | Every lock, window, timer, correctness check and score is decided by the server (Confirmed) |
| Privacy | Predictions private by default; blocked users invisible; no personal data in logs; account deletion available in-app (store requirement) |
| Language | Arabic (default, right-to-left) and English throughout, including questions and team/player names |
| Real-time | Battles stay consistent through duplicate, late and lost messages and short disconnects (`api/WEBSOCKET.md`) |
| Scale at launch | < 50k registered, < 2k concurrent, < 200 concurrent battles on one server (A-07); scaling path in `06-cross-cutting.md` |
| Cost | No paid service needed during development; release costs are store accounts, a server, a domain, backups, SMS and possibly football data |
| Legal | Official prize rules and store requirements before the first prize (K-07); data source licences respected (attribution screen) |

## 7. Success metrics (Recommended)

| Metric | Why |
|---|---|
| Day-1 and day-7 retention | Core health of the product |
| Battles per daily active user; share of battles vs bots | Core feature engagement; whether there are enough humans online |
| Median matchmaking wait | Experience of the core feature |
| Share of active users predicting each matchday | Matchday engagement |
| Friend invites and room/league joins per user | Social growth |
| Reported questions per 1,000 served | Content quality |

## 8. Open items and when they must be decided

| Before | Decisions |
|---|---|
| P4 Leaderboards | DEC-15/16 timezone and boundaries, DEC-17 season, DEC-23 tie-breaks, DEC-47 prize per board |
| Playtesting (before release) | All tuning values: DEC-01, DEC-22, DEC-24, DEC-28, DEC-31, DEC-32, DEC-33, DEC-38, DEC-39, DEC-42, DEC-43, DEC-44 |
| R1 Real data | DEC-45 provider, DEC-27 lineups source |
| R2 Store release | DEC-26 SMS vendor, DEC-35 prize fulfillment, prize legal rules (K-07) |
| P1 Auth (technical) | DEC-25 identity broker (recommended in-house) |

Full option lists and recommendations: `DECISIONS.md`. Risks: `architecture/00-overview.md` §5.
