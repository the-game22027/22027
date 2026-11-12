// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_pick_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PredictionPickDtoCWProxy {
  PredictionPickDto away(num? away);

  PredictionPickDto home(num? home);

  PredictionPickDto outcome(PredictionPickDtoOutcomeEnum? outcome);

  PredictionPickDto type(PredictionPickDtoTypeEnum type);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionPickDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionPickDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionPickDto call({
    num? away,
    num? home,
    PredictionPickDtoOutcomeEnum? outcome,
    PredictionPickDtoTypeEnum type,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPredictionPickDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPredictionPickDto.copyWith.fieldName(...)`
class _$PredictionPickDtoCWProxyImpl implements _$PredictionPickDtoCWProxy {
  const _$PredictionPickDtoCWProxyImpl(this._value);

  final PredictionPickDto _value;

  @override
  PredictionPickDto away(num? away) => this(away: away);

  @override
  PredictionPickDto home(num? home) => this(home: home);

  @override
  PredictionPickDto outcome(PredictionPickDtoOutcomeEnum? outcome) =>
      this(outcome: outcome);

  @override
  PredictionPickDto type(PredictionPickDtoTypeEnum type) => this(type: type);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionPickDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionPickDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionPickDto call({
    Object? away = const $CopyWithPlaceholder(),
    Object? home = const $CopyWithPlaceholder(),
    Object? outcome = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
  }) {
    return PredictionPickDto(
      away: away == const $CopyWithPlaceholder()
          ? _value.away
          // ignore: cast_nullable_to_non_nullable
          : away as num?,
      home: home == const $CopyWithPlaceholder()
          ? _value.home
          // ignore: cast_nullable_to_non_nullable
          : home as num?,
      outcome: outcome == const $CopyWithPlaceholder()
          ? _value.outcome
          // ignore: cast_nullable_to_non_nullable
          : outcome as PredictionPickDtoOutcomeEnum?,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as PredictionPickDtoTypeEnum,
    );
  }
}

extension $PredictionPickDtoCopyWith on PredictionPickDto {
  /// Returns a callable class that can be used as follows: `instanceOfPredictionPickDto.copyWith(...)` or like so:`instanceOfPredictionPickDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PredictionPickDtoCWProxy get copyWith =>
      _$PredictionPickDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PredictionPickDto _$PredictionPickDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PredictionPickDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['type']);
      final val = PredictionPickDto(
        away: $checkedConvert('away', (v) => v as num?),
        home: $checkedConvert('home', (v) => v as num?),
        outcome: $checkedConvert(
          'outcome',
          (v) => $enumDecodeNullable(
            _$PredictionPickDtoOutcomeEnumEnumMap,
            v,
            unknownValue: PredictionPickDtoOutcomeEnum.unknownDefaultOpenApi,
          ),
        ),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$PredictionPickDtoTypeEnumEnumMap,
            v,
            unknownValue: PredictionPickDtoTypeEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PredictionPickDtoToJson(PredictionPickDto instance) =>
    <String, dynamic>{
      'away': ?instance.away,
      'home': ?instance.home,
      'outcome': ?_$PredictionPickDtoOutcomeEnumEnumMap[instance.outcome],
      'type': _$PredictionPickDtoTypeEnumEnumMap[instance.type]!,
    };

const _$PredictionPickDtoOutcomeEnumEnumMap = {
  PredictionPickDtoOutcomeEnum.DRAW: 'DRAW',
  PredictionPickDtoOutcomeEnum.HOME: 'HOME',
  PredictionPickDtoOutcomeEnum.AWAY: 'AWAY',
  PredictionPickDtoOutcomeEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$PredictionPickDtoTypeEnumEnumMap = {
  PredictionPickDtoTypeEnum.EXACT_SCORE: 'EXACT_SCORE',
  PredictionPickDtoTypeEnum.RESULT: 'RESULT',
  PredictionPickDtoTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
