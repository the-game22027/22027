# api_client.api.QuestionBankApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**answerCatalogControllerAnswerCatalogV1**](QuestionBankApi.md#answercatalogcontrolleranswercatalogv1) | **GET** /v1/answer-catalog | 08 §5.5. The body is written by hand: it is pre-serialized and pre-gzipped once per version.


# **answerCatalogControllerAnswerCatalogV1**
> AnswerCatalogDto answerCatalogControllerAnswerCatalogV1()

08 §5.5. The body is written by hand: it is pre-serialized and pre-gzipped once per version.

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getQuestionBankApi();

try {
    final response = api.answerCatalogControllerAnswerCatalogV1();
    print(response);
} on DioException catch (e) {
    print('Exception when calling QuestionBankApi->answerCatalogControllerAnswerCatalogV1: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AnswerCatalogDto**](AnswerCatalogDto.md)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

