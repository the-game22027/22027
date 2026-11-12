//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'play_state_battle_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlayStateBattleDto {
  /// Returns a new [PlayStateBattleDto] instance.
  PlayStateBattleDto({required this.battleId, required this.status});

  @JsonKey(name: r'battleId', required: true, includeIfNull: false)
  final String battleId;

  @JsonKey(name: r'status', required: true, includeIfNull: false)
  final String status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlayStateBattleDto &&
          other.battleId == battleId &&
          other.status == status;

  @override
  int get hashCode => battleId.hashCode + status.hashCode;

  factory PlayStateBattleDto.fromJson(Map<String, dynamic> json) =>
      _$PlayStateBattleDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PlayStateBattleDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
