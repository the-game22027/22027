//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/public_user_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'connected_user_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ConnectedUserDto {
  /// Returns a new [ConnectedUserDto] instance.
  ConnectedUserDto({required this.since, required this.user});

  @JsonKey(name: r'since', required: true, includeIfNull: false)
  final String since;

  @JsonKey(name: r'user', required: true, includeIfNull: false)
  final PublicUserDto user;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ConnectedUserDto && other.since == since && other.user == user;

  @override
  int get hashCode => since.hashCode + user.hashCode;

  factory ConnectedUserDto.fromJson(Map<String, dynamic> json) =>
      _$ConnectedUserDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ConnectedUserDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
