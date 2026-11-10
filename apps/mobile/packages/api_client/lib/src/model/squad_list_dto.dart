//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/squad_player_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'squad_list_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SquadListDto {
  /// Returns a new [SquadListDto] instance.
  SquadListDto({required this.items});

  @JsonKey(name: r'items', required: true, includeIfNull: false)
  final List<SquadPlayerDto> items;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is SquadListDto && other.items == items;

  @override
  int get hashCode => items.hashCode;

  factory SquadListDto.fromJson(Map<String, dynamic> json) =>
      _$SquadListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SquadListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
