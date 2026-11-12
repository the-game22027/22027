# ETag: download a big file only when it changed
> The server labels each version of a resource with an `ETag`; the app sends it back in `If-None-Match`, and the server answers `304 Not Modified` with no body when nothing changed.

**Problem:** the answer catalog is about 2 MB compressed and changes rarely, but the app must be sure it is current before every battle. Downloading it every time wastes data and seconds; never checking risks a missing player name in a round.

**How:**
- First download: `200` + body + `ETag: "<version>"`. Store both, body first, each through a temp file and a rename (a crash never leaves a tag without its body).
- Next time: `If-None-Match: "<version>"` → `304` (a few bytes) or `200` with the new version.
- Offline: use the stored copy; an older catalog still lets the player answer.
- Parse off the UI isolate (`Isolate.run`): 11 MB of JSON would freeze frames.

**In our code:** [answer_catalog_data_sources.dart](../../apps/mobile/lib/features/battles/data/answer_catalog_data_sources.dart), [answer_catalog_repository.dart](../../apps/mobile/lib/features/battles/data/answer_catalog_repository.dart), API §6.6, `08-battle-games.md` §5.5.

**Watch out:**
- `304` is a success here: Dio treats it as an error unless `validateStatus` allows it.
- Send the tag back exactly as received, quotes included.
- Store in the app *support* directory, not *cache*: the system may empty a cache directory right before a battle.

**Check yourself:** why not compare the `version` field inside the JSON instead of using `ETag`?
<details><summary>Answer</summary>To read the field you must download the whole body first, which is exactly the cost we want to avoid. The ETag check happens before the body is sent.</details>
