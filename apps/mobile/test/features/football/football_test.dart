import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/features/football/application/football_providers.dart';
import 'package:the_game/features/football/data/football_models.dart';
import 'package:the_game/features/football/data/football_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

const _teamJson = {
  'id': 'team-home',
  'name': 'Home FC',
  'shortName': 'HOM',
  'crestUrl': null,
  'type': 'CLUB',
};

Map<String, Object?> matchJson(String id, {String status = 'SCHEDULED'}) => {
  'id': id,
  'competition': {'id': 'c-1', 'name': 'Premier League', 'code': 'PL'},
  'roundLabel': 'Matchday 1',
  'homeTeam': _teamJson,
  'awayTeam': {..._teamJson, 'id': 'team-away', 'type': 'NATIONAL'},
  'kickoffAt': '2026-11-14T15:00:00Z',
  'status': status,
  'score': null,
  'predictable': true,
};

void main() {
  late FakeHttpAdapter adapter;

  test('match list filters are sent as the API expects', () async {
    adapter = FakeHttpAdapter(
      (_) => jsonResponse({'items': <Object>[], 'nextCursor': null}),
    );
    final container = await createSignedInTestContainer(adapter);

    await container
        .read(footballRepositoryProvider)
        .fetchMatches(
          kickoffFrom: DateTime.utc(2026, 11, 14),
          kickoffTo: DateTime.utc(2026, 11, 15),
          competitionId: 'c-1',
          status: MatchStatus.scheduled,
          limit: 10,
        );

    final query = adapter.sentRequests.single.queryParameters;
    expect(query, {
      'from': '2026-11-14T00:00:00.000Z',
      'to': '2026-11-15T00:00:00.000Z',
      'competitionId': 'c-1',
      'status': 'SCHEDULED',
      'limit': 10,
    });
  });

  test(
    'a match is mapped to app models; unknown values are tolerated',
    () async {
      adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          ...matchJson('m-1', status: 'SUSPENDED'),
          'score': {
            'home': 1,
            'away': 1,
            'decidedBy': 'PENALTIES',
            'penalties': {'home': 4, 'away': 3},
          },
          'endedAt': '2026-11-14T17:10:00Z',
          'serverTime': '2026-11-14T18:00:00.123Z',
        }),
      );
      final container = await createSignedInTestContainer(adapter);

      final detail = await container.read(matchDetailProvider('m-1').future);

      expect(adapter.sentRequests.single.path, '/v1/matches/m-1');
      expect(detail.match.status, MatchStatus.unknown);
      expect(detail.match.homeTeam.type, TeamType.club);
      expect(detail.match.awayTeam.type, TeamType.national);
      expect(detail.match.kickoffAt, DateTime.utc(2026, 11, 14, 15));
      expect(detail.match.score?.penalties?.home, 4);
      expect(detail.serverTime, DateTime.utc(2026, 11, 14, 18, 0, 0, 123));
    },
  );

  test(
    'a malformed timestamp is an unexpected response, not a crash',
    () async {
      adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          'items': [
            {...matchJson('m-1'), 'kickoffAt': 'tomorrow'},
          ],
          'nextCursor': null,
        }),
      );
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container.read(footballRepositoryProvider).fetchMatches(),
        throwsA(isA<UnexpectedResponseError>()),
      );
    },
  );

  test('squads and competitions are read', () async {
    adapter = FakeHttpAdapter(
      (request) => request.path.endsWith('/squads')
          ? jsonResponse({
              'items': [
                {
                  'playerId': 'p-1',
                  'name': 'Player One',
                  'teamId': 'team-home',
                  'role': 'STARTER',
                  'shirtNumber': 9,
                },
                {
                  'playerId': 'p-2',
                  'name': 'Player Two',
                  'teamId': 'team-home',
                  'role': 'BENCH_COACH',
                  'shirtNumber': null,
                },
              ],
            })
          : jsonResponse({
              'items': [
                {
                  'id': 'c-1',
                  'code': 'PL',
                  'name': 'Premier League',
                  'type': 'LEAGUE',
                  'countryCode': 'GB',
                  'isNationalTeams': false,
                },
              ],
            }),
    );
    final container = await createSignedInTestContainer(adapter);

    final squad = await container.read(matchSquadsProvider('m-1').future);
    final competitions = await container.read(
      activeCompetitionsProvider.future,
    );

    expect(squad.map((player) => player.role), [
      SquadRole.starter,
      SquadRole.unknown,
    ]);
    expect(squad.first.shirtNumber, 9);
    expect(competitions.single.code, 'PL');
  });

  group('MatchListController', () {
    const filter = MatchListFilter(competitionId: 'c-1', pageSize: 2);

    ResponseBody answerPage(RequestOptions request) =>
        switch (request.queryParameters['cursor']) {
          null => jsonResponse({
            'items': [matchJson('m-1'), matchJson('m-2')],
            'nextCursor': 'page-2',
          }),
          'page-2' => jsonResponse({
            'items': [matchJson('m-3')],
            'nextCursor': null,
          }),
          _ => problemResponse(400, 'VALIDATION_FAILED'),
        };

    test('loads pages with the same filter until the last one', () async {
      adapter = FakeHttpAdapter(answerPage);
      final container = await createSignedInTestContainer(adapter);
      container.listen(matchListProvider(filter), (_, _) {});
      await container.read(matchListProvider(filter).future);

      final controller = container.read(matchListProvider(filter).notifier);
      await controller.loadNextPage();
      await controller.loadNextPage(); // last page reached: no request

      final list = container.read(matchListProvider(filter)).value!;
      expect(list.matches.map((match) => match.id), ['m-1', 'm-2', 'm-3']);
      expect(list.hasMorePages, isFalse);
      expect(adapter.sentRequests, hasLength(2));
      expect(
        adapter.sentRequests.last.queryParameters,
        containsPair('competitionId', 'c-1'),
      );
    });

    test('two calls at once load the next page only once', () async {
      adapter = FakeHttpAdapter(answerPage);
      final container = await createSignedInTestContainer(adapter);
      container.listen(matchListProvider(filter), (_, _) {});
      await container.read(matchListProvider(filter).future);

      final controller = container.read(matchListProvider(filter).notifier);
      await Future.wait([controller.loadNextPage(), controller.loadNextPage()]);

      expect(adapter.sentRequests, hasLength(2));
    });

    test('a failed next page keeps the loaded matches', () async {
      var isOffline = false;
      adapter = FakeHttpAdapter(
        (request) => isOffline
            ? throw DioException.connectionError(
                requestOptions: request,
                reason: 'offline',
              )
            : answerPage(request),
      );
      final container = await createSignedInTestContainer(adapter);
      container.listen(matchListProvider(filter), (_, _) {});
      await container.read(matchListProvider(filter).future);
      isOffline = true;

      await expectLater(
        container.read(matchListProvider(filter).notifier).loadNextPage(),
        throwsA(isA<ServerUnreachableError>()),
      );

      expect(
        container.read(matchListProvider(filter)).value?.matches,
        hasLength(2),
      );
    });
  });
}
