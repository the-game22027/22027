import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/answer_catalog/data/answer_catalog.dart';
import 'package:the_game/features/answer_catalog/data/answer_catalog_repository.dart';

/// The answer catalog for the whole app session. Kept alive: it is large, and every battle
/// searches it.
class AnswerCatalogController extends AsyncNotifier<AnswerCatalog> {
  @override
  Future<AnswerCatalog> build() =>
      ref.read(answerCatalogRepositoryProvider).loadLatestAnswerCatalog();

  /// Call before a battle (API §6.6: the app revalidates its copy before playing). The
  /// current catalog stays readable while the server is asked.
  Future<AnswerCatalog> revalidateBeforePlaying() async {
    final catalog = await ref
        .read(answerCatalogRepositoryProvider)
        .loadLatestAnswerCatalog();
    state = AsyncData(catalog);
    return catalog;
  }
}

final answerCatalogProvider =
    AsyncNotifierProvider<AnswerCatalogController, AnswerCatalog>(
      AnswerCatalogController.new,
    );
