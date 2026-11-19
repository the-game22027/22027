# Live check: the data layer against the real backend

`test/` checks the data and application layers against fakes. This folder runs the same
code against a **locally running backend**, with no screen (ROADMAP M1.5): REST through the
repositories, and one battle against the bot per game type through `BattleSessionController`
and the state reducer. Every test signs in fresh dev users, so runs never depend on each other.

## Run it

```bash
# apps/backend: the API on :3000, with the dev question bundles imported and published
npm run start:api:dev

# apps/mobile
fvm flutter test test_live
```

- Not part of `fvm flutter test` (which reads `test/` only) and not run in CI: every file is
  tagged `live` and needs the backend.
- The URL comes from `config/dev.json` (`apiBaseUrl`); set `LIVE_API_BASE_URL` to use another.
- Without a backend, each file stops in `setUpAll` with one message saying how to start it.
- Battles need published content per game type (`questions:import` and `questions:publish`,
  CLAUDE.md §6). Without it the server answers `NO_CONTENT` and the test says so.

## What it covers

| File | Checks |
|---|---|
| `rest_checks_live_test.dart` | profile, sessions, football, a prediction, friends, blocks, user directory, leaderboards, play-state |
| `reveal_battles_live_test.dart` | a full `BUZZER`, `CAREER` and `WHO_IS_PLAYER` battle |
| `grid_battle_live_test.dart` | a full `GRID` battle with rock-paper-scissors; a socket dropped during rock-paper-scissors |
| `reconnect_and_resume_live_test.dart` | a socket dropped mid-round (`battle:resync`); a second device resuming through `GET /v1/me/play-state` |
| `mines_battle_live_test.dart` | a full `MINES` battle (burying, the detector's private answer, turns); a socket dropped during burying. Reported as skipped when the server answers `NO_CONTENT` |
| `auction_battle_live_test.dart` | a full `AUCTION` battle (pick a list, an all-in, raise, call, proofs and steals, first to `targetScore`); a socket dropped during bidding. Reported as skipped when the server answers `NO_CONTENT` |

Each battle fails when an event cannot be parsed (the message names the event, the field and
the payload), when `seq` has a gap in a normal run, or when the battle does not end
`COMPLETED` with placements (every round of `roundCount`, or until someone reaches
`targetScore` when the config has one). Afterwards, `play-state` must show no queue ticket and no battle.

The moves come from the battle state only, never from knowing the answers: buzz and type a
guess, claim a free cell or skip, bury guessed names (the server buries the rest at the
deadline), use the detector once, pick an auction list, open all-in once then bid low, raise
once and call, type guesses in a proof or a steal, pick rock-paper-scissors. Rule values (`roundCount`, timers)
come from `battle:found.config`.
