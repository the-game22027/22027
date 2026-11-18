//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/prediction_pick_dto.dart';
import 'package:api_client/src/model/prediction_score_dto.dart';
import 'package:api_client/src/model/public_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'friend_prediction_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FriendPredictionDto {
  /// Returns a new [FriendPredictionDto] instance.
  FriendPredictionDto({
    required this.picks,

    required this.score,

    required this.status,

    required this.user,
  });

  @JsonKey(name: r'picks', required: true, includeIfNull: false)
  final List<PredictionPickDto> picks;

  /// null until prediction scoring exists (P3.2).
  @JsonKey(name: r'score', required: true, includeIfNull: true)
  final PredictionScoreDto? score;

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: FriendPredictionDtoStatusEnum.unknownDefaultOpenApi,
  )
  final FriendPredictionDtoStatusEnum status;

  @JsonKey(name: r'user', required: true, includeIfNull: false)
  final PublicUserDto user;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FriendPredictionDto &&
          other.picks == picks &&
          other.score == score &&
          other.status == status &&
          other.user == user;

  @override
  int get hashCode =>
      picks.hashCode +
      (score == null ? 0 : score.hashCode) +
      status.hashCode +
      user.hashCode;

  factory FriendPredictionDto.fromJson(Map<String, dynamic> json) =>
      _$FriendPredictionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$FriendPredictionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum FriendPredictionDtoStatusEnum {
  @JsonValue(r'ACTIVE')
  ACTIVE(r'ACTIVE'),
  @JsonValue(r'VOID')
  VOID(r'VOID'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const FriendPredictionDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
