# ADR-0016: No monetization at launch; play access is checked in one place so it can be added later

- **Status:** Accepted (product decision by the owner, 2026-11-10)
- **Date:** 2026-11-10
- **Related:** DEC-56; ADR-0015; CLAUDE.md §2.3 (zero budget); PRD §5.4

## Context
The product owner wants a membership later: a number of free matches, then paying for more. The decision for now is **not to launch it**. Pricing and limits will be planned about two months after launch, from real engagement data. Until then everyone plays freely. The architecture must make these easy to add later, without a redesign:

- a subscription for unlimited matches;
- premium features and access restrictions;
- rewarded ads for extra matches;
- paid private-room hosting or credits.

## Decision
1. **v1.0 ships with no membership, no payments, no ads and no play limits.** No tables, endpoints or SDKs for them are built now.
2. **Every way of starting a match goes through one application use case per entry point**: joining matchmaking, and starting a room battle. That is where a play-access check will be added. Nothing else in the engine, the game rules or the protocol may decide whether a user is allowed to play.
3. **The data a limit needs already exists.** "How many matches did this user play today, in which game type and mode" is a query on battle participants. Counting needs no new write path.
4. **When membership is built**, it becomes its own module (`entitlements`): what a user is entitled to, and how that was obtained. Store purchases (Google Play Billing, Apple In-App Purchase) and ad rewards sit behind ports and are verified on the server. The check in point 2 asks that module. Limits and prices are configuration, never constants.
5. **Clients must not assume play is unlimited.** A refused start is an ordinary problem+json error with its own `code`, which the app shows like any other; the code is added to the contract when the feature is built.

## Alternatives considered
| Option | Why not |
|---|---|
| Build the entitlements module now, switched off | Work and maintenance for rules nobody has decided; the limits would be guesses |
| Add an always-allow interface now | An abstraction with one trivial implementation. The rule in point 2 gives the same safety without code |
| Launch with a free-match limit | Rejected by the product owner. A paywall on a new game with few players also empties the matchmaking queue |

## Consequences
- \+ Nothing to maintain until there is data to decide with.
- \+ Adding limits later touches two use cases and one new module, not the engine.
- − Digital goods must use the stores' billing systems, which take a commission; this is a release-time cost, not a development cost.
- − A monthly prize combined with paid play can count as a paid contest in some countries; legal review is needed before membership ships (risk K-07).
- Revisit when the owner plans membership (about two months after launch).
