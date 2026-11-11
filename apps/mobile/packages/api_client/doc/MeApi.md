# api_client.api.MeApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**meControllerDeleteMeV1**](MeApi.md#mecontrollerdeletemev1) | **DELETE** /v1/me | 
[**meControllerGetMeV1**](MeApi.md#mecontrollergetmev1) | **GET** /v1/me | 
[**meControllerUpdateMeV1**](MeApi.md#mecontrollerupdatemev1) | **PATCH** /v1/me | 


# **meControllerDeleteMeV1**
> meControllerDeleteMeV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getMeApi();

try {
    api.meControllerDeleteMeV1();
} on DioException catch (e) {
    print('Exception when calling MeApi->meControllerDeleteMeV1: $e\n');
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

# **meControllerGetMeV1**
> MeDto meControllerGetMeV1()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getMeApi();

try {
    final response = api.meControllerGetMeV1();
    print(response);
} on DioException catch (e) {
    print('Exception when calling MeApi->meControllerGetMeV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**MeDto**](MeDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meControllerUpdateMeV1**
> MeDto meControllerUpdateMeV1(updateMeDto)



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getMeApi();
final UpdateMeDto updateMeDto = ; // UpdateMeDto | 

try {
    final response = api.meControllerUpdateMeV1(updateMeDto);
    print(response);
} on DioException catch (e) {
    print('Exception when calling MeApi->meControllerUpdateMeV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateMeDto** | [**UpdateMeDto**](UpdateMeDto.md)|  | 

### Return type

[**MeDto**](MeDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

