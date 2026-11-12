// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'answer_catalog_entity_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AnswerCatalogEntityDtoCWProxy {
  AnswerCatalogEntityDto id(String id);

  AnswerCatalogEntityDto kind(AnswerCatalogEntityDtoKindEnum kind);

  AnswerCatalogEntityDto names(LocalizedEntityNamesDto names);

  AnswerCatalogEntityDto popularity(num popularity);

  AnswerCatalogEntityDto search(List<String> search);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnswerCatalogEntityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnswerCatalogEntityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnswerCatalogEntityDto call({
    String id,
    AnswerCatalogEntityDtoKindEnum kind,
    LocalizedEntityNamesDto names,
    num popularity,
    List<String> search,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAnswerCatalogEntityDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAnswerCatalogEntityDto.copyWith.fieldName(...)`
class _$AnswerCatalogEntityDtoCWProxyImpl
    implements _$AnswerCatalogEntityDtoCWProxy {
  const _$AnswerCatalogEntityDtoCWProxyImpl(this._value);

  final AnswerCatalogEntityDto _value;

  @override
  AnswerCatalogEntityDto id(String id) => this(id: id);

  @override
  AnswerCatalogEntityDto kind(AnswerCatalogEntityDtoKindEnum kind) =>
      this(kind: kind);

  @override
  AnswerCatalogEntityDto names(LocalizedEntityNamesDto names) =>
      this(names: names);

  @override
  AnswerCatalogEntityDto popularity(num popularity) =>
      this(popularity: popularity);

  @override
  AnswerCatalogEntityDto search(List<String> search) => this(search: search);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AnswerCatalogEntityDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AnswerCatalogEntityDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AnswerCatalogEntityDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? names = const $CopyWithPlaceholder(),
    Object? popularity = const $CopyWithPlaceholder(),
    Object? search = const $CopyWithPlaceholder(),
  }) {
    return AnswerCatalogEntityDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      kind: kind == const $CopyWithPlaceholder()
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as AnswerCatalogEntityDtoKindEnum,
      names: names == const $CopyWithPlaceholder()
          ? _value.names
          // ignore: cast_nullable_to_non_nullable
          : names as LocalizedEntityNamesDto,
      popularity: popularity == const $CopyWithPlaceholder()
          ? _value.popularity
          // ignore: cast_nullable_to_non_nullable
          : popularity as num,
      search: search == const $CopyWithPlaceholder()
          ? _value.search
          // ignore: cast_nullable_to_non_nullable
          : search as List<String>,
    );
  }
}

extension $AnswerCatalogEntityDtoCopyWith on AnswerCatalogEntityDto {
  /// Returns a callable class that can be used as follows: `instanceOfAnswerCatalogEntityDto.copyWith(...)` or like so:`instanceOfAnswerCatalogEntityDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AnswerCatalogEntityDtoCWProxy get copyWith =>
      _$AnswerCatalogEntityDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AnswerCatalogEntityDto _$AnswerCatalogEntityDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('AnswerCatalogEntityDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['id', 'kind', 'names', 'popularity', 'search'],
  );
  final val = AnswerCatalogEntityDto(
    id: $checkedConvert('id', (v) => v as String),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$AnswerCatalogEntityDtoKindEnumEnumMap,
        v,
        unknownValue: AnswerCatalogEntityDtoKindEnum.unknownDefaultOpenApi,
      ),
    ),
    names: $checkedConvert(
      'names',
      (v) => LocalizedEntityNamesDto.fromJson(v as Map<String, dynamic>),
    ),
    popularity: $checkedConvert('popularity', (v) => v as num),
    search: $checkedConvert(
      'search',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$AnswerCatalogEntityDtoToJson(
  AnswerCatalogEntityDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'kind': _$AnswerCatalogEntityDtoKindEnumEnumMap[instance.kind]!,
  'names': instance.names.toJson(),
  'popularity': instance.popularity,
  'search': instance.search,
};

const _$AnswerCatalogEntityDtoKindEnumEnumMap = {
  AnswerCatalogEntityDtoKindEnum.PLAYER: 'PLAYER',
  AnswerCatalogEntityDtoKindEnum.CLUB: 'CLUB',
  AnswerCatalogEntityDtoKindEnum.NATIONAL_TEAM: 'NATIONAL_TEAM',
  AnswerCatalogEntityDtoKindEnum.COUNTRY: 'COUNTRY',
  AnswerCatalogEntityDtoKindEnum.COMPETITION: 'COMPETITION',
  AnswerCatalogEntityDtoKindEnum.COACH: 'COACH',
  AnswerCatalogEntityDtoKindEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
