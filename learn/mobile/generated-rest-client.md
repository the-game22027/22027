# REST client generated from OpenAPI
> The backend describes its API in an OpenAPI document; a generator turns it into Dart classes and methods.

**Problem:** a hand-written client drifts from the backend. A renamed field or a new required property is found by a player at runtime, not by the compiler.

**How:**
- The backend publishes the contract at `/docs-json`. `tool/update_openapi.sh` saves it, sorted and indented, as `openapi/openapi.json`, so a contract change is a readable diff in the PR.
- `tool/generate_api_client.sh` runs `openapi-generator` (`dart-dio`, Docker image pinned to an exact tag) into `packages/api_client`, then `build_runner` writes the JSON code.
- The generated code is committed, so CI and fresh clones need no Docker or Java. Nobody edits it by hand: regenerate instead.
- Only feature `data/` layers call it, and they wrap each call in `sendRequestAndReadData`, so Dio errors never reach the UI.

**In our code:** [update_openapi.sh](../../apps/mobile/tool/update_openapi.sh), [generate_api_client.sh](../../apps/mobile/tool/generate_api_client.sh), [api_client_provider.dart](../../apps/mobile/lib/core/network/api_client_provider.dart), [home_repository.dart](../../apps/mobile/lib/features/home/data/home_repository.dart).

**Watch out:**
- `enumUnknownDefaultCase=true` adds an `unknownDefaultOpenApi` value to every enum, so a new value from the server (API §8) does not crash parsing.
- Method names come from the backend's `operationId` (`meControllerGetMeV1`). Wrap them in clearly named repository methods.

**Check yourself:** the backend adds a new optional field to `Me`. Does the old app version break?
<details><summary>Answer</summary>No. Additive changes are safe: the generated `fromJson` ignores unknown keys. Only removing or renaming a field (a breaking change, `/v2`) would break it.</details>
