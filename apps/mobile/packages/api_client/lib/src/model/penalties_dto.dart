//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'penalties_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PenaltiesDto {
  /// Returns a new [PenaltiesDto] instance.
  PenaltiesDto({required this.away, required this.home});

  @JsonKey(name: r'away', required: true, includeIfNull: false)
  final num away;

  @JsonKey(name: r'home', required: true, includeIfNull: false)
  final num home;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PenaltiesDto && other.away == away && other.home == home;

  @override
  int get hashCode => away.hashCode + home.hashCode;

  factory PenaltiesDto.fromJson(Map<String, dynamic> json) =>
      _$PenaltiesDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PenaltiesDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
