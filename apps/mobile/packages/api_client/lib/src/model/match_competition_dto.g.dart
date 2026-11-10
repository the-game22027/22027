// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'match_competition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MatchCompetitionDtoCWProxy {
  MatchCompetitionDto code(String code);

  MatchCompetitionDto id(String id);

  MatchCompetitionDto name(String name);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchCompetitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchCompetitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchCompetitionDto call({
    String code,
    String id,
    String name,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMatchCompetitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMatchCompetitionDto.copyWith.fieldName(...)`
class _$MatchCompetitionDtoCWProxyImpl implements _$MatchCompetitionDtoCWProxy {
  const _$MatchCompetitionDtoCWProxyImpl(this._value);

  final MatchCompetitionDto _value;

  @override
  MatchCompetitionDto code(String code) => this(code: code);

  @override
  MatchCompetitionDto id(String id) => this(id: id);

  @override
  MatchCompetitionDto name(String name) => this(name: name);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchCompetitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchCompetitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchCompetitionDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
  }) {
    return MatchCompetitionDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
    );
  }
}

extension $MatchCompetitionDtoCopyWith on MatchCompetitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfMatchCompetitionDto.copyWith(...)` or like so:`instanceOfMatchCompetitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MatchCompetitionDtoCWProxy get copyWith =>
      _$MatchCompetitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MatchCompetitionDto _$MatchCompetitionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'MatchCompetitionDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const ['code', 'id', 'name'],
        );
        final val = MatchCompetitionDto(
          code: $checkedConvert('code', (v) => v as String),
          id: $checkedConvert('id', (v) => v as String),
          name: $checkedConvert('name', (v) => v as String),
        );
        return val;
      },
    );

Map<String, dynamic> _$MatchCompetitionDtoToJson(
        MatchCompetitionDto instance) =>
    <String, dynamic>{
      'code': instance.code,
      'id': instance.id,
      'name': instance.name,
    };
