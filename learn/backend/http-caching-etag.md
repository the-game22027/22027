# HTTP caching with `ETag`
> The server labels a response with a version tag; the client sends the tag back and gets `304 Not Modified` when nothing changed.

**Problem:** the answer catalog is about 2 MB gzipped. Downloading it before every battle wastes the player's data and our bandwidth, but a copy the app never refreshes goes stale after the next import.

**How:**
- The response carries `ETag: "<version>"`. Our version is the checksum of the imported catalog, so the same tag always means the same body.
- The app stores the body and the tag. Next time it sends `If-None-Match: "<tag>"`.
- Same version → `304` with no body (a few bytes). New version → `200` with the new body and tag.
- `Cache-Control: private, no-cache` means "you may keep it, but ask me before using it". `no-cache` is not `no-store`.
- `Vary: Accept-Encoding`: the gzip and plain bodies are different bytes for the same URL.

**In our code:** [answer-catalog.controller.ts](../../apps/backend/src/modules/question-bank/presentation/answer-catalog.controller.ts), the header rules in [http-caching.ts](../../apps/backend/src/modules/question-bank/presentation/http-caching.ts), the build-once memory cache in [answer-catalog-document.cache.ts](../../apps/backend/src/modules/question-bank/presentation/answer-catalog-document.cache.ts).

**Watch out:**
- Check the tag before building the body, or a `304` still costs the full build.
- The tag must come from what is actually sent. We read the version and the entities in one `REPEATABLE READ` transaction, so an import in between cannot pair an old tag with a new body.

**Check yourself:** why `no-cache` and not `max-age=86400`?
<details><summary>Answer</summary>With `max-age` the phone would use its copy for a day without asking, even right after a new catalog is imported. `no-cache` always asks, and the answer is usually a tiny `304`.</details>
