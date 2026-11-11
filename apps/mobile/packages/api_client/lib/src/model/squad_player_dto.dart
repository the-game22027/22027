//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'squad_player_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SquadPlayerDto {
  /// Returns a new [SquadPlayerDto] instance.
  SquadPlayerDto({
    required this.name,

    required this.playerId,

    required this.role,

    required this.shirtNumber,

    required this.teamId,
  });

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'playerId', required: true, includeIfNull: false)
  final String playerId;

  @JsonKey(name: r'role', required: true, includeIfNull: false)
  final String role;

  @JsonKey(name: r'shirtNumber', required: true, includeIfNull: true)
  final num? shirtNumber;

  @JsonKey(name: r'teamId', required: true, includeIfNull: false)
  final String teamId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SquadPlayerDto &&
          other.name == name &&
          other.playerId == playerId &&
          other.role == role &&
          other.shirtNumber == shirtNumber &&
          other.teamId == teamId;

  @override
  int get hashCode =>
      name.hashCode +
      playerId.hashCode +
      role.hashCode +
      (shirtNumber == null ? 0 : shirtNumber.hashCode) +
      teamId.hashCode;

  factory SquadPlayerDto.fromJson(Map<String, dynamic> json) =>
      _$SquadPlayerDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SquadPlayerDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
