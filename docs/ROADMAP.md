# Implementation Roadmap

Ordered by dependencies, not by the feature list. Each phase ends with a demoable result and explicit exit criteria. Durations are not estimated here on purpose; track them as you go.

## Dependency view

```mermaid
flowchart LR
  P0[P0 Foundation] --> P1[P1 Auth + Users]
  P0 --> P2[P2 Football mock data + simulator]
  P1 --> P3[P3 Predictions + rule sets + points ledger]
  P2 --> P3
  P3 --> P4[P4 Leaderboards]
  P0 --> P5[P5 Question bank + import]
  D[Track D: Python KB + templates] --> P5
  P5 --> P6[P6 Quiz battles: engine + matchmaking + bots - CORE]
  P4 --> P6
  P1 --> P7[P7 Friends + blocks + prediction visibility]
  P3 --> P7
  P6 --> P8[P8 Private battle rooms]
  P7 --> P8
  P2 --> P9[P9 MOTM voting]
  P4 --> P10[P10 Private leagues]
  P7 --> P10
  P1 --> P11[P11 Facebook + X adapters]
  P8 --> P12[P12 Production hardening]
  P10 --> P12
  P11 --> P12
  P9 --> P12
```

Changes vs the original proposed order, and why:

- **Points ledger moves into P3** with predictions: scoring needs somewhere to write, and the ledger is what makes recalculation possible from day one.
- **Leaderboards move up to P4:** predict → points → rank is the core loop; everything after it plugs into the same ledger.
- **Quiz battles are core and come right after the points loop (P5-P6, ADR-0010).** The Daily Quiz phase is gone; the battle engine, matchmaking and bot fallback come first because they make the feature playable even with very few users.
- **Friends before private rooms:** room joins need block checks (`social`), and friends are who you invite.
- **MOTM moves later (P9):** it is independent and can slot anywhere after P2.
- **Track D (Python knowledge base) runs in parallel** from P2 because it has no dependency on the NestJS code, only on the bundle contract. Battles can be played without limit, so the bank must be large before launch (risk K-09). P5-P6 can start with a small hand-written dev bundle.
- **Facebook and X adapters go late (P11):** the identity model is built in P1, so adding providers later changes no schema (DEC-26).

## Phases

### P0 — Foundation
- Monorepo layout from `CLAUDE.md` §4; Docker Compose (Postgres with `app` + `football_kb` DBs, Redis with `noeviction`); `.env.example`.
- NestJS app with `main.api.ts` and `main.worker.ts`; config schema validation; `nestjs-pino`; request id via `nestjs-cls`; problem+json filter; `ValidationPipe`; URI versioning; Swagger at `/docs`; health checks.
- Shared kernel: `Clock`, UUID v7 ids, `DomainError`.
- Prisma setup (multi-file schema), `@nestjs-cls/transactional`; `outbox_events` + publisher loop + BullMQ wiring + Bull Board.
- Testing harness: Jest unit, Testcontainers integration, Supertest e2e; dependency-cruiser boundary rules; CI pipeline.
- **Exit:** `docker compose up` + API/worker start; `/health/ready` green; one sample event goes from outbox to a BullMQ handler in an integration test; boundary lint fails on a deliberate violation.

### P1 — Auth + Users
- `users` (profile, privacy settings), `auth` (identities, sessions, JWT, refresh rotation with reuse detection), Google adapter, phone OTP with `ConsoleSmsSender`, a `FakeProvider` adapter for tests, session list/revoke, `GET/PATCH /me`, account deletion request (fan-out handlers stubbed per module as modules arrive).
- **Exit:** e2e: sign in with fake Google token → `/me` → refresh → reuse old refresh → family revoked; OTP lockout test; WS handshake guard tested with a dummy gateway.

### P2 — Football mock data + simulator
- Competitions/seasons/teams/players/matches/squads with AR/EN names; `FootballDataProvider` + `MockFootballProvider`; `ApplyProviderMatchUpdate` with versioning; lifecycle events via outbox; simulator CLI commands and scenarios.
- **Exit:** `mock:run-day` plays a matchday producing `MatchStarted/Finished` events; `GET /v1/matches` lists fixtures with `predictable` computed server-side.

### P3 — Predictions + rule sets + points ledger
- `prediction_picks` model, submit/edit with DB-clock lock, revisions, `PredictionScorer` driven by `scoring_rule_sets`, scoring job, void/carry-over policies behind config, `points` module recording/superseding.
- **Exit:** concurrency test around kickoff passes; result correction rescoring supersedes ledger entries; two different rule-set configs produce different points (proves nothing is hard-coded).

