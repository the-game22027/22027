import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/features/predictions/application/own_prediction_controller.dart';
import 'package:the_game/features/predictions/data/prediction_models.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

Map<String, Object?> predictionJson({int home = 2, int away = 1}) => {
  'id': 'pr-1',
  'matchId': 'm-1',
  'picks': [
    {'type': 'EXACT_SCORE', 'home': home, 'away': away},
    {'type': 'RESULT', 'outcome': home > away ? 'HOME' : 'DRAW'},
    {'type': 'MOTM', 'playerId': 'p-1'},
  ],
  'revision': 3,
  'status': 'ACTIVE',
  'updatedAt': '2026-11-14T12:00:00Z',
  'locked': false,
};

void main() {
  test('no prediction yet (404) is null, not an error', () async {
    final adapter = FakeHttpAdapter((_) => problemResponse(404, 'NOT_FOUND'));
    final container = await createSignedInTestContainer(adapter);

    final prediction = await container.read(
      ownPredictionProvider('m-1').future,
    );

    expect(prediction, isNull);
    expect(adapter.sentRequests.single.path, '/v1/matches/m-1/prediction');
  });

  test('picks are mapped; unknown pick types are kept as unknown', () async {
    final adapter = FakeHttpAdapter((_) => jsonResponse(predictionJson()));
    final container = await createSignedInTestContainer(adapter);

    final prediction = (await container.read(
      ownPredictionProvider('m-1').future,
    ))!;

    expect(prediction.exactScore?.home, 2);
    expect(prediction.picks[1], isA<ResultPick>());
    expect((prediction.picks[1] as ResultPick).outcome, MatchOutcome.home);
    expect(prediction.picks[2], isA<UnknownPick>());
    expect(prediction.revision, 3);
  });

  test('submitting sends one EXACT_SCORE pick and stores the result', () async {
    final adapter = FakeHttpAdapter(
      (request) => request.method == 'PUT'
          ? jsonResponse(predictionJson(home: 3, away: 0))
          : problemResponse(404, 'NOT_FOUND'),
    );
    final container = await createSignedInTestContainer(adapter);
    container.listen(ownPredictionProvider('m-1'), (_, _) {});
    await container.read(ownPredictionProvider('m-1').future);

    await container
        .read(ownPredictionProvider('m-1').notifier)
        .submitExactScore(homeGoals: 3, awayGoals: 0);

    final request = adapter.sentRequests.last;
    expect(request.method, 'PUT');
    expect(jsonDecode(request.data as String), {
      'picks': [
        {'type': 'EXACT_SCORE', 'home': 3, 'away': 0},
      ],
    });
    expect(
      container.read(ownPredictionProvider('m-1')).value?.exactScore?.home,
      3,
    );
  });

  test(
    'a locked match keeps the previous prediction and surfaces the code',
    () async {
      final adapter = FakeHttpAdapter(
        (request) => request.method == 'PUT'
            ? problemResponse(409, 'PREDICTION_LOCKED')
            : jsonResponse(predictionJson()),
      );
      final container = await createSignedInTestContainer(adapter);
      container.listen(ownPredictionProvider('m-1'), (_, _) {});
      await container.read(ownPredictionProvider('m-1').future);

      await expectLater(
        container
            .read(ownPredictionProvider('m-1').notifier)
            .submitExactScore(homeGoals: 0, awayGoals: 0),
        throwsA(
          isA<ApiProblemError>().having(
            (error) => error.problem.code,
            'code',
            'PREDICTION_LOCKED',
          ),
        ),
      );
      expect(
        container.read(ownPredictionProvider('m-1')).value?.exactScore?.home,
        2,
      );
    },
  );

  test('negative goals are refused before any request', () async {
    final adapter = FakeHttpAdapter(
      (request) => request.method == 'GET'
          ? problemResponse(404, 'NOT_FOUND')
          : throw DioException.connectionError(
              requestOptions: request,
              reason: 'must not be sent',
            ),
    );
    final container = await createSignedInTestContainer(adapter);
    container.listen(ownPredictionProvider('m-1'), (_, _) {});
    await container.read(ownPredictionProvider('m-1').future);

    expect(
      () => container
          .read(ownPredictionProvider('m-1').notifier)
          .submitExactScore(homeGoals: -1, awayGoals: 0),
      throwsArgumentError,
    );
    expect(adapter.sentRequests, hasLength(1));
  });
}
