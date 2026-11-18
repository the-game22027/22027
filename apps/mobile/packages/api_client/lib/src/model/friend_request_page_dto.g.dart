// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_request_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FriendRequestPageDtoCWProxy {
  FriendRequestPageDto items(List<FriendRequestDto> items);

  FriendRequestPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendRequestPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendRequestPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendRequestPageDto call({List<FriendRequestDto> items, String? nextCursor});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFriendRequestPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFriendRequestPageDto.copyWith.fieldName(...)`
class _$FriendRequestPageDtoCWProxyImpl
    implements _$FriendRequestPageDtoCWProxy {
  const _$FriendRequestPageDtoCWProxyImpl(this._value);

  final FriendRequestPageDto _value;

  @override
  FriendRequestPageDto items(List<FriendRequestDto> items) =>
      this(items: items);

  @override
  FriendRequestPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendRequestPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendRequestPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendRequestPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return FriendRequestPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<FriendRequestDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $FriendRequestPageDtoCopyWith on FriendRequestPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfFriendRequestPageDto.copyWith(...)` or like so:`instanceOfFriendRequestPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FriendRequestPageDtoCWProxy get copyWith =>
      _$FriendRequestPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequestPageDto _$FriendRequestPageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('FriendRequestPageDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
  final val = FriendRequestPageDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => FriendRequestDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$FriendRequestPageDtoToJson(
  FriendRequestPageDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
