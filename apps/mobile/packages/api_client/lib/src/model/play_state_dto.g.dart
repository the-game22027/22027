// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'play_state_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PlayStateDtoCWProxy {
  PlayStateDto battle(PlayStateBattleDto? battle);

  PlayStateDto queue(MatchmakingTicketDto? queue);

  PlayStateDto room(Map<String, Object>? room);

  PlayStateDto serverTime(String serverTime);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PlayStateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PlayStateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PlayStateDto call({
    PlayStateBattleDto? battle,
    MatchmakingTicketDto? queue,
    Map<String, Object>? room,
    String serverTime,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPlayStateDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPlayStateDto.copyWith.fieldName(...)`
class _$PlayStateDtoCWProxyImpl implements _$PlayStateDtoCWProxy {
  const _$PlayStateDtoCWProxyImpl(this._value);

  final PlayStateDto _value;

  @override
  PlayStateDto battle(PlayStateBattleDto? battle) => this(battle: battle);

  @override
  PlayStateDto queue(MatchmakingTicketDto? queue) => this(queue: queue);

  @override
  PlayStateDto room(Map<String, Object>? room) => this(room: room);

  @override
  PlayStateDto serverTime(String serverTime) => this(serverTime: serverTime);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PlayStateDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PlayStateDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PlayStateDto call({
    Object? battle = const $CopyWithPlaceholder(),
    Object? queue = const $CopyWithPlaceholder(),
    Object? room = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
  }) {
    return PlayStateDto(
      battle: battle == const $CopyWithPlaceholder()
          ? _value.battle
          // ignore: cast_nullable_to_non_nullable
          : battle as PlayStateBattleDto?,
      queue: queue == const $CopyWithPlaceholder()
          ? _value.queue
          // ignore: cast_nullable_to_non_nullable
          : queue as MatchmakingTicketDto?,
      room: room == const $CopyWithPlaceholder()
          ? _value.room
          // ignore: cast_nullable_to_non_nullable
          : room as Map<String, Object>?,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as String,
    );
  }
}

extension $PlayStateDtoCopyWith on PlayStateDto {
  /// Returns a callable class that can be used as follows: `instanceOfPlayStateDto.copyWith(...)` or like so:`instanceOfPlayStateDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PlayStateDtoCWProxy get copyWith => _$PlayStateDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlayStateDto _$PlayStateDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlayStateDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['battle', 'queue', 'room', 'serverTime'],
      );
      final val = PlayStateDto(
        battle: $checkedConvert(
          'battle',
          (v) => v == null
              ? null
              : PlayStateBattleDto.fromJson(v as Map<String, dynamic>),
        ),
        queue: $checkedConvert(
          'queue',
          (v) => v == null
              ? null
              : MatchmakingTicketDto.fromJson(v as Map<String, dynamic>),
        ),
        room: $checkedConvert(
          'room',
          (v) => (v as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as Object),
          ),
        ),
        serverTime: $checkedConvert('serverTime', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PlayStateDtoToJson(PlayStateDto instance) =>
    <String, dynamic>{
      'battle': instance.battle?.toJson(),
      'queue': instance.queue?.toJson(),
      'room': instance.room,
      'serverTime': instance.serverTime,
    };
