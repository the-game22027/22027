import 'dart:convert';

import 'package:the_game/features/battles/application/name_normalization.dart';

/// What a typed answer can be (`AnswerKind` in `WEBSOCKET.md` §2, without `NUMBER`).
enum AnswerEntityKind {
  player,
  club,
  nationalTeam,
  country,
  competition,
  coach,
  unknown,
}

AnswerEntityKind findAnswerEntityKindByCode(String code) => switch (code) {
  'PLAYER' => AnswerEntityKind.player,
  'CLUB' => AnswerEntityKind.club,
  'NATIONAL_TEAM' => AnswerEntityKind.nationalTeam,
  'COUNTRY' => AnswerEntityKind.country,
  'COMPETITION' => AnswerEntityKind.competition,
  'COACH' => AnswerEntityKind.coach,
  _ => AnswerEntityKind.unknown,
};

class AnswerEntity {
  const AnswerEntity({
    required this.id,
    required this.kind,
    required this.englishName,
    required this.arabicName,
    required this.searchForms,
    required this.popularity,
  });

  /// What the app sends as the answer (`{ entityId }`): answers are ids, never text (DEC-55).
  final String id;
  final AnswerEntityKind kind;
  final String englishName;
  final String arabicName;

  /// Names and aliases already in matching form (07 §5.7).
  final List<String> searchForms;
  final num popularity;

  String findNameForLanguage(String languageCode) =>
      languageCode == 'ar' ? arabicName : englishName;
}

/// The whole answer catalog, searched on the phone (`08-battle-games.md` §5.2).
class AnswerCatalog {
  AnswerCatalog({required this.version, required this.entities});

  /// The server's checksum of the catalog; `none` before any import.
  final String version;
  final List<AnswerEntity> entities;

  /// The suggestions for what the player has typed so far: entities of the allowed [kinds]
  /// with a name that starts with the text (best) or has a word that starts with it, then the
  /// most popular first. Nothing about the current round is used, so the ranking never
  /// hints at the answer.
  List<AnswerEntity> findSuggestions(
    String typedText, {
    required Set<AnswerEntityKind> kinds,
    int limit = 8,
  }) {
    final query = convertNameToMatchingForm(typedText);
    if (query.isEmpty) return const [];
    final wordStartQuery = ' $query';

    final matches = <(AnswerEntity, int)>[];
    for (final entity in entities) {
      if (!kinds.contains(entity.kind)) continue;
      int? bestRank;
      for (final form in entity.searchForms) {
        if (form.startsWith(query)) {
          bestRank = 0;
          break;
        }
        if (form.contains(wordStartQuery)) bestRank = 1;
      }
      if (bestRank != null) matches.add((entity, bestRank));
    }
    matches.sort((a, b) {
      final byRank = a.$2.compareTo(b.$2);
      return byRank != 0 ? byRank : b.$1.popularity.compareTo(a.$1.popularity);
    });
    return [for (final (entity, _) in matches.take(limit)) entity];
  }
}

/// Parses the `GET /v1/answer-catalog` body. Throws [FormatException] when the body does not
/// match the contract. Run it off the UI isolate: the full catalog is about 11 MB of JSON.
AnswerCatalog parseAnswerCatalog(String body) {
  final json = jsonDecode(body);
  if (json is! Map<String, Object?>) {
    throw const FormatException('answer catalog is not a JSON object');
  }
  final version = json['version'];
  final entities = json['entities'];
  if (version is! String || entities is! List) {
    throw const FormatException('answer catalog misses version or entities');
  }
  return AnswerCatalog(
    version: version,
    entities: [
      for (final entity in entities.cast<Map<String, Object?>>())
        AnswerEntity(
          id: entity['id']! as String,
          kind: findAnswerEntityKindByCode(entity['kind']! as String),
          englishName: (entity['names']! as Map)['en'] as String,
          arabicName: (entity['names']! as Map)['ar'] as String,
          searchForms: (entity['search']! as List).cast<String>(),
          popularity: entity['popularity']! as num,
        ),
    ],
  );
}
