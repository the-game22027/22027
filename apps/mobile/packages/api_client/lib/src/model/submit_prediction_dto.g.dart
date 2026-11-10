// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submit_prediction_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SubmitPredictionDtoCWProxy {
  SubmitPredictionDto picks(List<SubmittedPickDto> picks);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SubmitPredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SubmitPredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SubmitPredictionDto call({
    List<SubmittedPickDto> picks,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSubmitPredictionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSubmitPredictionDto.copyWith.fieldName(...)`
class _$SubmitPredictionDtoCWProxyImpl implements _$SubmitPredictionDtoCWProxy {
  const _$SubmitPredictionDtoCWProxyImpl(this._value);

  final SubmitPredictionDto _value;

  @override
  SubmitPredictionDto picks(List<SubmittedPickDto> picks) => this(picks: picks);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SubmitPredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SubmitPredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SubmitPredictionDto call({
    Object? picks = const $CopyWithPlaceholder(),
  }) {
    return SubmitPredictionDto(
      picks: picks == const $CopyWithPlaceholder()
          ? _value.picks
          // ignore: cast_nullable_to_non_nullable
          : picks as List<SubmittedPickDto>,
    );
  }
}

extension $SubmitPredictionDtoCopyWith on SubmitPredictionDto {
  /// Returns a callable class that can be used as follows: `instanceOfSubmitPredictionDto.copyWith(...)` or like so:`instanceOfSubmitPredictionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SubmitPredictionDtoCWProxy get copyWith =>
      _$SubmitPredictionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SubmitPredictionDto _$SubmitPredictionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'SubmitPredictionDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const ['picks'],
        );
        final val = SubmitPredictionDto(
          picks: $checkedConvert(
              'picks',
              (v) => (v as List<dynamic>)
                  .map((e) =>
                      SubmittedPickDto.fromJson(e as Map<String, dynamic>))
                  .toList()),
        );
        return val;
      },
    );

Map<String, dynamic> _$SubmitPredictionDtoToJson(
        SubmitPredictionDto instance) =>
    <String, dynamic>{
      'picks': instance.picks.map((e) => e.toJson()).toList(),
    };
