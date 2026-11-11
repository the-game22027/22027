// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'penalties_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PenaltiesDtoCWProxy {
  PenaltiesDto away(num away);

  PenaltiesDto home(num home);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PenaltiesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PenaltiesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PenaltiesDto call({num away, num home});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPenaltiesDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPenaltiesDto.copyWith.fieldName(...)`
class _$PenaltiesDtoCWProxyImpl implements _$PenaltiesDtoCWProxy {
  const _$PenaltiesDtoCWProxyImpl(this._value);

  final PenaltiesDto _value;

  @override
  PenaltiesDto away(num away) => this(away: away);

  @override
  PenaltiesDto home(num home) => this(home: home);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PenaltiesDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PenaltiesDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PenaltiesDto call({
    Object? away = const $CopyWithPlaceholder(),
    Object? home = const $CopyWithPlaceholder(),
  }) {
    return PenaltiesDto(
      away: away == const $CopyWithPlaceholder()
          ? _value.away
          // ignore: cast_nullable_to_non_nullable
          : away as num,
      home: home == const $CopyWithPlaceholder()
          ? _value.home
          // ignore: cast_nullable_to_non_nullable
          : home as num,
    );
  }
}

extension $PenaltiesDtoCopyWith on PenaltiesDto {
  /// Returns a callable class that can be used as follows: `instanceOfPenaltiesDto.copyWith(...)` or like so:`instanceOfPenaltiesDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PenaltiesDtoCWProxy get copyWith => _$PenaltiesDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PenaltiesDto _$PenaltiesDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PenaltiesDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['away', 'home']);
      final val = PenaltiesDto(
        away: $checkedConvert('away', (v) => v as num),
        home: $checkedConvert('home', (v) => v as num),
      );
      return val;
    });

Map<String, dynamic> _$PenaltiesDtoToJson(PenaltiesDto instance) =>
    <String, dynamic>{'away': instance.away, 'home': instance.home};
