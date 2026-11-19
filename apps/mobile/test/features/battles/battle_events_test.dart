import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/data/battle_events.dart';

import 'battle_fixtures.dart';

void main() {
  test('matchmaking:queued has no seq and reads the bot fallback time', () {
    final event = parseBattleServerEvent('matchmaking:queued', {
      'type': 'matchmaking:queued',
      'serverTime': serverTime,
      'data': {
        'ticketId': 't-1',
        'gameType': 'BUZZER',
        'queuedAt': serverTime,
        'botFallbackAt': '2026-11-12T10:00:05.000Z',
      },
    });

    expect(event, isA<MatchmakingQueued>());
    event as MatchmakingQueued;
    expect(event.seq, isNull);
    expect(event.gameType, GameType.buzzer);
    expect(event.botFallbackAt, DateTime.utc(2026, 11, 12, 10, 0, 5));
  });

  test('battle:found reads players, you and the public config', () {
    final event =
        parseBattleServerEvent(
              'battle:found',
              battleEnvelope('battle:found', 1, {
                'gameType': 'BUZZER',
                'mode': 'MATCHMAKING',
                'players': [humanPlayerJson, botPlayerJson],
                'youParticipantId': 'p-human',
                'config': {'roundCount': 5, 'betweenRoundsMs': 3000},
                'readyDeadlineAt': serverTime,
              }),
            )
            as BattleFound;

    expect(event.seq, 1);
    expect(event.battleId, battleId);
    expect(event.isRoomBattle, isFalse);
    expect(event.players.map((player) => player.displayName), [
      'Alice',
      'Bot Karim',
    ]);
    expect(event.players.last.kind, BattlePlayerKind.bot);
    expect(event.publicConfig['roundCount'], 5);
  });

  test('round:start is a reveal round or a grid round by its fields', () {
    final reveal =
        parseBattleServerEvent(
              'round:start',
              battleEnvelope('round:start', 3, {
                'roundNo': 1,
                'gameType': 'CAREER',
                'answerKind': 'PLAYER',
                'stepCount': 6,
              }),
            )
            as RevealRoundStarted;
    final grid =
        parseBattleServerEvent(
              'round:start',
              battleEnvelope('round:start', 3, {
                'roundNo': 1,
                'gameType': 'GRID',
                'rows': [
                  for (final name in ['A', 'B', 'C'])
                    {
                      'kind': 'CLUB',
                      'entity': {'entityId': 'c-$name', 'name': name},
                    },
                ],
                'cols': [
                  for (final name in ['X', 'Y', 'Z'])
                    {
                      'kind': 'NATIONALITY',
                      'entity': {'entityId': 'n-$name', 'name': name},
                    },
                ],
                'firstTurnParticipantId': 'p-bot',
              }),
            )
            as GridRoundStarted;

    expect(reveal.answerKind.code, 'PLAYER');
    expect(reveal.stepCount, 6);
    expect(grid.cols.first.kind, GridCriterionKind.nationality);
    expect(grid.firstTurnParticipantId, 'p-bot');
  });

  test('round:wrong reads an entity answer, a number, or none', () {
    WrongAnswerGiven parse(Map<String, Object?> extra) =>
        parseBattleServerEvent(
              'round:wrong',
              battleEnvelope('round:wrong', 7, {
                'roundNo': 1,
                'participantId': 'p-bot',
                'timedOut': false,
                ...extra,
              }),
            )
            as WrongAnswerGiven;

    expect(
      parse({
        'answer': {'entityId': 'e-1', 'name': 'Nani'},
      }).answer?.entity?.name,
      'Nani',
    );
    expect(
      parse({
        'answer': {'number': 2010},
      }).answer?.number,
      2010,
    );
    expect(parse({}).answer, isNull);
  });

  test(
    'round:result and battle:completed as the backend sends them: scores, placements, '
    'the question id to report and the leaderboard points',
    () {
      final result =
          parseBattleServerEvent('round:result', recordedRoundResultJson)
              as RoundEnded;
      final completed =
          parseBattleServerEvent(
                'battle:completed',
                recordedBattleCompletedJson,
              )
              as BattleCompleted;

      expect(result.questionId, '01a1cf94-8e06-778b-860a-9db35ec13d0a');
      expect(result.winnerParticipantIds, isEmpty);
      expect(result.reveal['steps'], hasLength(4));
      expect(result.pointsByParticipant.values, [0, 0]);
      expect(completed.endReason, 'COMPLETED');
      expect(completed.yourOutcome, BattleOutcome.loss);
      expect(completed.yourPlacement, 2);
      expect(completed.yourPoints, 0);
      expect(completed.placements.first.score, 20);
      expect(completed.arePointsPending, isFalse);
    },
  );

  test('an abandoned battle has no "you" and no placements', () {
    final completed =
        parseBattleServerEvent(
              'battle:completed',
              battleEnvelope('battle:completed', 9, {
                'endReason': 'ABANDONED',
                'placements': <Object>[],
                'pointsPending': false,
              }),
            )
            as BattleCompleted;

    expect(completed.yourOutcome, isNull);
    expect(completed.yourPoints, isNull);
    expect(completed.placements, isEmpty);
  });

  test('error carries its code; unknown events are tolerated', () {
    final error = parseBattleServerEvent('error', {
      'type': 'error',
      'serverTime': serverTime,
      'data': {'code': 'NO_CONTENT', 'message': 'No battle could be started'},
    });
    final future = parseBattleServerEvent(
      'battle:emote',
      battleEnvelope('battle:emote', 12, {'emote': 'clap'}),
    );

    expect((error as BattleServerError).code, 'NO_CONTENT');
    expect(future, isA<UnknownBattleEvent>());
    expect(future.seq, 12);
  });

  test('a broken event names the event and the field', () {
    expect(
      () => parseBattleServerEvent(
        'round:buzzed',
        battleEnvelope('round:buzzed', 6, {
          'roundNo': 1,
          'participantId': 'p-bot',
        }),
      ),
      throwsA(
        isA<FormatException>().having(
          (error) => error.message,
          'message',
          contains('round:buzzed.data: "answerDeadlineAt"'),
        ),
      ),
    );
  });
}
