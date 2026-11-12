// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'localized_entity_names_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LocalizedEntityNamesDtoCWProxy {
  LocalizedEntityNamesDto ar(String ar);

  LocalizedEntityNamesDto en(String en);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LocalizedEntityNamesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LocalizedEntityNamesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LocalizedEntityNamesDto call({String ar, String en});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfLocalizedEntityNamesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfLocalizedEntityNamesDto.copyWith.fieldName(...)`
class _$LocalizedEntityNamesDtoCWProxyImpl
    implements _$LocalizedEntityNamesDtoCWProxy {
  const _$LocalizedEntityNamesDtoCWProxyImpl(this._value);

  final LocalizedEntityNamesDto _value;

  @override
  LocalizedEntityNamesDto ar(String ar) => this(ar: ar);

  @override
  LocalizedEntityNamesDto en(String en) => this(en: en);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `LocalizedEntityNamesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// LocalizedEntityNamesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  LocalizedEntityNamesDto call({
    Object? ar = const $CopyWithPlaceholder(),
    Object? en = const $CopyWithPlaceholder(),
  }) {
    return LocalizedEntityNamesDto(
      ar: ar == const $CopyWithPlaceholder()
          ? _value.ar
          // ignore: cast_nullable_to_non_nullable
          : ar as String,
      en: en == const $CopyWithPlaceholder()
          ? _value.en
          // ignore: cast_nullable_to_non_nullable
          : en as String,
    );
  }
}

extension $LocalizedEntityNamesDtoCopyWith on LocalizedEntityNamesDto {
  /// Returns a callable class that can be used as follows: `instanceOfLocalizedEntityNamesDto.copyWith(...)` or like so:`instanceOfLocalizedEntityNamesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LocalizedEntityNamesDtoCWProxy get copyWith =>
      _$LocalizedEntityNamesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalizedEntityNamesDto _$LocalizedEntityNamesDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LocalizedEntityNamesDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['ar', 'en']);
  final val = LocalizedEntityNamesDto(
    ar: $checkedConvert('ar', (v) => v as String),
    en: $checkedConvert('en', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$LocalizedEntityNamesDtoToJson(
  LocalizedEntityNamesDto instance,
) => <String, dynamic>{'ar': instance.ar, 'en': instance.en};
