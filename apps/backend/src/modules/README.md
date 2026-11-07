# Business modules

Empty until Phase 1. Each folder here is one module from `docs/architecture/01-modules.md` (`auth`, `users`, `football`, `predictions`, `motm`, `question-bank`, `battles`, `points`, `leaderboards`, `leagues`, `social`). Scaffold new ones with the `new-module` Claude Code skill.

## Template

```
src/modules/<name>/
├── index.ts                 # PUBLIC API ONLY: facades, query services, DTO types, event types
├── <name>.module.ts         # Nest wiring used by the API and the worker
├── <name>-jobs.module.ts    # BullMQ processors + outbox subscriptions (imported by WorkerModule only)
├── domain/                  # plain TypeScript: entities, value objects, policies, domain errors
├── application/             # use cases, ports (repository interfaces), transactions
├── infrastructure/          # Prisma repositories, adapters implementing the ports
└── presentation/            # HTTP controllers + DTOs, WS gateways, BullMQ processors, CLI commands
```

## Rules (enforced by `npm run depcheck:boundaries` and ESLint)

- Other modules import only `@modules/<name>` (this folder's `index.ts`), never a deep path.
- `domain/` imports nothing from NestJS, Prisma, Redis, BullMQ, Socket.IO or `shared/infrastructure`; only `@shared/kernel`.
- Nobody reads `process.env`; inject `AppConfig`.
- Each table has exactly one owning module; its Prisma models go in `prisma/schema/<name>.prisma`.
- Domain errors extend `DomainError` from `@shared/kernel` with a stable `code` and a `kind`; the HTTP mapping is automatic.

## Events (transactional outbox)

1. In a use case, inside `@Transactional()`, change state and call `OutboxWriter.write({ type, version, aggregateType, aggregateId, payload })`.
2. In the consuming module's `*JobsModule`, register the subscription in `onModuleInit`:
   `registry.register({ eventType: 'MatchFinished', subscriber: 'predictions.score-match', queue: 'predictions' })`,
   and add a BullMQ processor for that queue.
3. Handlers must be idempotent: delivery is at-least-once. Job ids are `<eventId>__<subscriber>`.
