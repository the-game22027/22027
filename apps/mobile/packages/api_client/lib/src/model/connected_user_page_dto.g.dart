// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'connected_user_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ConnectedUserPageDtoCWProxy {
  ConnectedUserPageDto items(List<ConnectedUserDto> items);

  ConnectedUserPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConnectedUserPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConnectedUserPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConnectedUserPageDto call({List<ConnectedUserDto> items, String? nextCursor});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfConnectedUserPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfConnectedUserPageDto.copyWith.fieldName(...)`
class _$ConnectedUserPageDtoCWProxyImpl
    implements _$ConnectedUserPageDtoCWProxy {
  const _$ConnectedUserPageDtoCWProxyImpl(this._value);

  final ConnectedUserPageDto _value;

  @override
  ConnectedUserPageDto items(List<ConnectedUserDto> items) =>
      this(items: items);

  @override
  ConnectedUserPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ConnectedUserPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ConnectedUserPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ConnectedUserPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return ConnectedUserPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ConnectedUserDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $ConnectedUserPageDtoCopyWith on ConnectedUserPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfConnectedUserPageDto.copyWith(...)` or like so:`instanceOfConnectedUserPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ConnectedUserPageDtoCWProxy get copyWith =>
      _$ConnectedUserPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConnectedUserPageDto _$ConnectedUserPageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ConnectedUserPageDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
  final val = ConnectedUserPageDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => ConnectedUserDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$ConnectedUserPageDtoToJson(
  ConnectedUserPageDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
