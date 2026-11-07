# ADR-0009: Use the database clock inside write statements for time-critical rules

- **Status:** Proposed
- **Date:** 2026-11-07
- **Related:** R-01, R-02; 02-database.md §5; 03-workflows.md §1.4, §2

## Context
Prediction locks at kickoff and the MOTM one-hour window must be enforced exactly, even with several API instances whose clocks may drift and with requests racing the deadline.

## Decision
Time-critical acceptance checks are part of the write statement itself and compare against PostgreSQL `now()` (transaction start time), e.g. `... WHERE kickoff_at > now()`. Zero affected rows maps to a domain error. Node's clock is used only for display and non-critical scheduling. Domain policies receive time from an injected `Clock` for unit tests, and repositories still enforce the DB-side condition.

## Alternatives considered
| Option | Why not |
|---|---|
| Check in Node, then write | Race between check and write; clock drift across instances |
| Lock via scheduled job at kickoff | A late or failed job leaves predictions open |

## Consequences
+ One authoritative clock; races decided atomically.
− Some logic is duplicated (domain policy for UX and the SQL condition for truth); integration tests must cover the SQL.
