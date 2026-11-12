//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'localized_entity_names_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalizedEntityNamesDto {
  /// Returns a new [LocalizedEntityNamesDto] instance.
  LocalizedEntityNamesDto({required this.ar, required this.en});

  @JsonKey(name: r'ar', required: true, includeIfNull: false)
  final String ar;

  @JsonKey(name: r'en', required: true, includeIfNull: false)
  final String en;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalizedEntityNamesDto && other.ar == ar && other.en == en;

  @override
  int get hashCode => ar.hashCode + en.hashCode;

  factory LocalizedEntityNamesDto.fromJson(Map<String, dynamic> json) =>
      _$LocalizedEntityNamesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LocalizedEntityNamesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
