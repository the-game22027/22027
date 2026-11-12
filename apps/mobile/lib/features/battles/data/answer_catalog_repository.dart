import 'dart:isolate';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/features/battles/data/answer_catalog.dart';
import 'package:the_game/features/battles/data/answer_catalog_data_sources.dart';

/// The answer catalog on the phone, kept current with the server (`08-battle-games.md` §5.5).
class AnswerCatalogRepository {
  AnswerCatalogRepository({
    required AnswerCatalogRemoteDataSource remoteDataSource,
    required AnswerCatalogFileStore fileStore,
  }) : _remoteDataSource = remoteDataSource,
       _fileStore = fileStore;

  final AnswerCatalogRemoteDataSource _remoteDataSource;
  final AnswerCatalogFileStore _fileStore;

  StoredAnswerCatalog? _storedCatalog;
  AnswerCatalog? _parsedCatalog;

  /// Asks the server whether the phone's copy is current (a `304` costs a few bytes) and
  /// returns the latest catalog. Offline, the stored copy is used: an older catalog still
  /// lets the player answer. Without any copy, the network error is thrown.
  Future<AnswerCatalog> loadLatestAnswerCatalog() async {
    _storedCatalog ??= await _fileStore.readStoredCatalog();
    final AnswerCatalogDownload download;
    try {
      download = await _remoteDataSource.downloadCatalogIfChanged(
        knownEntityTag: _storedCatalog?.entityTag,
      );
    } on AppError {
      final storedCatalog = _storedCatalog;
      if (storedCatalog == null) rethrow;
      return _parseOnce(storedCatalog);
    }

    switch (download) {
      case AnswerCatalogUnchanged():
        final storedCatalog = _storedCatalog;
        if (storedCatalog == null) {
          throw const UnexpectedResponseError('304 without a stored catalog');
        }
        return _parseOnce(storedCatalog);
      case AnswerCatalogDownloaded(:final catalog):
        final parsedCatalog = await _parseInBackground(catalog);
        await _fileStore.storeCatalog(catalog);
        _storedCatalog = catalog;
        _parsedCatalog = parsedCatalog;
        return parsedCatalog;
    }
  }

  Future<AnswerCatalog> _parseOnce(StoredAnswerCatalog catalog) async =>
      _parsedCatalog ??= await _parseInBackground(catalog);

  /// Parsing the full catalog takes long enough to drop frames, so it runs on another
  /// isolate. A body that breaks the contract is not stored.
  Future<AnswerCatalog> _parseInBackground(StoredAnswerCatalog catalog) async {
    final body = catalog.body;
    try {
      return await Isolate.run(() => parseAnswerCatalog(body));
    } on Object catch (error) {
      throw UnexpectedResponseError(error);
    }
  }
}

final answerCatalogRepositoryProvider = Provider<AnswerCatalogRepository>(
  (ref) => AnswerCatalogRepository(
    remoteDataSource: ref.watch(answerCatalogRemoteDataSourceProvider),
    fileStore: ref.watch(answerCatalogFileStoreProvider),
  ),
);
