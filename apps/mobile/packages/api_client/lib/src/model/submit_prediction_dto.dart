//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/submitted_pick_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'submit_prediction_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SubmitPredictionDto {
  /// Returns a new [SubmitPredictionDto] instance.
  SubmitPredictionDto({

    required  this.picks,
  });

  @JsonKey(
    
    name: r'picks',
    required: true,
    includeIfNull: false,
  )


  final List<SubmittedPickDto> picks;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SubmitPredictionDto &&
      other.picks == picks;

    @override
    int get hashCode =>
        picks.hashCode;

  factory SubmitPredictionDto.fromJson(Map<String, dynamic> json) => _$SubmitPredictionDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SubmitPredictionDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

