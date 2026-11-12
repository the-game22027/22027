import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/session/player_profile_revision.dart';

import 'package:the_game/features/home/data/home_repository.dart';

/// Refetched whenever the app saves a profile change, wherever it was made.
final currentPlayerProfileProvider = FutureProvider.autoDispose<PlayerProfile>((
  ref,
) {
  ref.watch(playerProfileRevisionProvider);
  return ref.watch(homeRepositoryProvider).fetchCurrentPlayerProfile();
});
