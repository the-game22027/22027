// Reveal-and-buzz battles against the bot on the local backend, through the app's battle
// data layer with no screen (ROADMAP M1.5). Run by hand, see test_live/README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/data/battle_events.dart';

import 'live_backend.dart';
import 'live_battle.dart';

void main() {
  setUpAll(stopUnlessLiveBackendIsReachable);

  for (final gameType in [
    GameType.buzzer,
    GameType.career,
    GameType.whoIsPlayer,
  ]) {
    final code = convertGameTypeToCode(gameType);
    test(
      'a $code battle against the bot, start to finish',
      () async {
        final player = await signInFreshLivePlayer(code.toLowerCase());
        final run = LiveBattleRun(player, gameType);
        await run.start();

        final result = await run.waitUntilFinished();

        expectBattleCompletedWithPlacements(run, result);
        await expectPlayerToBeIdle(player);
        // ignore: avoid_print
        print(run.summarize(result));
      },
      timeout: const Timeout(Duration(minutes: 6)),
    );
  }
}
