// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'competition_list_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CompetitionListDtoCWProxy {
  CompetitionListDto items(List<CompetitionDto> items);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CompetitionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CompetitionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CompetitionListDto call({
    List<CompetitionDto> items,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfCompetitionListDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfCompetitionListDto.copyWith.fieldName(...)`
class _$CompetitionListDtoCWProxyImpl implements _$CompetitionListDtoCWProxy {
  const _$CompetitionListDtoCWProxyImpl(this._value);

  final CompetitionListDto _value;

  @override
  CompetitionListDto items(List<CompetitionDto> items) => this(items: items);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `CompetitionListDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// CompetitionListDto(...).copyWith(id: 12, name: "My name")
  /// ````
  CompetitionListDto call({
    Object? items = const $CopyWithPlaceholder(),
  }) {
    return CompetitionListDto(
      items: items == const $CopyWithPlaceholder()
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<CompetitionDto>,
    );
  }
}

extension $CompetitionListDtoCopyWith on CompetitionListDto {
  /// Returns a callable class that can be used as follows: `instanceOfCompetitionListDto.copyWith(...)` or like so:`instanceOfCompetitionListDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CompetitionListDtoCWProxy get copyWith =>
      _$CompetitionListDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CompetitionListDto _$CompetitionListDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'CompetitionListDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const ['items'],
        );
        final val = CompetitionListDto(
          items: $checkedConvert(
              'items',
              (v) => (v as List<dynamic>)
                  .map(
                      (e) => CompetitionDto.fromJson(e as Map<String, dynamic>))
                  .toList()),
        );
        return val;
      },
    );

Map<String, dynamic> _$CompetitionListDtoToJson(CompetitionListDto instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
    };
