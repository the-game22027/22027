// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prediction_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PredictionDtoCWProxy {
  PredictionDto id(String id);

  PredictionDto locked(bool locked);

  PredictionDto matchId(String matchId);

  PredictionDto picks(List<PredictionPickDto> picks);

  PredictionDto revision(num revision);

  PredictionDto status(PredictionDtoStatusEnum status);

  PredictionDto updatedAt(String updatedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionDto call({
    String id,
    bool locked,
    String matchId,
    List<PredictionPickDto> picks,
    num revision,
    PredictionDtoStatusEnum status,
    String updatedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfPredictionDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfPredictionDto.copyWith.fieldName(...)`
class _$PredictionDtoCWProxyImpl implements _$PredictionDtoCWProxy {
  const _$PredictionDtoCWProxyImpl(this._value);

  final PredictionDto _value;

  @override
  PredictionDto id(String id) => this(id: id);

  @override
  PredictionDto locked(bool locked) => this(locked: locked);

  @override
  PredictionDto matchId(String matchId) => this(matchId: matchId);

  @override
  PredictionDto picks(List<PredictionPickDto> picks) => this(picks: picks);

  @override
  PredictionDto revision(num revision) => this(revision: revision);

  @override
  PredictionDto status(PredictionDtoStatusEnum status) => this(status: status);

  @override
  PredictionDto updatedAt(String updatedAt) => this(updatedAt: updatedAt);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `PredictionDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// PredictionDto(...).copyWith(id: 12, name: "My name")
  /// ````
  PredictionDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? locked = const $CopyWithPlaceholder(),
    Object? matchId = const $CopyWithPlaceholder(),
    Object? picks = const $CopyWithPlaceholder(),
    Object? revision = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
  }) {
    return PredictionDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      locked: locked == const $CopyWithPlaceholder()
          ? _value.locked
          // ignore: cast_nullable_to_non_nullable
          : locked as bool,
      matchId: matchId == const $CopyWithPlaceholder()
          ? _value.matchId
          // ignore: cast_nullable_to_non_nullable
          : matchId as String,
      picks: picks == const $CopyWithPlaceholder()
          ? _value.picks
          // ignore: cast_nullable_to_non_nullable
          : picks as List<PredictionPickDto>,
      revision: revision == const $CopyWithPlaceholder()
          ? _value.revision
          // ignore: cast_nullable_to_non_nullable
          : revision as num,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as PredictionDtoStatusEnum,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as String,
    );
  }
}

extension $PredictionDtoCopyWith on PredictionDto {
  /// Returns a callable class that can be used as follows: `instanceOfPredictionDto.copyWith(...)` or like so:`instanceOfPredictionDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PredictionDtoCWProxy get copyWith => _$PredictionDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PredictionDto _$PredictionDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'PredictionDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const [
            'id',
            'locked',
            'matchId',
            'picks',
            'revision',
            'status',
            'updatedAt'
          ],
        );
        final val = PredictionDto(
          id: $checkedConvert('id', (v) => v as String),
          locked: $checkedConvert('locked', (v) => v as bool),
          matchId: $checkedConvert('matchId', (v) => v as String),
          picks: $checkedConvert(
              'picks',
              (v) => (v as List<dynamic>)
                  .map((e) =>
                      PredictionPickDto.fromJson(e as Map<String, dynamic>))
                  .toList()),
          revision: $checkedConvert('revision', (v) => v as num),
          status: $checkedConvert(
              'status',
              (v) => $enumDecode(_$PredictionDtoStatusEnumEnumMap, v,
                  unknownValue: PredictionDtoStatusEnum.unknownDefaultOpenApi)),
          updatedAt: $checkedConvert('updatedAt', (v) => v as String),
        );
        return val;
      },
    );

Map<String, dynamic> _$PredictionDtoToJson(PredictionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'locked': instance.locked,
      'matchId': instance.matchId,
      'picks': instance.picks.map((e) => e.toJson()).toList(),
      'revision': instance.revision,
      'status': _$PredictionDtoStatusEnumEnumMap[instance.status]!,
      'updatedAt': instance.updatedAt,
    };

const _$PredictionDtoStatusEnumEnumMap = {
  PredictionDtoStatusEnum.ACTIVE: 'ACTIVE',
  PredictionDtoStatusEnum.VOID: 'VOID',
  PredictionDtoStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
