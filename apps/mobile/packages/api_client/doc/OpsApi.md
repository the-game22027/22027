# api_client.api.OpsApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**healthControllerLive**](OpsApi.md#healthcontrollerlive) | **GET** /health/live | 
[**healthControllerReady**](OpsApi.md#healthcontrollerready) | **GET** /health/ready | 


# **healthControllerLive**
> Object healthControllerLive()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getOpsApi();

try {
    final response = api.healthControllerLive();
    print(response);
} on DioException catch (e) {
    print('Exception when calling OpsApi->healthControllerLive: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **healthControllerReady**
> Object healthControllerReady()



### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getOpsApi();

try {
    final response = api.healthControllerReady();
    print(response);
} on DioException catch (e) {
    print('Exception when calling OpsApi->healthControllerReady: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

