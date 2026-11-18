// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visible_prediction_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiblePredictionDtoCWProxy {
  VisiblePredictionDto matchId(String matchId);

  VisiblePredictionDto picks(List<PredictionPickDto> picks);

  VisiblePredictionDto score(PredictionScoreDto? score);

  VisiblePredictionDto status(VisiblePredictionDtoStatusEnum status);

  VisiblePredictionDto updatedAt(String updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiblePredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiblePredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiblePredictionDto call({
    String matchId,
    List<PredictionPickDto> picks,
    PredictionScoreDto? score,
    VisiblePredictionDtoStatusEnum status,
    String updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiblePredictionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiblePredictionDto.copyWith.fieldName(...)`
class _$VisiblePredictionDtoCWProxyImpl
    implements _$VisiblePredictionDtoCWProxy {
  const _$VisiblePredictionDtoCWProxyImpl(this._value);

  final VisiblePredictionDto _value;

  @override
  VisiblePredictionDto matchId(String matchId) => this(matchId: matchId);

  @override
  VisiblePredictionDto picks(List<PredictionPickDto> picks) =>
      this(picks: picks);

  @override
  VisiblePredictionDto score(PredictionScoreDto? score) => this(score: score);

  @override
  VisiblePredictionDto status(VisiblePredictionDtoStatusEnum status) =>
      this(status: status);

  @override
  VisiblePredictionDto updatedAt(String updatedAt) =>
      this(updatedAt: updatedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiblePredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiblePredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiblePredictionDto call({
    Object? matchId = const $CopyWithPlaceholder(),
    Object? picks = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return VisiblePredictionDto(
      matchId: matchId == const $CopyWithPlaceholder()
          ? _value.matchId
          // ignore: cast_nullable_to_non_nullable
          : matchId as String,
      picks: picks == const $CopyWithPlaceholder()
          ? _value.picks
          // ignore: cast_nullable_to_non_nullable
          : picks as List<PredictionPickDto>,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as PredictionScoreDto?,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as VisiblePredictionDtoStatusEnum,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as String,
    );
  }
}

extension $VisiblePredictionDtoCopyWith on VisiblePredictionDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiblePredictionDto.copyWith(...)` or like so:`instanceOfVisiblePredictionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiblePredictionDtoCWProxy get copyWith =>
      _$VisiblePredictionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiblePredictionDto _$VisiblePredictionDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiblePredictionDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['matchId', 'picks', 'score', 'status', 'updatedAt'],
  );
  final val = VisiblePredictionDto(
    matchId: $checkedConvert('matchId', (v) => v as String),
    picks: $checkedConvert(
      'picks',
      (v) => (v as List<dynamic>)
          .map((e) => PredictionPickDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    score: $checkedConvert(
      'score',
      (v) => v == null
          ? null
          : PredictionScoreDto.fromJson(v as Map<String, dynamic>),
    ),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$VisiblePredictionDtoStatusEnumEnumMap,
        v,
        unknownValue: VisiblePredictionDtoStatusEnum.unknownDefaultOpenApi,
      ),
    ),
    updatedAt: $checkedConvert('updatedAt', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VisiblePredictionDtoToJson(
  VisiblePredictionDto instance,
) => <String, dynamic>{
  'matchId': instance.matchId,
  'picks': instance.picks.map((e) => e.toJson()).toList(),
  'score': instance.score?.toJson(),
  'status': _$VisiblePredictionDtoStatusEnumEnumMap[instance.status]!,
  'updatedAt': instance.updatedAt,
};

const _$VisiblePredictionDtoStatusEnumEnumMap = {
  VisiblePredictionDtoStatusEnum.ACTIVE: 'ACTIVE',
  VisiblePredictionDtoStatusEnum.VOID: 'VOID',
  VisiblePredictionDtoStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
