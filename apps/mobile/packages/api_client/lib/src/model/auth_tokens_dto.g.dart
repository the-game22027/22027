// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_tokens_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AuthTokensDtoCWProxy {
  AuthTokensDto accessToken(String accessToken);

  AuthTokensDto accessTokenExpiresAt(String accessTokenExpiresAt);

  AuthTokensDto isNewUser(bool isNewUser);

  AuthTokensDto refreshToken(String refreshToken);

  AuthTokensDto user(MeDto user);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthTokensDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthTokensDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthTokensDto call({
    String accessToken,
    String accessTokenExpiresAt,
    bool isNewUser,
    String refreshToken,
    MeDto user,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfAuthTokensDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfAuthTokensDto.copyWith.fieldName(...)`
class _$AuthTokensDtoCWProxyImpl implements _$AuthTokensDtoCWProxy {
  const _$AuthTokensDtoCWProxyImpl(this._value);

  final AuthTokensDto _value;

  @override
  AuthTokensDto accessToken(String accessToken) =>
      this(accessToken: accessToken);

  @override
  AuthTokensDto accessTokenExpiresAt(String accessTokenExpiresAt) =>
      this(accessTokenExpiresAt: accessTokenExpiresAt);

  @override
  AuthTokensDto isNewUser(bool isNewUser) => this(isNewUser: isNewUser);

  @override
  AuthTokensDto refreshToken(String refreshToken) =>
      this(refreshToken: refreshToken);

  @override
  AuthTokensDto user(MeDto user) => this(user: user);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `AuthTokensDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// AuthTokensDto(...).copyWith(id: 12, name: "My name")
  /// ````
  AuthTokensDto call({
    Object? accessToken = const $CopyWithPlaceholder(),
    Object? accessTokenExpiresAt = const $CopyWithPlaceholder(),
    Object? isNewUser = const $CopyWithPlaceholder(),
    Object? refreshToken = const $CopyWithPlaceholder(),
    Object? user = const $CopyWithPlaceholder(),
  }) {
    return AuthTokensDto(
      accessToken: accessToken == const $CopyWithPlaceholder()
          ? _value.accessToken
          // ignore: cast_nullable_to_non_nullable
          : accessToken as String,
      accessTokenExpiresAt: accessTokenExpiresAt == const $CopyWithPlaceholder()
          ? _value.accessTokenExpiresAt
          // ignore: cast_nullable_to_non_nullable
          : accessTokenExpiresAt as String,
      isNewUser: isNewUser == const $CopyWithPlaceholder()
          ? _value.isNewUser
          // ignore: cast_nullable_to_non_nullable
          : isNewUser as bool,
      refreshToken: refreshToken == const $CopyWithPlaceholder()
          ? _value.refreshToken
          // ignore: cast_nullable_to_non_nullable
          : refreshToken as String,
      user: user == const $CopyWithPlaceholder()
          ? _value.user
          // ignore: cast_nullable_to_non_nullable
          : user as MeDto,
    );
  }
}

extension $AuthTokensDtoCopyWith on AuthTokensDto {
  /// Returns a callable class that can be used as follows: `instanceOfAuthTokensDto.copyWith(...)` or like so:`instanceOfAuthTokensDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AuthTokensDtoCWProxy get copyWith => _$AuthTokensDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthTokensDto _$AuthTokensDtoFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AuthTokensDto', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'accessToken',
          'accessTokenExpiresAt',
          'isNewUser',
          'refreshToken',
          'user',
        ],
      );
      final val = AuthTokensDto(
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        accessTokenExpiresAt: $checkedConvert(
          'accessTokenExpiresAt',
          (v) => v as String,
        ),
        isNewUser: $checkedConvert('isNewUser', (v) => v as bool),
        refreshToken: $checkedConvert('refreshToken', (v) => v as String),
        user: $checkedConvert(
          'user',
          (v) => MeDto.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AuthTokensDtoToJson(AuthTokensDto instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'accessTokenExpiresAt': instance.accessTokenExpiresAt,
      'isNewUser': instance.isNewUser,
      'refreshToken': instance.refreshToken,
      'user': instance.user.toJson(),
    };
