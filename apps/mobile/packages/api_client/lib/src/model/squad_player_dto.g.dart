// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'squad_player_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SquadPlayerDtoCWProxy {
  SquadPlayerDto name(String name);

  SquadPlayerDto playerId(String playerId);

  SquadPlayerDto role(String role);

  SquadPlayerDto shirtNumber(num? shirtNumber);

  SquadPlayerDto teamId(String teamId);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SquadPlayerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SquadPlayerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SquadPlayerDto call({
    String name,
    String playerId,
    String role,
    num? shirtNumber,
    String teamId,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSquadPlayerDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSquadPlayerDto.copyWith.fieldName(...)`
class _$SquadPlayerDtoCWProxyImpl implements _$SquadPlayerDtoCWProxy {
  const _$SquadPlayerDtoCWProxyImpl(this._value);

  final SquadPlayerDto _value;

  @override
  SquadPlayerDto name(String name) => this(name: name);

  @override
  SquadPlayerDto playerId(String playerId) => this(playerId: playerId);

  @override
  SquadPlayerDto role(String role) => this(role: role);

  @override
  SquadPlayerDto shirtNumber(num? shirtNumber) =>
      this(shirtNumber: shirtNumber);

  @override
  SquadPlayerDto teamId(String teamId) => this(teamId: teamId);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SquadPlayerDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SquadPlayerDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SquadPlayerDto call({
    Object? name = const $CopyWithPlaceholder(),
    Object? playerId = const $CopyWithPlaceholder(),
    Object? role = const $CopyWithPlaceholder(),
    Object? shirtNumber = const $CopyWithPlaceholder(),
    Object? teamId = const $CopyWithPlaceholder(),
  }) {
    return SquadPlayerDto(
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      playerId: playerId == const $CopyWithPlaceholder()
          ? _value.playerId
          // ignore: cast_nullable_to_non_nullable
          : playerId as String,
      role: role == const $CopyWithPlaceholder()
          ? _value.role
          // ignore: cast_nullable_to_non_nullable
          : role as String,
      shirtNumber: shirtNumber == const $CopyWithPlaceholder()
          ? _value.shirtNumber
          // ignore: cast_nullable_to_non_nullable
          : shirtNumber as num?,
      teamId: teamId == const $CopyWithPlaceholder()
          ? _value.teamId
          // ignore: cast_nullable_to_non_nullable
          : teamId as String,
    );
  }
}

extension $SquadPlayerDtoCopyWith on SquadPlayerDto {
  /// Returns a callable class that can be used as follows: `instanceOfSquadPlayerDto.copyWith(...)` or like so:`instanceOfSquadPlayerDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SquadPlayerDtoCWProxy get copyWith => _$SquadPlayerDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SquadPlayerDto _$SquadPlayerDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SquadPlayerDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'name',
          'playerId',
          'role',
          'shirtNumber',
          'teamId',
        ],
      );
      final val = SquadPlayerDto(
        name: $checkedConvert('name', (v) => v as String),
        playerId: $checkedConvert('playerId', (v) => v as String),
        role: $checkedConvert('role', (v) => v as String),
        shirtNumber: $checkedConvert('shirtNumber', (v) => v as num?),
        teamId: $checkedConvert('teamId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SquadPlayerDtoToJson(SquadPlayerDto instance) =>
    <String, dynamic>{
      'name': instance.name,
      'playerId': instance.playerId,
      'role': instance.role,
      'shirtNumber': instance.shirtNumber,
      'teamId': instance.teamId,
    };
