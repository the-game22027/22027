import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

/// The catalog body as received, with the `ETag` that identifies its version.
class StoredAnswerCatalog {
  const StoredAnswerCatalog({required this.entityTag, required this.body});

  /// Sent back as `If-None-Match` (quotes included, exactly as the server wrote it).
  final String entityTag;
  final String body;
}

sealed class AnswerCatalogDownload {
  const AnswerCatalogDownload();
}

/// `304`: the copy on the phone is current.
class AnswerCatalogUnchanged extends AnswerCatalogDownload {
  const AnswerCatalogUnchanged();
}

class AnswerCatalogDownloaded extends AnswerCatalogDownload {
  const AnswerCatalogDownloaded(this.catalog);

  final StoredAnswerCatalog catalog;
}

/// `GET /v1/answer-catalog` (API §6.6). Not the generated client: the body is kept as text to
/// be stored as is, and `304` is a normal answer here, not an error.
class AnswerCatalogRemoteDataSource {
  AnswerCatalogRemoteDataSource(this._dio);

  final Dio _dio;

  Future<AnswerCatalogDownload> downloadCatalogIfChanged({
    String? knownEntityTag,
  }) async {
    final Response<String> response;
    try {
      response = await _dio.get<String>(
        '/v1/answer-catalog',
        options: Options(
          responseType: ResponseType.plain,
          headers: {'If-None-Match': ?knownEntityTag},
          validateStatus: (status) => status == 200 || status == 304,
        ),
      );
    } on DioException catch (exception) {
      throw convertDioExceptionToAppError(exception);
    }
    if (response.statusCode == 304) return const AnswerCatalogUnchanged();

    final body = response.data;
    final entityTag = response.headers.value('etag');
    if (body == null || entityTag == null) {
      throw const UnexpectedResponseError('catalog without body or ETag');
    }
    return AnswerCatalogDownloaded(
      StoredAnswerCatalog(entityTag: entityTag, body: body),
    );
  }
}

/// The last downloaded catalog, kept as two files in the app support directory (not a cache
/// directory: the system must not delete it before a battle).
class AnswerCatalogFileStore {
  AnswerCatalogFileStore(this._findDirectory);

  final Future<Directory> Function() _findDirectory;

  static const _bodyFileName = 'answer_catalog.json';
  static const _entityTagFileName = 'answer_catalog.etag';

  /// `null` when nothing was stored yet or a file is missing.
  Future<StoredAnswerCatalog?> readStoredCatalog() async {
    final directory = await _findDirectory();
    final bodyFile = File('${directory.path}/$_bodyFileName');
    final entityTagFile = File('${directory.path}/$_entityTagFileName');
    if (!await bodyFile.exists() || !await entityTagFile.exists()) return null;
    return StoredAnswerCatalog(
      entityTag: await entityTagFile.readAsString(),
      body: await bodyFile.readAsString(),
    );
  }

  /// Writes the body first and the tag last, each through a temporary file and a rename, so
  /// a crash never leaves a tag that claims a body it does not have.
  Future<void> storeCatalog(StoredAnswerCatalog catalog) async {
    final directory = await _findDirectory();
    await _writeFileAtomically(directory, _bodyFileName, catalog.body);
    await _writeFileAtomically(
      directory,
      _entityTagFileName,
      catalog.entityTag,
    );
  }

  Future<void> _writeFileAtomically(
    Directory directory,
    String fileName,
    String content,
  ) async {
    final temporaryFile = File('${directory.path}/$fileName.tmp');
    await temporaryFile.writeAsString(content, flush: true);
    await temporaryFile.rename('${directory.path}/$fileName');
  }
}

final answerCatalogRemoteDataSourceProvider =
    Provider<AnswerCatalogRemoteDataSource>(
      (ref) => AnswerCatalogRemoteDataSource(ref.watch(dioProvider)),
    );

final answerCatalogFileStoreProvider = Provider<AnswerCatalogFileStore>(
  (ref) => AnswerCatalogFileStore(getApplicationSupportDirectory),
);
