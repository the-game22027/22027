// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_search_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$UserSearchPageDtoCWProxy {
  UserSearchPageDto items(List<PublicUserDto> items);

  UserSearchPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserSearchPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserSearchPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserSearchPageDto call({List<PublicUserDto> items, String? nextCursor});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfUserSearchPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfUserSearchPageDto.copyWith.fieldName(...)`
class _$UserSearchPageDtoCWProxyImpl implements _$UserSearchPageDtoCWProxy {
  const _$UserSearchPageDtoCWProxyImpl(this._value);

  final UserSearchPageDto _value;

  @override
  UserSearchPageDto items(List<PublicUserDto> items) => this(items: items);

  @override
  UserSearchPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `UserSearchPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// UserSearchPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  UserSearchPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return UserSearchPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<PublicUserDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $UserSearchPageDtoCopyWith on UserSearchPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfUserSearchPageDto.copyWith(...)` or like so:`instanceOfUserSearchPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$UserSearchPageDtoCWProxy get copyWith =>
      _$UserSearchPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserSearchPageDto _$UserSearchPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserSearchPageDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
      final val = UserSearchPageDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => PublicUserDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$UserSearchPageDtoToJson(UserSearchPageDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
