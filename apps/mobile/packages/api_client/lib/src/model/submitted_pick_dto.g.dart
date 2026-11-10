// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submitted_pick_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SubmittedPickDtoCWProxy {
  SubmittedPickDto away(num? away);

  SubmittedPickDto home(num? home);

  SubmittedPickDto type(String type);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SubmittedPickDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SubmittedPickDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SubmittedPickDto call({
    num? away,
    num? home,
    String type,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSubmittedPickDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSubmittedPickDto.copyWith.fieldName(...)`
class _$SubmittedPickDtoCWProxyImpl implements _$SubmittedPickDtoCWProxy {
  const _$SubmittedPickDtoCWProxyImpl(this._value);

  final SubmittedPickDto _value;

  @override
  SubmittedPickDto away(num? away) => this(away: away);

  @override
  SubmittedPickDto home(num? home) => this(home: home);

  @override
  SubmittedPickDto type(String type) => this(type: type);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SubmittedPickDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SubmittedPickDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SubmittedPickDto call({
    Object? away = const $CopyWithPlaceholder(),
    Object? home = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
  }) {
    return SubmittedPickDto(
      away: away == const $CopyWithPlaceholder()
          ? _value.away
          // ignore: cast_nullable_to_non_nullable
          : away as num?,
      home: home == const $CopyWithPlaceholder()
          ? _value.home
          // ignore: cast_nullable_to_non_nullable
          : home as num?,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as String,
    );
  }
}

extension $SubmittedPickDtoCopyWith on SubmittedPickDto {
  /// Returns a callable class that can be used as follows: `instanceOfSubmittedPickDto.copyWith(...)` or like so:`instanceOfSubmittedPickDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SubmittedPickDtoCWProxy get copyWith => _$SubmittedPickDtoCWProxyImpl(this);
}
