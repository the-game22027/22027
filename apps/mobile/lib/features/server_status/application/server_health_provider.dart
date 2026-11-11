import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/server_status/data/health_repository.dart';

final serverHealthProvider = FutureProvider.autoDispose<ServerHealth>(
  (ref) => ref.watch(healthRepositoryProvider).checkServerHealth(),
);
