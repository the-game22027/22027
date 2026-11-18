# api_client.api.QuestionsApi

## Load the API package
```dart
import 'package:api_client/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**questionReportsControllerReportV1**](QuestionsApi.md#questionreportscontrollerreportv1) | **POST** /v1/questions/{questionId}/reports | 204 also for a repeat: the player&#39;s first report stays (08 §5.7).


# **questionReportsControllerReportV1**
> questionReportsControllerReportV1(questionId, reportQuestionDto)

204 also for a repeat: the player's first report stays (08 §5.7).

### Example
```dart
import 'package:api_client/api.dart';

final api = ApiClient().getQuestionsApi();
final String questionId = questionId_example; // String | 
final ReportQuestionDto reportQuestionDto = ; // ReportQuestionDto | 

try {
    api.questionReportsControllerReportV1(questionId, reportQuestionDto);
} on DioException catch (e) {
    print('Exception when calling QuestionsApi->questionReportsControllerReportV1: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **questionId** | **String**|  | 
 **reportQuestionDto** | [**ReportQuestionDto**](ReportQuestionDto.md)|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

