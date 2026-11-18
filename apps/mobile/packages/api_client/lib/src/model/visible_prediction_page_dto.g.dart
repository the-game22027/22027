// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visible_prediction_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VisiblePredictionPageDtoCWProxy {
  VisiblePredictionPageDto items(List<VisiblePredictionDto> items);

  VisiblePredictionPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiblePredictionPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiblePredictionPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiblePredictionPageDto call({
    List<VisiblePredictionDto> items,
    String? nextCursor,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfVisiblePredictionPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfVisiblePredictionPageDto.copyWith.fieldName(...)`
class _$VisiblePredictionPageDtoCWProxyImpl
    implements _$VisiblePredictionPageDtoCWProxy {
  const _$VisiblePredictionPageDtoCWProxyImpl(this._value);

  final VisiblePredictionPageDto _value;

  @override
  VisiblePredictionPageDto items(List<VisiblePredictionDto> items) =>
      this(items: items);

  @override
  VisiblePredictionPageDto nextCursor(String? nextCursor) =>
      this(nextCursor: nextCursor);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `VisiblePredictionPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// VisiblePredictionPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  VisiblePredictionPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return VisiblePredictionPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<VisiblePredictionDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $VisiblePredictionPageDtoCopyWith on VisiblePredictionPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfVisiblePredictionPageDto.copyWith(...)` or like so:`instanceOfVisiblePredictionPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VisiblePredictionPageDtoCWProxy get copyWith =>
      _$VisiblePredictionPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VisiblePredictionPageDto _$VisiblePredictionPageDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VisiblePredictionPageDto', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
  final val = VisiblePredictionPageDto(
    items: $checkedConvert(
      'items',
      (v) => (v as List<dynamic>)
          .map((e) => VisiblePredictionDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$VisiblePredictionPageDtoToJson(
  VisiblePredictionPageDto instance,
) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
