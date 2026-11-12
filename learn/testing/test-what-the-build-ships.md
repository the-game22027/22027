# Test what the build ships
> A test is only as good as its compile step: if tests compile the code differently from the build, a bug can live in the gap.

**Problem:** `main` passed every e2e test, yet the API crashed at boot: `[PlayStateDto] A circular dependency has been detected (property key: "room")`. The e2e tests do build the Swagger document. But `nest build` runs the Swagger CLI plugin, which writes each DTO's property types into the code, and ts-jest did not. In the tests every DTO had no types, so nothing could break.

**Why the plugin cannot simply run in ts-jest:** our `tsconfig.json` has `isolatedModules: true`, so ts-jest compiles one file at a time. The plugin needs the whole program to know that `entities` is `AnswerCatalogEntityDto[]`. Compiling the whole program per test file was too slow.

**How:**
- Once per test run, `PluginMetadataGenerator` runs the plugin over the build program (`tsconfig.build.json`, same options as `nest-cli.json`) and writes `src/generated/swagger-metadata.ts`.
- Every test boot loads it with `SwaggerModule.loadPluginMetadata` before the document is built. A DTO that breaks a real boot now breaks every e2e test.
- A failed boot closes the app, so Jest fails fast instead of hanging on open connections.

**In our code:** [swagger-metadata.ts](../../apps/backend/test/support/swagger-metadata.ts), [test-app.ts](../../apps/backend/test/support/test-app.ts), the `/docs-json` test in [http.e2e-spec.ts](../../apps/backend/test/e2e/http.e2e-spec.ts), the fix in [play-state.dto.ts](../../apps/backend/src/modules/battles/presentation/dto/play-state.dto.ts).

**Watch out:**
- A red test must fail for the right reason. The first attempt ran the plugin inside ts-jest and failed too, but on `AnswerCatalogDto`: a type-less compile, not the real bug.
- Other build-only steps can hide the same way: path aliases, environment files, assets copied by the build.

**Check yourself:** why was the bug `room!: null` and not every other DTO?
<details><summary>Answer</summary>The plugin turns a TypeScript type into a Swagger type. `null` alone has no Swagger type, so the plugin emitted none, and Swagger fell back to a reflected type it could not describe. An explicit `@ApiProperty` gives it one.</details>
