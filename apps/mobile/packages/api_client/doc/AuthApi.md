# api_client.api.AuthApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**authControllerRefreshV1**](AuthApi.md#authcontrollerrefreshv1) | **POST** /v1/auth/refresh | Rotates the refresh token: the old one stops working, and presenting it again revokes the whole sign-in.
[**authControllerSignInWithGoogleV1**](AuthApi.md#authcontrollersigninwithgooglev1) | **POST** /v1/auth/google | 201 for a new account, 200 for an existing one.
[**sessionsControllerListV1**](AuthApi.md#sessionscontrollerlistv1) | **GET** /v1/auth/sessions | 
[**sessionsControllerLogoutV1**](AuthApi.md#sessionscontrollerlogoutv1) | **POST** /v1/auth/logout | 
[**sessionsControllerRevokeV1**](AuthApi.md#sessionscontrollerrevokev1) | **DELETE** /v1/auth/sessions/{sessionId} | 


# **authControllerRefreshV1**
> AuthTokensDto authControllerRefreshV1(refreshDto)

Rotates the refresh token: the old one stops working, and presenting it again revokes the whole sign-in.

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getAuthApi();
final RefreshDto refreshDto = ; // RefreshDto | 

try {
    final response = api.authControllerRefreshV1(refreshDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authControllerRefreshV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **refreshDto** | [**RefreshDto**](RefreshDto.md)|  | 

### Return type

[**AuthTokensDto**](AuthTokensDto.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authControllerSignInWithGoogleV1**
> AuthTokensDto authControllerSignInWithGoogleV1(googleSignInDto)

201 for a new account, 200 for an existing one.

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getAuthApi();
final GoogleSignInDto googleSignInDto = ; // GoogleSignInDto | 

try {
    final response = api.authControllerSignInWithGoogleV1(googleSignInDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->authControllerSignInWithGoogleV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **googleSignInDto** | [**GoogleSignInDto**](GoogleSignInDto.md)|  | 

### Return type

[**AuthTokensDto**](AuthTokensDto.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessionsControllerListV1**
> List<SessionInfoDto> sessionsControllerListV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getAuthApi();

try {
    final response = api.sessionsControllerListV1();
    print(response);
} on DioException catch (e) {
    print('Exception when calling AuthApi->sessionsControllerListV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**List&lt;SessionInfoDto&gt;**](SessionInfoDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessionsControllerLogoutV1**
> sessionsControllerLogoutV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getAuthApi();

try {
    api.sessionsControllerLogoutV1();
} on DioException catch (e) {
    print('Exception when calling AuthApi->sessionsControllerLogoutV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sessionsControllerRevokeV1**
> sessionsControllerRevokeV1(sessionId)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getAuthApi();
final String sessionId = sessionId_example; // String | 

try {
    api.sessionsControllerRevokeV1(sessionId);
} on DioException catch (e) {
    print('Exception when calling AuthApi->sessionsControllerRevokeV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sessionId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

