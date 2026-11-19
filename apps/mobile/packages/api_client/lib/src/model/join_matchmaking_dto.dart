//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'join_matchmaking_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JoinMatchmakingDto {
  /// Returns a new [JoinMatchmakingDto] instance.
  JoinMatchmakingDto({required this.gameType});

  @JsonKey(
    name: r'gameType',
    required: true,
    includeIfNull: false,
    unknownEnumValue: JoinMatchmakingDtoGameTypeEnum.unknownDefaultOpenApi,
  )
  final JoinMatchmakingDtoGameTypeEnum gameType;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JoinMatchmakingDto && other.gameType == gameType;

  @override
  int get hashCode => gameType.hashCode;

  factory JoinMatchmakingDto.fromJson(Map<String, dynamic> json) =>
      _$JoinMatchmakingDtoFromJson(json);

  Map<String, dynamic> toJson() => _$JoinMatchmakingDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum JoinMatchmakingDtoGameTypeEnum {
  @JsonValue(r'BUZZER')
  BUZZER(r'BUZZER'),
  @JsonValue(r'CAREER')
  CAREER(r'CAREER'),
  @JsonValue(r'WHO_IS_PLAYER')
  WHO_IS_PLAYER(r'WHO_IS_PLAYER'),
  @JsonValue(r'GRID')
  GRID(r'GRID'),
  @JsonValue(r'MINES')
  MINES(r'MINES'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const JoinMatchmakingDtoGameTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
