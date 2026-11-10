// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'identity_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$IdentityDtoCWProxy {
  IdentityDto id(String id);

  IdentityDto label(String label);

  IdentityDto provider(IdentityDtoProviderEnum provider);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IdentityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IdentityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IdentityDto call({String id, String label, IdentityDtoProviderEnum provider});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfIdentityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfIdentityDto.copyWith.fieldName(...)`
class _$IdentityDtoCWProxyImpl implements _$IdentityDtoCWProxy {
  const _$IdentityDtoCWProxyImpl(this._value);

  final IdentityDto _value;

  @override
  IdentityDto id(String id) => this(id: id);

  @override
  IdentityDto label(String label) => this(label: label);

  @override
  IdentityDto provider(IdentityDtoProviderEnum provider) =>
      this(provider: provider);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `IdentityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// IdentityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  IdentityDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? label = const $CopyWithPlaceholder(),
    Object? provider = const $CopyWithPlaceholder(),
  }) {
    return IdentityDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      label: label == const $CopyWithPlaceholder()
          ? _value.label
          // ignore: cast_nullable_to_non_nullable
          : label as String,
      provider: provider == const $CopyWithPlaceholder()
          ? _value.provider
          // ignore: cast_nullable_to_non_nullable
          : provider as IdentityDtoProviderEnum,
    );
  }
}

extension $IdentityDtoCopyWith on IdentityDto {
  /// Returns a callable class that can be used as follows: `instanceOfIdentityDto.copyWith(...)` or like so:`instanceOfIdentityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$IdentityDtoCWProxy get copyWith => _$IdentityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IdentityDto _$IdentityDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('IdentityDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'label', 'provider']);
      final val = IdentityDto(
        id: $checkedConvert('id', (v) => v as String),
        label: $checkedConvert('label', (v) => v as String),
        provider: $checkedConvert(
          'provider',
          (v) => $enumDecode(
            _$IdentityDtoProviderEnumEnumMap,
            v,
            unknownValue: IdentityDtoProviderEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$IdentityDtoToJson(IdentityDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'label': instance.label,
      'provider': _$IdentityDtoProviderEnumEnumMap[instance.provider]!,
    };

const _$IdentityDtoProviderEnumEnumMap = {
  IdentityDtoProviderEnum.GOOGLE: 'GOOGLE',
  IdentityDtoProviderEnum.FACEBOOK: 'FACEBOOK',
  IdentityDtoProviderEnum.X: 'X',
  IdentityDtoProviderEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
