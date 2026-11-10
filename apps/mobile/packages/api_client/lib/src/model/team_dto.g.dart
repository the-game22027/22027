// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'team_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TeamDtoCWProxy {
  TeamDto crestUrl(String? crestUrl);

  TeamDto id(String id);

  TeamDto name(String name);

  TeamDto shortName(String? shortName);

  TeamDto type(String type);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TeamDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TeamDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TeamDto call({
    String? crestUrl,
    String id,
    String name,
    String? shortName,
    String type,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfTeamDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfTeamDto.copyWith.fieldName(...)`
class _$TeamDtoCWProxyImpl implements _$TeamDtoCWProxy {
  const _$TeamDtoCWProxyImpl(this._value);

  final TeamDto _value;

  @override
  TeamDto crestUrl(String? crestUrl) => this(crestUrl: crestUrl);

  @override
  TeamDto id(String id) => this(id: id);

  @override
  TeamDto name(String name) => this(name: name);

  @override
  TeamDto shortName(String? shortName) => this(shortName: shortName);

  @override
  TeamDto type(String type) => this(type: type);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `TeamDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// TeamDto(...).copyWith(id: 12, name: "My name")
  /// ````
  TeamDto call({
    Object? crestUrl = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? shortName = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
  }) {
    return TeamDto(
      crestUrl: crestUrl == const $CopyWithPlaceholder()
          ? _value.crestUrl
          // ignore: cast_nullable_to_non_nullable
          : crestUrl as String?,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      shortName: shortName == const $CopyWithPlaceholder()
          ? _value.shortName
          // ignore: cast_nullable_to_non_nullable
          : shortName as String?,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as String,
    );
  }
}

extension $TeamDtoCopyWith on TeamDto {
  /// Returns a callable class that can be used as follows: `instanceOfTeamDto.copyWith(...)` or like so:`instanceOfTeamDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TeamDtoCWProxy get copyWith => _$TeamDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TeamDto _$TeamDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TeamDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['crestUrl', 'id', 'name', 'type']);
      final val = TeamDto(
        crestUrl: $checkedConvert('crestUrl', (v) => v as String?),
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        shortName: $checkedConvert('shortName', (v) => v as String?),
        type: $checkedConvert('type', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$TeamDtoToJson(TeamDto instance) => <String, dynamic>{
  'crestUrl': instance.crestUrl,
  'id': instance.id,
  'name': instance.name,
  'shortName': ?instance.shortName,
  'type': instance.type,
};
