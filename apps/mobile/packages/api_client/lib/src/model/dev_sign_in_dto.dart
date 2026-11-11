//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/device_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'dev_sign_in_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DevSignInDto {
  /// Returns a new [DevSignInDto] instance.
  DevSignInDto({this.device, this.displayName, required this.subject});

  @JsonKey(name: r'device', required: false, includeIfNull: false)
  final DeviceDto? device;

  @JsonKey(name: r'displayName', required: false, includeIfNull: false)
  final String? displayName;

  @JsonKey(name: r'subject', required: true, includeIfNull: false)
  final String subject;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DevSignInDto &&
          other.device == device &&
          other.displayName == displayName &&
          other.subject == subject;

  @override
  int get hashCode => device.hashCode + displayName.hashCode + subject.hashCode;

  factory DevSignInDto.fromJson(Map<String, dynamic> json) =>
      _$DevSignInDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DevSignInDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
