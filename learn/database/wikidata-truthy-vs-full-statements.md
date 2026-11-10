# Wikidata: truthy vs full statements
> `wdt:` gives only the best-ranked value of a property; `p:/ps:` gives every value, with its qualifiers.

**Problem:** we asked Wikidata "players who played for Real Madrid and Juventus" with `wdt:P54` and got 12 names, without Cristiano Ronaldo, Morata or Di María. Building the Career game on that would silently drop half of every career.

**How:**
- Every Wikidata statement has a rank: preferred, normal, deprecated.
- `wdt:P54` ("truthy") returns only the highest rank. When a player's current club is marked *preferred*, every former club is hidden.
- `?p p:P54 ?st . ?st ps:P54 ?club` returns all statements; `?st pq:P580 ?from` reads qualifiers like start and end dates.
- Same query with full statements: 17 players instead of 12.

**In our code:** the data check in `docs/architecture/07-football-data-and-questions.md` §4.1; the Track D career import must use `p:/ps:/pq:`.

**Watch out:**
- Full statements include loans and repeated spells (Morata appeared 4 times): merge consecutive spells at the same club.
- Youth and reserve teams are separate items; filter them by type.

**Check yourself:** a player has 6 clubs on Wikidata and the current one is preferred. How many clubs does `wdt:P54` return?
<details><summary>Answer</summary>One: only the preferred statement. `p:P54/ps:P54` returns all six.</details>