### P4 — Leaderboards
- Period calculator (timezone + season calendar config), periods lifecycle job, incremental recompute per (period, user), rebuild command, keyset pagination, my-rank endpoint, snapshots at finalization.
- **Exit:** rebuild equals incremental result on a seeded dataset; DST/new-year period tests; leaderboard page query uses the index (EXPLAIN check).

### Track D (parallel, Python) — Knowledge base + templates
- `football_kb` raw/staging/core for a first small slice: martj42 international results + openfootball top-5 + World Cup; entity crosswalk; facts with provenance; 10-20 bilingual templates; deterministic validation; bundle writer. Ollama phrasing optional and off by default.
- **Exit:** a bundle of ≥ 1,000 validated questions with a 200-question human review sample ≥ 98% correct (Arabic reviewed by a native speaker). **Before public launch:** several thousand questions, sized from expected battles per active user per week × `roundCount` against the exposure window (DEC-44, risk K-09).

### P5 — Question bank + import
- Tables, `questions:import` / `publish` / `disable` CLI, selection queries (locale intersection, difficulty/category balance, exclusion list), answer key, playable payload mapper, question reports endpoint, `BattleCompleted` stats handler (can be wired in P6).
- **Exit:** importing the same bundle twice is a no-op; a changed served question is versioned, not overwritten; payload mappers never expose correctness (test).

### P6 — Quiz battles: engine + matchmaking + bot fallback (CORE)
- `/battles` gateway per `WEBSOCKET.md`; battle engine for 2..N participants; question selection with recent-exposure exclusion (DEC-44); readiness, rounds, answers, scoring and placements from the BATTLE rule set with per-mode points (DEC-33/41); persistence of every transition; reconnection/resync; forfeit; Redis matchmaking queue + matcher loop; bot fallback with `BotPlayer` profiles (DEC-39/43); activity guard; `GET /v1/me/play-state`; completion → outbox → ledger → leaderboards; stale battle sweeper.
- **Exit:** WebSocket test suite for happy path, duplicate/late/out-of-order messages, disconnect/reconnect, forfeit, ready timeout; bot fallback fires after the configured wait and the bot battle replays identically with a fixed seed; two rule-set configs give different per-mode points (proves DEC-41 is config); a 3-participant battle runs in tests even though matchmaking only makes 1v1.

### P7 — Friends + blocks + prediction visibility
- Friend requests, friendships, blocks, user search; `PredictionVisibilityPolicy`; friends' predictions endpoints; blocked pairs skipped by the matchmaker.
- **Exit:** visibility matrix tests (owner, friend before/after kickoff, non-friend, blocked) for every read path.

### P8 — Private battle rooms
- `battle_rooms` + members; code generation; create/join/leave/remove/start/close endpoints; lobby pushes (`room:*`); host transfer; rematch back to `LOBBY` (DEC-42); idle timers + backstop sweeper; block checks on join; join rate limits.
- **Exit:** concurrency tests (last seat, join vs start, double start); blocked user gets `ROOM_NOT_FOUND`; room survives an API restart and returns to `LOBBY`; two `maxPlayers` configs work (DEC-38); a room with 3 or more players plays a full battle and a rematch.

### P9 — MOTM voting
- Poll creation on `MatchFinished`, window from `ended_at`, votes with DB-clock window check, delayed close + sweeper, aggregation strategy registry, end-time correction handling.
- **Exit:** votes at window edges behave per spec; lost delayed job still closes via sweeper; aggregation strategies swappable by config.

### P10 — Private leagues
- Leagues, members, invites (code), competitions (PREDICTIONS first, then BATTLES), `LeaguePolicy`, league leaderboard from the ledger.
- **Exit:** league ranking matches a manual ledger sum under both counting policies (DEC-20).

### P11 — Facebook + X sign-in
- Adapters + account linking UX endpoints; verify current provider API constraints first.
- **Exit:** linking rules tested (no auto-merge, last-identity protection).

### P12 — Production hardening
- Rate limit tuning, app attestation for OTP (optional), backups, metrics dashboards, load test of leaderboard pages, matchmaking and concurrent battles, deployment scripts, licence/attribution screen, account deletion end-to-end, security review.
- **Exit:** checklist in `06-cross-cutting.md` §1.1 fully satisfied; restore-from-backup drill done.

