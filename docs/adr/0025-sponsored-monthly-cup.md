# ADR-0025: A sponsored monthly cup for the top 32 of the battles board

- **Status:** Proposed
- **Date:** 2026-11-20
- **Related:** DEC-82, DEC-83, DEC-28, DEC-35, DEC-41, DEC-47; ADR-0010 (real-time only), ADR-0016 (no monetization at launch); risks K-07, K-10; docs/architecture/03-workflows.md §10

## Context
The product owner wants a competition people can enter, and a way to earn money without charging players: at the end of each month, the top 32 of the monthly `BATTLES` board play a knockout cup from the round of 32 to the final, and a sponsor can put its name on the cup ("the X Cup") and pay for the prize.

Forces:
- **Real-time only (ADR-0010):** a cup tie is a live battle between two given players, so both must be online at the same time. Matchmaking never had to schedule anyone.
- **The monthly board is not final yet:** periods stay `OPEN`; closing, the finalization grace window (DEC-28) and snapshots were left for "the prize work". A cup must start from a frozen, agreed ranking.
- **Prizes attract cheating (K-10)** and come with legal and store rules (K-07): official rules, eligibility, "Apple and Google are not sponsors".
- **No user payments (ADR-0016):** a sponsor pays the company under a contract outside the app, so no store billing, no commission, no paid entry. Entry stays free, which keeps the cup a free skill contest.
- **Zero budget:** reminders need push notifications; Firebase Cloud Messaging is free.

## Decision
1. **A new module `tournaments`** owns cups: the qualifiers taken from a finalized monthly snapshot, entry confirmation, the bracket, ties, schedules, walkovers and results. It reads `leaderboards` (the snapshot) and asks `battles` to create battles; it never scores a game itself.
2. **`battles` gets a third mode, `TOURNAMENT`,** next to `MATCHMAKING` and `ROOM`: a battle created for two given users inside a play window, without a queue and never with a bot. `BattleCompleted` (outbox) tells `tournaments` who won; the handler is idempotent. A tie of several battles (best of N) is the tournament's business, not the engine's.
3. **`leaderboards` finishes the prize work first:** closing jobs, `FINALIZED` after the grace window (DEC-28), and `leaderboard_snapshots`. The cup reads only a finalized snapshot.
4. **A new module `sponsorships`** owns sponsors and what they brand (name in both languages, logo, colours, prize text, from and to dates). A cup points at an optional sponsorship; with none, it runs under the platform's name. Sponsors are created by an admin command, never by users.
5. **A new module `notifications`** sends push messages (FCM behind a port: "your round of 16 starts at 21:00"). Push was future scope; the cup makes it required.
6. **Cup battles give no leaderboard points** (`modes.TOURNAMENT` in the rule set, as DEC-41 does for rooms and bots), so the cup never changes the next month's ranking.
7. **Every open rule is configuration plus a Pending DEC:** cup format and scheduling in DEC-82, sponsorship rules in DEC-83.

## Alternatives considered
| Option | Why not |
|---|---|
| Async cup matches (each player plays their half alone, best score wins) | Rejected product rule: no async play (ADR-0010) |
| Cup logic inside `battles` | The engine plays one battle; brackets, schedules and walkovers are a different job with their own tables |
| Cup logic inside `leagues` | Leagues are private groups ranked from the ledger; a public knockout with qualification is another lifecycle |
| Start the cup from the live (open) board | Result corrections in the grace window could change who qualified after the cup started (K-06) |
| Paid entry or in-app sponsor payments | Store billing and commission, and paid entry plus a prize can count as gambling in some countries (K-07) |

## Consequences
- \+ A sponsor buys an audience and a branded moment without the app touching payments.
- \+ The same machinery (bracket, scheduled live battles, push) later serves weekly cups, league cups or creator cups.
- − Three new modules and one new battle mode; the leaderboard prize work becomes a prerequisite.
- − Scheduling live ties is the hard part: no-shows, time zones and disconnects need clear walkover rules (DEC-82).
- − A cup needs at least 32 active players a month to mean anything, and a sponsor needs an audience: build it after launch, once the monthly board is full.
- Revisit if players cannot be online together reliably (then shorter windows or a smaller bracket), or if legal review of the first prize changes the eligibility rules.
