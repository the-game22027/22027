// Reveal-and-buzz battles against the bot on the local backend, through the app's battle
// data layer with no screen (ROADMAP M1.5). Run by hand, see test_live/README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/question_reports_repository.dart';

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
        if (gameType == GameType.buzzer) {
          await _reportAQuestionOfTheBattle(
            player,
            result.battle!.finishedRounds.first.questionId,
          );
        }
        // ignore: avoid_print
        print(run.summarize(result));
      },
      timeout: const Timeout(Duration(minutes: 6)),
    );
  }
}

/// `POST /v1/questions/{questionId}/reports` for a question this player was served: accepted,
/// and again as a no-op. A question never served is refused.
Future<void> _reportAQuestionOfTheBattle(
  LivePlayer player,
  String questionId,
) async {
  final reports = player.read(questionReportsRepositoryProvider);
  const reason =
      'Automated live check (apps/mobile/test_live), not a real report.';

  await reports.reportQuestion(questionId: questionId, reason: reason);
  await reports.reportQuestion(questionId: questionId, reason: reason);

  await expectLater(
    reports.reportQuestion(
      questionId: '00000000-0000-7000-8000-000000000000',
      reason: reason,
    ),
    throwsA(
      isA<KnownProblemError<QuestionReportFailureReason>>().having(
        (error) => error.reason,
        'reason',
        QuestionReportFailureReason.questionNotFound,
      ),
    ),
  );
}