## Mobile track (Flutter, `apps/mobile`)

Each mobile phase starts once the backend phase it consumes is merged. The API contract is already written, so screens can be built against it with mocked responses even earlier.

### M0 — Mobile foundation (after P0)
- Decide and record (ADR): Flutter version (pinned with `fvm`), application id, state-management and navigation libraries. `flutter create` in `apps/mobile`; dev/prod flavors; Arabic + English with RTL; generated REST client from the backend `openapi.json`; secure token storage; error mapping from problem+json `code`; path-filtered CI (`flutter analyze`, tests).
- **Exit:** app runs on Android and iOS simulators against the local backend, `/health` call works, RTL layout verified.

### M1 — Sign-in and profile (after P1)
- Google and phone OTP sign-in, refresh rotation, sessions list, profile and privacy settings, account deletion.
- **Exit:** sign in → kill the app → reopen still signed in; refresh reuse forces sign-out.

### M2 — Matches, predictions, leaderboards (after P3 + P4)
- Fixtures by date and competition, prediction editor locked by server `predictable` + `serverTime`, own history with scores, the four leaderboard periods, my rank.
- **Exit:** full predict → simulate match → see points and rank flow on a device.

### M3 — Quiz battles UI (after P6) — CORE
- Socket client per `WEBSOCKET.md`: matchmaking screen with bot fallback, battle screen with server-synced countdown, round results, placements, bot label, reconnect and resync, `GET /me/play-state` resume.
- **Exit:** two devices play a full battle; airplane mode for 5 seconds mid-round recovers via resync; a bot battle shows the bot badge.

### M4 — Friends and private rooms (after P7 + P8)
- User search, friend requests, blocks, friends' predictions; create room, share code, lobby, host start, rematch.
- **Exit:** three devices play a room battle started from a shared code.

### M5 — MOTM and leagues (after P9 + P10)
- MOTM voting screen with window countdown and results; league create/join/leaderboard.
- **Exit:** vote inside the window; a league ranking matches the backend.

## Release track

### R1 — Real football data provider (blocker for any public release)
- Mock data is useless in production. Choose a provider (DEC-45), implement its `FootballDataProvider` adapter, sync jobs, and attribution screen. Check its licence for commercial use before writing code.
- **Exit:** a real matchday syncs fixtures and results automatically; predictions score from real results.

### R2 — Store release
- Accounts: Google Play (one-time fee) and Apple Developer (yearly fee). Privacy policy and terms pages; official prize rules (risk K-07); store listings in Arabic and English; app icons and screenshots.
- Production deploy (P12 checklist), crash reporting with a free tier, backups verified.
- **Google Play closed test:** new personal developer accounts must run a closed test with a minimum number of testers (currently 12) for 14 days before production access. Plan the calendar time; verify the current rule when registering.
- **Exit:** app approved on both stores; staged rollout started.

**Zero budget ends at release.** Unavoidable costs: store accounts, a server, a domain, backups, and SMS if phone sign-in stays.

## Release scope (Decided 2026-11-07, DEC-46)

**v1.0 contains everything:** P0-P12, Track D, M0-M5 (plus Facebook/X screens in the mobile sign-in flow), R1, R2. Consequences:
- R1 must also deliver timely **lineups** for MOTM candidates (DEC-27), not only fixtures and results. This is the riskiest release dependency (K-02).
- All four sign-in providers ship at launch (DEC-26). Production SMS vendor still to choose.

## Order of work and rough effort

Estimates are **focused working days for one developer using coding agents**, including tests. At 5 focused days per week, v1.0 (everything) is roughly **5-6 months**.

| Stage | Phases (in order) | Focused days |
|---|---|---|
| A. Foundation | P0, M0 | 5-8 |
| B. Predict → points → rank | P1, M1, P2, P3, P4, M2 | 23-33 |
| C. Quiz battles (core) | P5, P6, M3, P7, P8, M4 | 27-38 |
| Parallel content | Track D (start during stage B; keep going until launch volume, K-09) | 10-15 |
| D. Rest of the product | P9, P10, M5, P11 (+ Facebook/X in the app) | 14-22 |
| E. Release v1.0 | R1 (fixtures, results, lineups), P12, R2 | 12-20 + 14 days closed test |

## Deferred (Future)
Notifications, direct room invites via push, activity feed, share cards for X, achievements, skill rating for matchmaking and bots, admin dashboard, prize fulfillment, real football data provider, multi-instance WebSockets, semantic dedup with local embeddings.
