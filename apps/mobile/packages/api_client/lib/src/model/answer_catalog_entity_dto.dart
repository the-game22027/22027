//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/localized_entity_names_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'answer_catalog_entity_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnswerCatalogEntityDto {
  /// Returns a new [AnswerCatalogEntityDto] instance.
  AnswerCatalogEntityDto({
    required this.id,

    required this.kind,

    required this.names,

    required this.popularity,

    required this.search,
  });

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  /// One of ENTITY_KINDS; clients must tolerate unknown values.
  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: AnswerCatalogEntityDtoKindEnum.unknownDefaultOpenApi,
  )
  final AnswerCatalogEntityDtoKindEnum kind;

  @JsonKey(name: r'names', required: true, includeIfNull: false)
  final LocalizedEntityNamesDto names;

  @JsonKey(name: r'popularity', required: true, includeIfNull: false)
  final num popularity;

  /// Normalized names and aliases (07 §5.7): what the app searches while the player types.
  @JsonKey(name: r'search', required: true, includeIfNull: false)
  final List<String> search;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AnswerCatalogEntityDto &&
          other.id == id &&
          other.kind == kind &&
          other.names == names &&
          other.popularity == popularity &&
          other.search == search;

  @override
  int get hashCode =>
      id.hashCode +
      kind.hashCode +
      names.hashCode +
      popularity.hashCode +
      search.hashCode;

  factory AnswerCatalogEntityDto.fromJson(Map<String, dynamic> json) =>
      _$AnswerCatalogEntityDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnswerCatalogEntityDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// One of ENTITY_KINDS; clients must tolerate unknown values.
enum AnswerCatalogEntityDtoKindEnum {
  @JsonValue(r'PLAYER')
  PLAYER(r'PLAYER'),
  @JsonValue(r'CLUB')
  CLUB(r'CLUB'),
  @JsonValue(r'NATIONAL_TEAM')
  NATIONAL_TEAM(r'NATIONAL_TEAM'),
  @JsonValue(r'COUNTRY')
  COUNTRY(r'COUNTRY'),
  @JsonValue(r'COMPETITION')
  COMPETITION(r'COMPETITION'),
  @JsonValue(r'COACH')
  COACH(r'COACH'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const AnswerCatalogEntityDtoKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
