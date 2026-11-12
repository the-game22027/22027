// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'answer_catalog_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnswerCatalogDtoCWProxy {
  AnswerCatalogDto entities(List<AnswerCatalogEntityDto> entities);

  AnswerCatalogDto version(String version);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnswerCatalogDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnswerCatalogDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnswerCatalogDto call({
    List<AnswerCatalogEntityDto> entities,
    String version,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnswerCatalogDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnswerCatalogDto.copyWith.fieldName(...)`
class _$AnswerCatalogDtoCWProxyImpl implements _$AnswerCatalogDtoCWProxy {
  const _$AnswerCatalogDtoCWProxyImpl(this._value);

  final AnswerCatalogDto _value;

  @override
  AnswerCatalogDto entities(List<AnswerCatalogEntityDto> entities) =>
      this(entities: entities);

  @override
  AnswerCatalogDto version(String version) => this(version: version);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnswerCatalogDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnswerCatalogDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnswerCatalogDto call({
    Object? entities = const $CopyWithPlaceholder(),
    Object? version = const $CopyWithPlaceholder(),
  }) {
    return AnswerCatalogDto(
      entities: entities == const $CopyWithPlaceholder()
          ? _value.entities
          // ignore: cast_nullable_to_non_nullable
          : entities as List<AnswerCatalogEntityDto>,
      version: version == const $CopyWithPlaceholder()
          ? _value.version
          // ignore: cast_nullable_to_non_nullable
          : version as String,
    );
  }
}

extension $AnswerCatalogDtoCopyWith on AnswerCatalogDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnswerCatalogDto.copyWith(...)` or like so:`instanceOfAnswerCatalogDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnswerCatalogDtoCWProxy get copyWith => _$AnswerCatalogDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnswerCatalogDto _$AnswerCatalogDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AnswerCatalogDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['entities', 'version']);
      final val = AnswerCatalogDto(
        entities: $checkedConvert(
          'entities',
          (v) => (v as List<dynamic>)
              .map(
                (e) =>
                    AnswerCatalogEntityDto.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
        version: $checkedConvert('version', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$AnswerCatalogDtoToJson(AnswerCatalogDto instance) =>
    <String, dynamic>{
      'entities': instance.entities.map((e) => e.toJson()).toList(),
      'version': instance.version,
    };
