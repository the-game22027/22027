import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/server_status/data/health_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

/// Runs the real generated client, so contract quirks (like the untyped health body) show up.
void main() {
  Future<ServerHealth> checkHealthWithServerAnswer(
    ResponseBody Function(RequestOptions request) answerRequest,
  ) async {
    final container = ProviderContainer(
      overrides: await createTestOverrides(
        httpClientAdapter: FakeHttpAdapter(answerRequest),
      ),
    );
    addTearDown(container.dispose);
    return container.read(healthRepositoryProvider).checkServerHealth();
  }

  test('a 200 from /health/ready means up', () async {
    final health = await checkHealthWithServerAnswer(
      (_) => jsonResponse({
        'status': 'ok',
        'info': {
          'database': {'status': 'up'},
        },
      }),
    );

    expect(health, ServerHealth.up);
  });

  test('a 503 from /health/ready means down', () async {
    final health = await checkHealthWithServerAnswer(
      (_) => jsonResponse({
        'status': 'error',
        'error': {
          'redis': {'status': 'down'},
        },
      }, status: 503),
    );

    expect(health, ServerHealth.down);
  });

  test('no connection means down', () async {
    final health = await checkHealthWithServerAnswer(
      (request) => throw DioException.connectionError(
        requestOptions: request,
        reason: 'Connection refused',
      ),
    );

    expect(health, ServerHealth.down);
  });
}
