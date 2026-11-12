import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/features/battles/application/answer_catalog_controller.dart';
import 'package:the_game/features/battles/data/answer_catalog.dart';
import 'package:the_game/features/battles/data/answer_catalog_data_sources.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

Map<String, Object?> entityJson(
  String id,
  String kind,
  List<String> search, {
  num popularity = 1,
}) => {
  'id': id,
  'kind': kind,
  'names': {'en': 'name $id', 'ar': 'اسم $id'},
  'search': search,
  'popularity': popularity,
};

final _catalogJson = {
  'version': 'v1',
  'entities': [
    entityJson('ronaldo', 'PLAYER', [
      'cristiano ronaldo',
      'كريستيانو رونالدو',
    ], popularity: 90),
    entityJson('ronaldo-nazario', 'PLAYER', [
      'ronaldo nazario',
    ], popularity: 80),
    entityJson('ronaldinho', 'PLAYER', ['ronaldinho'], popularity: 70),
    entityJson('real-madrid', 'CLUB', ['real madrid', 'ريال مدريد']),
    entityJson('ahly', 'CLUB', ['اهلي']),
    entityJson('future-kind', 'STADIUM', ['ronaldo stadium']),
  ],
};

ResponseBody catalogResponse(String entityTag) => ResponseBody.fromString(
  jsonEncode(_catalogJson),
  200,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
    'etag': [entityTag],
  },
);

void main() {
  group('findSuggestions', () {
    final catalog = parseAnswerCatalog(jsonEncode(_catalogJson));

    List<String> suggest(String text, Set<AnswerEntityKind> kinds) => [
      for (final entity in catalog.findSuggestions(text, kinds: kinds))
        entity.id,
    ];

    test('a name prefix ranks first, then a word prefix, then popularity', () {
      expect(suggest('Ronald', {AnswerEntityKind.player}), [
        'ronaldo-nazario', // starts with "ronald", popularity 80
        'ronaldinho', // starts with "ronald", popularity 70
        'ronaldo', // a later word starts with "ronald"
      ]);
    });

    test('only the kinds the round accepts; unknown kinds never show', () {
      expect(suggest('r', {AnswerEntityKind.club}), ['real-madrid']);
    });

    test('typed text is normalized like the stored forms', () {
      expect(suggest('الأهلي', {AnswerEntityKind.club}), ['ahly']);
      expect(suggest('رونالدو', {AnswerEntityKind.player}), ['ronaldo']);
      expect(suggest('  ', {AnswerEntityKind.player}), isEmpty);
    });
  });

  group('AnswerCatalogRepository', () {
    late Directory directory;
    late FakeHttpAdapter adapter;

    setUp(() async {
      directory = await Directory.systemTemp.createTemp('catalog_test');
      addTearDown(() => directory.delete(recursive: true));
    });

    Future<AnswerCatalogController> createController() async {
      final container = await createSignedInTestContainer(
        adapter,
        extraOverrides: [
          answerCatalogFileStoreProvider.overrideWithValue(
            AnswerCatalogFileStore(() async => directory),
          ),
        ],
      );
      // Riverpod 3 pauses providers nobody listens to, retries included.
      container.listen(answerCatalogProvider, (_, _) {});
      await container.read(answerCatalogProvider.future);
      return container.read(answerCatalogProvider.notifier);
    }

    test('a first download is stored with its ETag', () async {
      adapter = FakeHttpAdapter((_) => catalogResponse('"v1"'));

      await createController();

      expect(adapter.sentRequests.single.headers['If-None-Match'], isNull);
      expect(
        File('${directory.path}/answer_catalog.etag').readAsStringSync(),
        '"v1"',
      );
    });

    test('a stored copy is revalidated; 304 keeps it', () async {
      adapter = FakeHttpAdapter((_) => catalogResponse('"v1"'));
      await createController();
      adapter = FakeHttpAdapter((_) => ResponseBody.fromString('', 304));

      final controller = await createController();
      final catalog = await controller.revalidateBeforePlaying();

      expect(adapter.sentRequests.first.headers['If-None-Match'], '"v1"');
      expect(catalog.entities, hasLength(6));
    });

    test(
      'offline with a stored copy uses it; offline without one fails',
      () async {
        DioException offline(RequestOptions request) =>
            DioException.connectionError(
              requestOptions: request,
              reason: 'offline',
            );
        adapter = FakeHttpAdapter((request) => throw offline(request));

        await expectLater(
          createController(),
          throwsA(isA<ServerUnreachableError>()),
        );

        adapter = FakeHttpAdapter((_) => catalogResponse('"v1"'));
        await createController();
        adapter = FakeHttpAdapter((request) => throw offline(request));
        final controller = await createController();

        expect((await controller.revalidateBeforePlaying()).version, 'v1');
      },
    );

    test('a body that breaks the contract is not stored', () async {
      adapter = FakeHttpAdapter(
        (_) => ResponseBody.fromString(
          '{"version": 1}',
          200,
          headers: {
            'etag': ['"broken"'],
          },
        ),
      );

      await expectLater(
        createController(),
        throwsA(isA<UnexpectedResponseError>()),
      );
      expect(
        File('${directory.path}/answer_catalog.etag').existsSync(),
        isFalse,
      );
    });
  });
}
