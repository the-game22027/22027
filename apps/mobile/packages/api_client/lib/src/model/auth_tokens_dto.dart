//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:api_client/src/model/me_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'auth_tokens_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthTokensDto {
  /// Returns a new [AuthTokensDto] instance.
  AuthTokensDto({
    required this.accessToken,

    required this.accessTokenExpiresAt,

    required this.isNewUser,

    required this.refreshToken,

    required this.user,
  });

  @JsonKey(name: r'accessToken', required: true, includeIfNull: false)
  final String accessToken;

  @JsonKey(name: r'accessTokenExpiresAt', required: true, includeIfNull: false)
  final String accessTokenExpiresAt;

  @JsonKey(name: r'isNewUser', required: true, includeIfNull: false)
  final bool isNewUser;

  @JsonKey(name: r'refreshToken', required: true, includeIfNull: false)
  final String refreshToken;

  @JsonKey(name: r'user', required: true, includeIfNull: false)
  final MeDto user;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AuthTokensDto &&
          other.accessToken == accessToken &&
          other.accessTokenExpiresAt == accessTokenExpiresAt &&
          other.isNewUser == isNewUser &&
          other.refreshToken == refreshToken &&
          other.user == user;

  @override
  int get hashCode =>
      accessToken.hashCode +
      accessTokenExpiresAt.hashCode +
      isNewUser.hashCode +
      refreshToken.hashCode +
      user.hashCode;

  factory AuthTokensDto.fromJson(Map<String, dynamic> json) =>
      _$AuthTokensDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AuthTokensDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
