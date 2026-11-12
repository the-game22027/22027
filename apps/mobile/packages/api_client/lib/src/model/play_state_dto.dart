//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/matchmaking_ticket_dto.dart';
import 'package:api_client/src/model/play_state_battle_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'play_state_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PlayStateDto {
  /// Returns a new [PlayStateDto] instance.
  PlayStateDto({
    required this.battle,

    required this.queue,

    required this.room,

    required this.serverTime,
  });

  @JsonKey(name: r'battle', required: true, includeIfNull: true)
  final PlayStateBattleDto? battle;

  @JsonKey(name: r'queue', required: true, includeIfNull: true)
  final MatchmakingTicketDto? queue;

  /// Rooms come with P8: always null for now.
  @JsonKey(name: r'room', required: true, includeIfNull: true)
  final Map<String, Object>? room;

  @JsonKey(name: r'serverTime', required: true, includeIfNull: false)
  final String serverTime;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PlayStateDto &&
          other.battle == battle &&
          other.queue == queue &&
          other.room == room &&
          other.serverTime == serverTime;

  @override
  int get hashCode =>
      (battle == null ? 0 : battle.hashCode) +
      (queue == null ? 0 : queue.hashCode) +
      (room == null ? 0 : room.hashCode) +
      serverTime.hashCode;

  factory PlayStateDto.fromJson(Map<String, dynamic> json) =>
      _$PlayStateDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PlayStateDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
