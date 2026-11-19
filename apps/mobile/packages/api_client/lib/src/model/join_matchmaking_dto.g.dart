// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join_matchmaking_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$JoinMatchmakingDtoCWProxy {
  JoinMatchmakingDto gameType(JoinMatchmakingDtoGameTypeEnum gameType);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `JoinMatchmakingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// JoinMatchmakingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  JoinMatchmakingDto call({JoinMatchmakingDtoGameTypeEnum gameType});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfJoinMatchmakingDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfJoinMatchmakingDto.copyWith.fieldName(...)`
class _$JoinMatchmakingDtoCWProxyImpl implements _$JoinMatchmakingDtoCWProxy {
  const _$JoinMatchmakingDtoCWProxyImpl(this._value);

  final JoinMatchmakingDto _value;

  @override
  JoinMatchmakingDto gameType(JoinMatchmakingDtoGameTypeEnum gameType) =>
      this(gameType: gameType);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `JoinMatchmakingDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// JoinMatchmakingDto(...).copyWith(id: 12, name: "My name")
  /// ````
  JoinMatchmakingDto call({Object? gameType = const $CopyWithPlaceholder()}) {
    return JoinMatchmakingDto(
      gameType: gameType == const $CopyWithPlaceholder()
          ? _value.gameType
          // ignore: cast_nullable_to_non_nullable
          : gameType as JoinMatchmakingDtoGameTypeEnum,
    );
  }
}

extension $JoinMatchmakingDtoCopyWith on JoinMatchmakingDto {
  /// Returns a callable class that can be used as follows: `instanceOfJoinMatchmakingDto.copyWith(...)` or like so:`instanceOfJoinMatchmakingDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$JoinMatchmakingDtoCWProxy get copyWith =>
      _$JoinMatchmakingDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

JoinMatchmakingDto _$JoinMatchmakingDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('JoinMatchmakingDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['gameType']);
      final val = JoinMatchmakingDto(
        gameType: $checkedConvert(
          'gameType',
          (v) => $enumDecode(
            _$JoinMatchmakingDtoGameTypeEnumEnumMap,
            v,
            unknownValue: JoinMatchmakingDtoGameTypeEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$JoinMatchmakingDtoToJson(JoinMatchmakingDto instance) =>
    <String, dynamic>{
      'gameType': _$JoinMatchmakingDtoGameTypeEnumEnumMap[instance.gameType]!,
    };

const _$JoinMatchmakingDtoGameTypeEnumEnumMap = {
  JoinMatchmakingDtoGameTypeEnum.BUZZER: 'BUZZER',
  JoinMatchmakingDtoGameTypeEnum.CAREER: 'CAREER',
  JoinMatchmakingDtoGameTypeEnum.WHO_IS_PLAYER: 'WHO_IS_PLAYER',
  JoinMatchmakingDtoGameTypeEnum.GRID: 'GRID',
  JoinMatchmakingDtoGameTypeEnum.MINES: 'MINES',
  JoinMatchmakingDtoGameTypeEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
