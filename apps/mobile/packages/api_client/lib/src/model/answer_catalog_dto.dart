//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/answer_catalog_entity_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'answer_catalog_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AnswerCatalogDto {
  /// Returns a new [AnswerCatalogDto] instance.
  AnswerCatalogDto({required this.entities, required this.version});

  @JsonKey(name: r'entities', required: true, includeIfNull: false)
  final List<AnswerCatalogEntityDto> entities;

  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final String version;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AnswerCatalogDto &&
          other.entities == entities &&
          other.version == version;

  @override
  int get hashCode => entities.hashCode + version.hashCode;

  factory AnswerCatalogDto.fromJson(Map<String, dynamic> json) =>
      _$AnswerCatalogDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AnswerCatalogDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
