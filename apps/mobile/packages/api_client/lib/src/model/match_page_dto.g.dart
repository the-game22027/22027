// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'match_page_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MatchPageDtoCWProxy {
  MatchPageDto items(List<MatchSummaryDto> items);

  MatchPageDto nextCursor(String? nextCursor);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchPageDto call({
    List<MatchSummaryDto> items,
    String? nextCursor,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMatchPageDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMatchPageDto.copyWith.fieldName(...)`
class _$MatchPageDtoCWProxyImpl implements _$MatchPageDtoCWProxy {
  const _$MatchPageDtoCWProxyImpl(this._value);

  final MatchPageDto _value;

  @override
  MatchPageDto items(List<MatchSummaryDto> items) => this(items: items);

  @override
  MatchPageDto nextCursor(String? nextCursor) => this(nextCursor: nextCursor);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchPageDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchPageDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchPageDto call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return MatchPageDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<MatchSummaryDto>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $MatchPageDtoCopyWith on MatchPageDto {
  /// Returns a callable class that can be used as follows: `instanceOfMatchPageDto.copyWith(...)` or like so:`instanceOfMatchPageDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MatchPageDtoCWProxy get copyWith => _$MatchPageDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MatchPageDto _$MatchPageDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'MatchPageDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const ['items', 'nextCursor'],
        );
        final val = MatchPageDto(
          items: $checkedConvert(
              'items',
              (v) => (v as List<dynamic>)
                  .map((e) =>
                      MatchSummaryDto.fromJson(e as Map<String, dynamic>))
                  .toList()),
          nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
        );
        return val;
      },
    );

Map<String, dynamic> _$MatchPageDtoToJson(MatchPageDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
