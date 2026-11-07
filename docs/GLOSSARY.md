# Glossary

| Term | Meaning in this project |
|---|---|
| **Authoritative** | Decided by the server/database, never by the client. Applies to locks, windows, timers, scores, battle state |
| **Kickoff lock** | The instant (`matches.kickoff_at`) after which a prediction can no longer be created or edited. Enforced with the DB clock |
| **Predictable** | Server-computed flag: match is `SCHEDULED` and `kickoff_at > now()` |
| **Pick** | One element of a prediction (`RESULT`, `EXACT_SCORE`, future `MOTM`). Stored in `prediction_picks` |
| **Revision** | A numbered snapshot of a prediction after each accepted edit (`prediction_revisions`) |
| **Result version** | `matches.result_version`; increments on each result correction so rescoring is traceable |
| **Rule set** | Versioned scoring configuration per game type (`scoring_rule_sets`). All TBD point values live here |
| **Points ledger** | Append-only `point_entries`; the single source of truth for every awarded point |
| **Supersede** | Replacing a ledger entry by marking it superseded and inserting a new one (never updating points in place) |
| **Period** | A leaderboard time window: WEEKLY, MONTHLY, SEASONAL, ALL_TIME, identified by `period_key` |
| **Projection** | Read-optimized table derived from other data and rebuildable (`leaderboard_entries`) |
| **Snapshot** | Frozen leaderboard at finalization, used as prize evidence |
| **Finalization grace** | Time after a period ends during which result corrections still change rankings (DEC-28) |
| **MOTM poll** | The voting instance for one match; window `[ended_at, ended_at + 1h)` |
| **Ended at** | Authoritative match end time from the provider; basis for the MOTM window |
| **Quiz battle / Battle** | One real-time trivia game between 2..N participants, run by one server-side engine. The only quiz mode (ADR-0010). There is no Daily Quiz and no solo mode |
| **Battle mode** | How participants were brought together: `MATCHMAKING` (random 1v1, maybe with a bot) or `ROOM` |
| **Participant** | A seat in a battle: `HUMAN` (a user) or `BOT`. Identified in the protocol by `participantId` |
| **Matchmaking ticket** | A user's place in the Redis queue; removed when matched, cancelled, or turned into a bot battle |
| **Bot fallback** | Giving a queued player a bot opponent after `botFallbackAfterMs` (DEC-39) |
| **Bot / bot profile** | Server-side participant with no socket; its accuracy and answer delays come from a configured profile (DEC-43). Never a `users` row, never earns ledger points, always labeled (DEC-40) |
| **Room (private battle room)** | A lobby created by a host and joined with a code; starting it creates a battle with `mode = ROOM`; can host rematches (DEC-42) |
| **Room code** | Short, unambiguous, random code identifying a live room; reusable after the room closes |
| **Host** | The room member allowed to start, remove members and close; passes to the earliest-joined member if the host leaves |
| **Activity guard** | Redis `act:{userId}`: a user is in at most one of queue, room, battle |
| **Placement** | Final rank inside a battle (1 = best; ties share). `outcome` (WIN/LOSS/DRAW) is derived from it |
| **Score vs points (battles)** | `score` = in-game number players see; `points` = what goes to the ledger, computed per battle mode from the rule set (DEC-41) |
| **Exposure window** | How far back a player's already-seen questions are excluded from new battles (DEC-44) |
| **Active socket** | The single socket allowed to send answers for a user in a battle |
| **seq** | Per-battle monotonically increasing event number used to detect gaps |
| **clientMsgId** | Client-generated UUID per command; used for duplicate detection and acks |
| **Outbox** | `outbox_events` table written in the same transaction as a state change, published to BullMQ by the worker |
| **Public entry** | A module's `index.ts`, the only thing other modules may import |
| **Provider (football)** | Source of operational match data behind `FootballDataProvider` (mock now) |
| **Provider (auth)** | Google, Facebook, X, phone: sources of verified identities |
| **Identity** | `(provider, provider_subject)` pointing to one internal user |
| **Session family** | Chain of rotated refresh tokens; reuse of an old one revokes the whole family |
| **Knowledge base (KB)** | `football_kb` database of verified football facts with provenance, owned by the Python pipeline |
| **Fact** | A resolved, provenance-tracked assertion in the KB with status and confidence |
| **Bundle** | Versioned JSONL file of validated questions: the only interface from the KB pipeline to the app |
| **Template** | Human-written bilingual question pattern + SQL over facts + distractor strategy |
| **Distractor** | A wrong answer option, chosen from the DB and proven wrong for the question |
| **DEC-xx** | An open decision in `DECISIONS.md` |
| **A-xx / K-xx / R-xx** | Assumption / risk / requirement IDs in `architecture/00-overview.md` |
