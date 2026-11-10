//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'submitted_pick_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SubmittedPickDto {
  /// Returns a new [SubmittedPickDto] instance.
  SubmittedPickDto({

     this.away,

     this.home,

    required  this.type,
  });

  @JsonKey(
    
    name: r'away',
    required: false,
    includeIfNull: false,
  )


  final num? away;



  @JsonKey(
    
    name: r'home',
    required: false,
    includeIfNull: false,
  )


  final num? home;



  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final String type;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SubmittedPickDto &&
      other.away == away &&
      other.home == home &&
      other.type == type;

    @override
    int get hashCode =>
        away.hashCode +
        home.hashCode +
        type.hashCode;

  factory SubmittedPickDto.fromJson(Map<String, dynamic> json) => _$SubmittedPickDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SubmittedPickDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

