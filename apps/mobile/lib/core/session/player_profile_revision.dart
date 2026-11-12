import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Counts the profile changes this app has saved on the server (`PATCH /v1/me`).
///
/// A screen that shows the profile watches it to refetch after an edit made elsewhere in the
/// app, for example a language change in Settings, without the features importing each other.
class PlayerProfileRevisionController extends Notifier<int> {
  @override
  int build() => 0;

  void recordProfileChange() => state++;
}

final playerProfileRevisionProvider =
    NotifierProvider<PlayerProfileRevisionController, int>(
      PlayerProfileRevisionController.new,
    );
