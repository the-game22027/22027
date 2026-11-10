// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'competition_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CompetitionDtoCWProxy {
  CompetitionDto code(String code);

  CompetitionDto countryCode(String? countryCode);

  CompetitionDto id(String id);

  CompetitionDto isNationalTeams(bool isNationalTeams);

  CompetitionDto name(String name);

  CompetitionDto type(String type);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CompetitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CompetitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CompetitionDto call({
    String code,
    String? countryCode,
    String id,
    bool isNationalTeams,
    String name,
    String type,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCompetitionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCompetitionDto.copyWith.fieldName(...)`
class _$CompetitionDtoCWProxyImpl implements _$CompetitionDtoCWProxy {
  const _$CompetitionDtoCWProxyImpl(this._value);

  final CompetitionDto _value;

  @override
  CompetitionDto code(String code) => this(code: code);

  @override
  CompetitionDto countryCode(String? countryCode) =>
      this(countryCode: countryCode);

  @override
  CompetitionDto id(String id) => this(id: id);

  @override
  CompetitionDto isNationalTeams(bool isNationalTeams) =>
      this(isNationalTeams: isNationalTeams);

  @override
  CompetitionDto name(String name) => this(name: name);

  @override
  CompetitionDto type(String type) => this(type: type);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CompetitionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CompetitionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CompetitionDto call({
    Object? code = const $CopyWithPlaceholder(),
    Object? countryCode = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? isNationalTeams = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
  }) {
    return CompetitionDto(
      code: code == const $CopyWithPlaceholder()
          ? _value.code
          // ignore: cast_nullable_to_non_nullable
          : code as String,
      countryCode: countryCode == const $CopyWithPlaceholder()
          ? _value.countryCode
          // ignore: cast_nullable_to_non_nullable
          : countryCode as String?,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      isNationalTeams: isNationalTeams == const $CopyWithPlaceholder()
          ? _value.isNationalTeams
          // ignore: cast_nullable_to_non_nullable
          : isNationalTeams as bool,
      name: name == const $CopyWithPlaceholder()
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as String,
    );
  }
}

extension $CompetitionDtoCopyWith on CompetitionDto {
  /// Returns a callable class that can be used as follows: `instanceOfCompetitionDto.copyWith(...)` or like so:`instanceOfCompetitionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CompetitionDtoCWProxy get copyWith => _$CompetitionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CompetitionDto _$CompetitionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'CompetitionDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const [
            'code',
            'countryCode',
            'id',
            'isNationalTeams',
            'name',
            'type'
          ],
        );
        final val = CompetitionDto(
          code: $checkedConvert('code', (v) => v as String),
          countryCode: $checkedConvert('countryCode', (v) => v as String?),
          id: $checkedConvert('id', (v) => v as String),
          isNationalTeams: $checkedConvert('isNationalTeams', (v) => v as bool),
          name: $checkedConvert('name', (v) => v as String),
          type: $checkedConvert('type', (v) => v as String),
        );
        return val;
      },
    );

Map<String, dynamic> _$CompetitionDtoToJson(CompetitionDto instance) =>
    <String, dynamic>{
      'code': instance.code,
      'countryCode': instance.countryCode,
      'id': instance.id,
      'isNationalTeams': instance.isNationalTeams,
      'name': instance.name,
      'type': instance.type,
    };
