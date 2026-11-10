//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'privacy_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PrivacyDto {
  /// Returns a new [PrivacyDto] instance.
  PrivacyDto({

    required  this.predictionVisibility,
  });

  @JsonKey(
    
    name: r'predictionVisibility',
    required: true,
    includeIfNull: true,
  )


  final String? predictionVisibility;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PrivacyDto &&
      other.predictionVisibility == predictionVisibility;

    @override
    int get hashCode =>
        (predictionVisibility == null ? 0 : predictionVisibility.hashCode);

  factory PrivacyDto.fromJson(Map<String, dynamic> json) => _$PrivacyDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PrivacyDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

