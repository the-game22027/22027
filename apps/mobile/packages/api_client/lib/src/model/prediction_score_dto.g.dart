// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_score_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PredictionScoreDtoCWProxy {
  PredictionScoreDto points(num points);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionScoreDto call({num points});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPredictionScoreDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPredictionScoreDto.copyWith.fieldName(...)`
class _$PredictionScoreDtoCWProxyImpl implements _$PredictionScoreDtoCWProxy {
  const _$PredictionScoreDtoCWProxyImpl(this._value);

  final PredictionScoreDto _value;

  @override
  PredictionScoreDto points(num points) => this(points: points);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionScoreDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionScoreDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionScoreDto call({Object? points = const $CopyWithPlaceholder()}) {
    return PredictionScoreDto(
      points: points == const $CopyWithPlaceholder()
          ? _value.points
          // ignore: cast_nullable_to_non_nullable
          : points as num,
    );
  }
}

extension $PredictionScoreDtoCopyWith on PredictionScoreDto {
  /// Returns a callable class that can be used as follows: `instanceOfPredictionScoreDto.copyWith(...)` or like so:`instanceOfPredictionScoreDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PredictionScoreDtoCWProxy get copyWith =>
      _$PredictionScoreDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PredictionScoreDto _$PredictionScoreDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PredictionScoreDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['points']);
      final val = PredictionScoreDto(
        points: $checkedConvert('points', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PredictionScoreDtoToJson(PredictionScoreDto instance) =>
    <String, dynamic>{'points': instance.points};
