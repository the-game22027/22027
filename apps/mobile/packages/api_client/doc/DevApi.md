# api_client.api.DevApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**devAuthControllerDevSignInV1**](DevApi.md#devauthcontrollerdevsigninv1) | **POST** /v1/_dev/auth/sign-in | 
[**devControllerEchoV1**](DevApi.md#devcontrollerechov1) | **POST** /v1/_dev/echo | 
[**devControllerSampleConflictV1**](DevApi.md#devcontrollersampleconflictv1) | **GET** /v1/_dev/sample-conflict | 


# **devAuthControllerDevSignInV1**
> AuthTokensDto devAuthControllerDevSignInV1(devSignInDto)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getDevApi();
final DevSignInDto devSignInDto = ; // DevSignInDto | 

try {
    final response = api.devAuthControllerDevSignInV1(devSignInDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling DevApi->devAuthControllerDevSignInV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **devSignInDto** | [**DevSignInDto**](DevSignInDto.md)|  | 

### Return type

[**AuthTokensDto**](AuthTokensDto.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **devControllerEchoV1**
> devControllerEchoV1(body)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getDevApi();
final Object body = Object; // Object | 

try {
    api.devControllerEchoV1(body);
} on DioException catch (e) {
    print('Exception when calling DevApi->devControllerEchoV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | **Object**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **devControllerSampleConflictV1**
> devControllerSampleConflictV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getDevApi();

try {
    api.devControllerSampleConflictV1();
} on DioException catch (e) {
    print('Exception when calling DevApi->devControllerSampleConflictV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

