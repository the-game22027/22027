// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'squad_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SquadListDtoCWProxy {
  SquadListDto items(List<SquadPlayerDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SquadListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SquadListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SquadListDto call({List<SquadPlayerDto> items});
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfSquadListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfSquadListDto.copyWith.fieldName(...)`
class _$SquadListDtoCWProxyImpl implements _$SquadListDtoCWProxy {
  const _$SquadListDtoCWProxyImpl(this._value);

  final SquadListDto _value;

  @override
  SquadListDto items(List<SquadPlayerDto> items) => this(items: items);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `SquadListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// SquadListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  SquadListDto call({Object? items = const $CopyWithPlaceholder()}) {
    return SquadListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<SquadPlayerDto>,
    );
  }
}

extension $SquadListDtoCopyWith on SquadListDto {
  /// Returns a callable class that can be used as follows: `instanceOfSquadListDto.copyWith(...)` or like so:`instanceOfSquadListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SquadListDtoCWProxy get copyWith => _$SquadListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SquadListDto _$SquadListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SquadListDto', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items']);
      final val = SquadListDto(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => SquadPlayerDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SquadListDtoToJson(SquadListDto instance) =>
    <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
