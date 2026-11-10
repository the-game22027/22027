//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/penalties_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'score_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ScoreDto {
  /// Returns a new [ScoreDto] instance.
  ScoreDto({

    required  this.away,

     this.decidedBy,

    required  this.home,

     this.penalties,
  });

  @JsonKey(
    
    name: r'away',
    required: true,
    includeIfNull: false,
  )


  final num away;



  @JsonKey(
    
    name: r'decidedBy',
    required: false,
    includeIfNull: false,
  )


  final String? decidedBy;



  @JsonKey(
    
    name: r'home',
    required: true,
    includeIfNull: false,
  )


  final num home;



  @JsonKey(
    
    name: r'penalties',
    required: false,
    includeIfNull: false,
  )


  final PenaltiesDto? penalties;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ScoreDto &&
      other.away == away &&
      other.decidedBy == decidedBy &&
      other.home == home &&
      other.penalties == penalties;

    @override
    int get hashCode =>
        away.hashCode +
        decidedBy.hashCode +
        home.hashCode +
        penalties.hashCode;

  factory ScoreDto.fromJson(Map<String, dynamic> json) => _$ScoreDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ScoreDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

