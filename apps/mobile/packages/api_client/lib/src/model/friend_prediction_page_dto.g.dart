// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_prediction_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$FriendPredictionPageDtoCWProxy {
  FriendPredictionPageDto items(List<FriendPredictionDto> items);

  FriendPredictionPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendPredictionPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendPredictionPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendPredictionPageDto call({
    List<FriendPredictionDto> items,
    String? nextCursor,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfFriendPredictionPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfFriendPredictionPageDto.copyWith.fieldName(...)`
class _$FriendPredictionPageDtoCWProxyImpl
    implements _$FriendPredictionPageDtoCWProxy {
  const _$FriendPredictionPageDtoCWProxyImpl(this._value);

  final FriendPredictionPageDto _value;

  @override
  FriendPredictionPageDto items(List<FriendPredictionDto> items) =>
      this(items: items);

  @override
  FriendPredictionPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `FriendPredictionPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// FriendPredictionPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  FriendPredictionPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return FriendPredictionPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<FriendPredictionDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $FriendPredictionPageDtoCopyWith on FriendPredictionPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfFriendPredictionPageDto.copyWith(...)` or like so:`instanceOfFriendPredictionPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$FriendPredictionPageDtoCWProxy get copyWith =>
      _$FriendPredictionPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendPredictionPageDto _$FriendPredictionPageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('FriendPredictionPageDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
  final val = FriendPredictionPageDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => FriendPredictionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$FriendPredictionPageDtoToJson(
  FriendPredictionPageDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
