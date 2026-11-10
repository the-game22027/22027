import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/network/api_client_provider.dart';

enum ServerHealth { up, down }

/// Port so the status screen can be tested without a server.
abstract interface class HealthRepository {
  Future<ServerHealth> checkServerHealth();
}

class ApiHealthRepository implements HealthRepository {
  ApiHealthRepository(this._readinessCheck);

  final Future<Response<Object>> Function() _readinessCheck;

  /// `/health/ready` answers `503` with a Terminus body (not problem+json) when Postgres or
  /// Redis is down (API §6.11), so only a 200 means "up".
  @override
  Future<ServerHealth> checkServerHealth() async {
    int? statusCode;
    try {
      statusCode = (await _readinessCheck()).statusCode;
    } on DioException catch (exception) {
      // The contract types this body as a bare `object`, which the generated client cannot
      // parse, so even a 200 ends up here. The status code alone answers "is it ready?".
      statusCode = exception.response?.statusCode;
    }
    return statusCode == 200 ? ServerHealth.up : ServerHealth.down;
  }
}

final healthRepositoryProvider = Provider<HealthRepository>((ref) {
  final opsApi = ref.watch(apiClientProvider).getOpsApi();
  return ApiHealthRepository(opsApi.healthControllerReady);
});
