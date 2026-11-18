//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'leaderboard_period_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LeaderboardPeriodDto {
  /// Returns a new [LeaderboardPeriodDto] instance.
  LeaderboardPeriodDto({
    required this.endsAt,

    required this.key,

    required this.kind,

    required this.startsAt,

    required this.status,
  });

  @JsonKey(name: r'endsAt', required: true, includeIfNull: true)
  final String? endsAt;

  @JsonKey(name: r'key', required: true, includeIfNull: false)
  final String key;

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LeaderboardPeriodDtoKindEnum.unknownDefaultOpenApi,
  )
  final LeaderboardPeriodDtoKindEnum kind;

  @JsonKey(name: r'startsAt', required: true, includeIfNull: false)
  final String startsAt;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LeaderboardPeriodDtoStatusEnum.unknownDefaultOpenApi,
  )
  final LeaderboardPeriodDtoStatusEnum status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LeaderboardPeriodDto &&
          other.endsAt == endsAt &&
          other.key == key &&
          other.kind == kind &&
          other.startsAt == startsAt &&
          other.status == status;

  @override
  int get hashCode =>
      (endsAt == null ? 0 : endsAt.hashCode) +
      key.hashCode +
      kind.hashCode +
      startsAt.hashCode +
      status.hashCode;

  factory LeaderboardPeriodDto.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardPeriodDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LeaderboardPeriodDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LeaderboardPeriodDtoKindEnum {
  @JsonValue(r'WEEKLY')
  WEEKLY(r'WEEKLY'),
  @JsonValue(r'MONTHLY')
  MONTHLY(r'MONTHLY'),
  @JsonValue(r'SEASONAL')
  SEASONAL(r'SEASONAL'),
  @JsonValue(r'ALL_TIME')
  ALL_TIME(r'ALL_TIME'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LeaderboardPeriodDtoKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum LeaderboardPeriodDtoStatusEnum {
  @JsonValue(r'CLOSED')
  CLOSED(r'CLOSED'),
  @JsonValue(r'OPEN')
  OPEN(r'OPEN'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LeaderboardPeriodDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
