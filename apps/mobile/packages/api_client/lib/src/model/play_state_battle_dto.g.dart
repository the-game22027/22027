// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'play_state_battle_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PlayStateBattleDtoCWProxy {
  PlayStateBattleDto battleId(String battleId);

  PlayStateBattleDto status(String status);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PlayStateBattleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PlayStateBattleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PlayStateBattleDto call({String battleId, String status});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPlayStateBattleDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPlayStateBattleDto.copyWith.fieldName(...)`
class _$PlayStateBattleDtoCWProxyImpl implements _$PlayStateBattleDtoCWProxy {
  const _$PlayStateBattleDtoCWProxyImpl(this._value);

  final PlayStateBattleDto _value;

  @override
  PlayStateBattleDto battleId(String battleId) => this(battleId: battleId);

  @override
  PlayStateBattleDto status(String status) => this(status: status);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PlayStateBattleDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PlayStateBattleDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PlayStateBattleDto call({
    Object? battleId = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
  }) {
    return PlayStateBattleDto(
      battleId: battleId == const $CopyWithPlaceholder()
          ? _value.battleId
          // ignore: cast_nullable_to_non_nullable
          : battleId as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as String,
    );
  }
}

extension $PlayStateBattleDtoCopyWith on PlayStateBattleDto {
  /// Returns a callable class that can be used as follows: `instanceOfPlayStateBattleDto.copyWith(...)` or like so:`instanceOfPlayStateBattleDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PlayStateBattleDtoCWProxy get copyWith =>
      _$PlayStateBattleDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlayStateBattleDto _$PlayStateBattleDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlayStateBattleDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['battleId', 'status']);
      final val = PlayStateBattleDto(
        battleId: $checkedConvert('battleId', (v) => v as String),
        status: $checkedConvert('status', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PlayStateBattleDtoToJson(PlayStateBattleDto instance) =>
    <String, dynamic>{'battleId': instance.battleId, 'status': instance.status};
