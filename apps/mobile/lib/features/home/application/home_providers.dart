import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/home/data/home_repository.dart';

final currentPlayerProfileProvider = FutureProvider.autoDispose<PlayerProfile>(
  (ref) => ref.watch(homeRepositoryProvider).fetchCurrentPlayerProfile(),
);
