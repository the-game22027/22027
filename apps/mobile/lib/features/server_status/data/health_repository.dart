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
  /// Redis is down (API §6.11), so any failure here just means "down".
  @override
  Future<ServerHealth> checkServerHealth() async {
    try {
      final response = await _readinessCheck();
      return response.statusCode == 200 ? ServerHealth.up : ServerHealth.down;
    } on DioException {
      return ServerHealth.down;
    }
  }
}

final healthRepositoryProvider = Provider<HealthRepository>((ref) {
  final opsApi = ref.watch(apiClientProvider).getOpsApi();
  return ApiHealthRepository(opsApi.healthControllerReady);
});
