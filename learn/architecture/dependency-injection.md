# Dependency injection (DI)
> A class lists what it needs in its constructor; the framework creates and passes those things in.

**Problem:** `new PrismaClient()` inside every class means many connections, no way to swap in a fake for tests, and hidden coupling.

**How:**
- `@Injectable()` marks a class the Nest container can build.
- A module's `providers` registers it; `exports` lets other modules use it.
- For interfaces (which don't exist at runtime) use a **token**: `@Inject(CLOCK) clock: Clock`.
- Default scope is a singleton: one instance for the whole app.

**In our code:** [outbox.writer.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.writer.ts) (constructor gets `TransactionHost`, `ID_GENERATOR`, `CLOCK`), [kernel.module.ts](../../apps/backend/src/shared/infrastructure/kernel/kernel.module.ts).

**Watch out:** a singleton must not keep per-request state in fields. Use the request context (CLS) instead.

**Check yourself:** you know DI from Flutter. What plays the container's role there?
<details><summary>Answer</summary>`get_it`, `Provider` or Riverpod: you register factories once and resolve them where needed. Same idea.</details>
