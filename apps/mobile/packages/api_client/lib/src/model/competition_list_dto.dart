//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/competition_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'competition_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CompetitionListDto {
  /// Returns a new [CompetitionListDto] instance.
  CompetitionListDto({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<CompetitionDto> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CompetitionListDto &&
      other.items == items;

    @override
    int get hashCode =>
        items.hashCode;

  factory CompetitionListDto.fromJson(Map<String, dynamic> json) => _$CompetitionListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CompetitionListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

