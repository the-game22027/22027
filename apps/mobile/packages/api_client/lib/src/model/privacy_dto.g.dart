// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'privacy_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PrivacyDtoCWProxy {
  PrivacyDto predictionVisibility(String? predictionVisibility);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PrivacyDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PrivacyDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PrivacyDto call({String? predictionVisibility});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPrivacyDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPrivacyDto.copyWith.fieldName(...)`
class _$PrivacyDtoCWProxyImpl implements _$PrivacyDtoCWProxy {
  const _$PrivacyDtoCWProxyImpl(this._value);

  final PrivacyDto _value;

  @override
  PrivacyDto predictionVisibility(String? predictionVisibility) =>
      this(predictionVisibility: predictionVisibility);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PrivacyDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PrivacyDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PrivacyDto call({
    Object? predictionVisibility = const $CopyWithPlaceholder(),
  }) {
    return PrivacyDto(
      predictionVisibility: predictionVisibility == const $CopyWithPlaceholder()
          ? _value.predictionVisibility
          // ignore: cast_nullable_to_non_nullable
          : predictionVisibility as String?,
    );
  }
}

extension $PrivacyDtoCopyWith on PrivacyDto {
  /// Returns a callable class that can be used as follows: `instanceOfPrivacyDto.copyWith(...)` or like so:`instanceOfPrivacyDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PrivacyDtoCWProxy get copyWith => _$PrivacyDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PrivacyDto _$PrivacyDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PrivacyDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['predictionVisibility']);
      final val = PrivacyDto(
        predictionVisibility: $checkedConvert(
          'predictionVisibility',
          (v) => v as String?,
        ),
      );
      return val;
    });

Map<String, dynamic> _$PrivacyDtoToJson(PrivacyDto instance) =>
    <String, dynamic>{'predictionVisibility': instance.predictionVisibility};
