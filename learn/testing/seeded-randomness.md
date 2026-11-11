# Seeded randomness
> Use a random generator started from a stored number (the seed), so the same seed gives the same "random" choices again.

**Problem:** bots decide at random when to buzz and whether they know the answer. With `Math.random()`, a bug seen in one battle can never be replayed, and a test cannot say what the bot will do.

**How:**
- Domain code asks a `RandomSource` for numbers; it never calls `Math.random()`.
- `SeededRandom` (mulberry32) turns a 32-bit seed into the same sequence every time.
- Each battle picks a seed at creation and stores it in `battles.config`, so its bot can be replayed.
- Tests pass a fixed seed, or a profile whose chances are 0 or 1, and get exact answers.

**In our code:** [random-source.ts](../../apps/backend/src/modules/battles/domain/random-source.ts), `planBotRound` in [reveal-and-buzz-bot.ts](../../apps/backend/src/modules/battles/domain/bots/reveal-and-buzz-bot.ts), the seed in `BattleEngine.createBotBattle`.

**Watch out:**
- Every draw changes the sequence: adding one `random.next()` call shifts all later choices. Replays need the same code version too.
- Not for secrets: a seeded generator is predictable by design. Ids and tokens use `crypto`.

**Check yourself:** the e2e test needs a bot that always loses. Does it need a seed?
<details><summary>Answer</summary>No: a profile with `knowsAnswerByDifficulty` all 0 and `guessChance` 0 never buzzes, whatever the seed. Chances of exactly 0 or 1 make behavior certain.</details>
