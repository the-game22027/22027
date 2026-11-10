# CLI entry points
> A third way to start the same application: commands instead of HTTP or jobs.

**Problem:** a one-off script that talks to the database directly skips your rules. It can create states the app could never reach and forget to publish events.

**How:**
- One codebase, several `main` files: `main.api.ts`, `main.worker.ts`, `main.cli.ts`. Each picks the modules it needs.
- A command is a thin **presentation** layer, like a controller. It parses arguments and calls an application service.
- Arguments are validated at the edge. A bad value prints a clear message and exits with code 1, so scripts can detect failure.
- The process must exit when done, so database and Redis connections are closed.

**In our code:** [main.cli.ts](../../apps/backend/src/main.cli.ts), [cli.module.ts](../../apps/backend/src/cli.module.ts), [mock-match.commands.ts](../../apps/backend/src/modules/football/presentation/cli/mock-match.commands.ts), [mock-args.ts](../../apps/backend/src/modules/football/presentation/cli/mock-args.ts).

**Watch out:** a dangerous dev command must not exist in production. We leave the module out when the app runs in production, which is safer than a check inside each command.

**Check yourself:** why does `mock:finish` call `ApplyProviderMatchUpdate` instead of a Prisma `update`?
<details><summary>Answer</summary>So it passes through the state machine and writes `MatchFinished` to the outbox. A direct update would change the row and tell nobody.</details>
