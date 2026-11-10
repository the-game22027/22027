// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'match_detail_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MatchDetailDtoCWProxy {
  MatchDetailDto awayTeam(TeamDto awayTeam);

  MatchDetailDto competition(MatchCompetitionDto competition);

  MatchDetailDto endedAt(String? endedAt);

  MatchDetailDto homeTeam(TeamDto homeTeam);

  MatchDetailDto id(String id);

  MatchDetailDto kickoffAt(String kickoffAt);

  MatchDetailDto predictable(bool predictable);

  MatchDetailDto roundLabel(String? roundLabel);

  MatchDetailDto score(ScoreDto? score);

  MatchDetailDto serverTime(String serverTime);

  MatchDetailDto status(MatchDetailDtoStatusEnum status);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchDetailDto call({
    TeamDto awayTeam,
    MatchCompetitionDto competition,
    String? endedAt,
    TeamDto homeTeam,
    String id,
    String kickoffAt,
    bool predictable,
    String? roundLabel,
    ScoreDto? score,
    String serverTime,
    MatchDetailDtoStatusEnum status,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfMatchDetailDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfMatchDetailDto.copyWith.fieldName(...)`
class _$MatchDetailDtoCWProxyImpl implements _$MatchDetailDtoCWProxy {
  const _$MatchDetailDtoCWProxyImpl(this._value);

  final MatchDetailDto _value;

  @override
  MatchDetailDto awayTeam(TeamDto awayTeam) => this(awayTeam: awayTeam);

  @override
  MatchDetailDto competition(MatchCompetitionDto competition) =>
      this(competition: competition);

  @override
  MatchDetailDto endedAt(String? endedAt) => this(endedAt: endedAt);

  @override
  MatchDetailDto homeTeam(TeamDto homeTeam) => this(homeTeam: homeTeam);

  @override
  MatchDetailDto id(String id) => this(id: id);

  @override
  MatchDetailDto kickoffAt(String kickoffAt) => this(kickoffAt: kickoffAt);

  @override
  MatchDetailDto predictable(bool predictable) =>
      this(predictable: predictable);

  @override
  MatchDetailDto roundLabel(String? roundLabel) => this(roundLabel: roundLabel);

  @override
  MatchDetailDto score(ScoreDto? score) => this(score: score);

  @override
  MatchDetailDto serverTime(String serverTime) => this(serverTime: serverTime);

  @override
  MatchDetailDto status(MatchDetailDtoStatusEnum status) =>
      this(status: status);

  @override

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `MatchDetailDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// MatchDetailDto(...).copyWith(id: 12, name: "My name")
  /// ````
  MatchDetailDto call({
    Object? awayTeam = const $CopyWithPlaceholder(),
    Object? competition = const $CopyWithPlaceholder(),
    Object? endedAt = const $CopyWithPlaceholder(),
    Object? homeTeam = const $CopyWithPlaceholder(),
    Object? id = const $CopyWithPlaceholder(),
    Object? kickoffAt = const $CopyWithPlaceholder(),
    Object? predictable = const $CopyWithPlaceholder(),
    Object? roundLabel = const $CopyWithPlaceholder(),
    Object? score = const $CopyWithPlaceholder(),
    Object? serverTime = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
  }) {
    return MatchDetailDto(
      awayTeam: awayTeam == const $CopyWithPlaceholder()
          ? _value.awayTeam
          // ignore: cast_nullable_to_non_nullable
          : awayTeam as TeamDto,
      competition: competition == const $CopyWithPlaceholder()
          ? _value.competition
          // ignore: cast_nullable_to_non_nullable
          : competition as MatchCompetitionDto,
      endedAt: endedAt == const $CopyWithPlaceholder()
          ? _value.endedAt
          // ignore: cast_nullable_to_non_nullable
          : endedAt as String?,
      homeTeam: homeTeam == const $CopyWithPlaceholder()
          ? _value.homeTeam
          // ignore: cast_nullable_to_non_nullable
          : homeTeam as TeamDto,
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      kickoffAt: kickoffAt == const $CopyWithPlaceholder()
          ? _value.kickoffAt
          // ignore: cast_nullable_to_non_nullable
          : kickoffAt as String,
      predictable: predictable == const $CopyWithPlaceholder()
          ? _value.predictable
          // ignore: cast_nullable_to_non_nullable
          : predictable as bool,
      roundLabel: roundLabel == const $CopyWithPlaceholder()
          ? _value.roundLabel
          // ignore: cast_nullable_to_non_nullable
          : roundLabel as String?,
      score: score == const $CopyWithPlaceholder()
          ? _value.score
          // ignore: cast_nullable_to_non_nullable
          : score as ScoreDto?,
      serverTime: serverTime == const $CopyWithPlaceholder()
          ? _value.serverTime
          // ignore: cast_nullable_to_non_nullable
          : serverTime as String,
      status: status == const $CopyWithPlaceholder()
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as MatchDetailDtoStatusEnum,
    );
  }
}

extension $MatchDetailDtoCopyWith on MatchDetailDto {
  /// Returns a callable class that can be used as follows: `instanceOfMatchDetailDto.copyWith(...)` or like so:`instanceOfMatchDetailDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MatchDetailDtoCWProxy get copyWith => _$MatchDetailDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MatchDetailDto _$MatchDetailDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'MatchDetailDto',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const [
            'awayTeam',
            'competition',
            'endedAt',
            'homeTeam',
            'id',
            'kickoffAt',
            'predictable',
            'roundLabel',
            'score',
            'serverTime',
            'status'
          ],
        );
        final val = MatchDetailDto(
          awayTeam: $checkedConvert(
              'awayTeam', (v) => TeamDto.fromJson(v as Map<String, dynamic>)),
          competition: $checkedConvert('competition',
              (v) => MatchCompetitionDto.fromJson(v as Map<String, dynamic>)),
          endedAt: $checkedConvert('endedAt', (v) => v as String?),
          homeTeam: $checkedConvert(
              'homeTeam', (v) => TeamDto.fromJson(v as Map<String, dynamic>)),
          id: $checkedConvert('id', (v) => v as String),
          kickoffAt: $checkedConvert('kickoffAt', (v) => v as String),
          predictable: $checkedConvert('predictable', (v) => v as bool),
          roundLabel: $checkedConvert('roundLabel', (v) => v as String?),
          score: $checkedConvert(
              'score',
              (v) => v == null
                  ? null
                  : ScoreDto.fromJson(v as Map<String, dynamic>)),
          serverTime: $checkedConvert('serverTime', (v) => v as String),
          status: $checkedConvert(
              'status',
              (v) => $enumDecode(_$MatchDetailDtoStatusEnumEnumMap, v,
                  unknownValue:
                      MatchDetailDtoStatusEnum.unknownDefaultOpenApi)),
        );
        return val;
      },
    );

Map<String, dynamic> _$MatchDetailDtoToJson(MatchDetailDto instance) =>
    <String, dynamic>{
      'awayTeam': instance.awayTeam.toJson(),
      'competition': instance.competition.toJson(),
      'endedAt': instance.endedAt,
      'homeTeam': instance.homeTeam.toJson(),
      'id': instance.id,
      'kickoffAt': instance.kickoffAt,
      'predictable': instance.predictable,
      'roundLabel': instance.roundLabel,
      'score': instance.score?.toJson(),
      'serverTime': instance.serverTime,
      'status': _$MatchDetailDtoStatusEnumEnumMap[instance.status]!,
    };

const _$MatchDetailDtoStatusEnumEnumMap = {
  MatchDetailDtoStatusEnum.SCHEDULED: 'SCHEDULED',
  MatchDetailDtoStatusEnum.LIVE: 'LIVE',
  MatchDetailDtoStatusEnum.FINISHED: 'FINISHED',
  MatchDetailDtoStatusEnum.POSTPONED: 'POSTPONED',
  MatchDetailDtoStatusEnum.CANCELLED: 'CANCELLED',
  MatchDetailDtoStatusEnum.ABANDONED: 'ABANDONED',
  MatchDetailDtoStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
