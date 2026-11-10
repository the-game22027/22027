import 'dart:io';

import 'package:dio/dio.dart';

import 'package:the_game/core/errors/api_problem.dart';

/// Every failure a feature can see from the network. Dio types never leave `core/`.
sealed class AppError implements Exception {
  const AppError();
}

/// The server answered with an error status.
class ApiProblemError extends AppError {
  const ApiProblemError(this.problem);

  final ApiProblem problem;

  @override
  String toString() => 'ApiProblemError($problem)';
}

/// No connection could be made (server down, wrong URL, no network).
class ServerUnreachableError extends AppError {
  const ServerUnreachableError();
}

class RequestTimedOutError extends AppError {
  const RequestTimedOutError();
}

/// The server answered 2xx but the body did not match the contract, or something unexpected broke.
class UnexpectedResponseError extends AppError {
  const UnexpectedResponseError(this.cause);

  final Object? cause;

  @override
  String toString() => 'UnexpectedResponseError($cause)';
}

AppError convertDioExceptionToAppError(DioException exception) {
  switch (exception.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
      return const RequestTimedOutError();
    case DioExceptionType.connectionError:
      return const ServerUnreachableError();
    case DioExceptionType.badResponse:
      final response = exception.response;
      return ApiProblemError(
        ApiProblem.fromResponseBody(
          status: response?.statusCode ?? 0,
          body: response?.data,
        ),
      );
    case DioExceptionType.unknown:
      if (exception.error is SocketException) {
        return const ServerUnreachableError();
      }
      return UnexpectedResponseError(exception.error ?? exception);
    case DioExceptionType.badCertificate:
    case DioExceptionType.cancel:
      return UnexpectedResponseError(exception);
  }
}

/// Runs a generated-client call and returns its body, or throws an [AppError].
Future<T> sendRequestAndReadData<T>(
  Future<Response<T>> Function() sendRequest,
) async {
  final Response<T> response;
  try {
    response = await sendRequest();
  } on DioException catch (exception) {
    throw convertDioExceptionToAppError(exception);
  }
  final data = response.data;
  if (data == null) {
    throw const UnexpectedResponseError('response body was empty');
  }
  return data;
}

/// Same as [sendRequestAndReadData] for endpoints that answer `204 No Content`.
Future<void> sendRequestWithoutData(
  Future<Response<void>> Function() sendRequest,
) async {
  try {
    await sendRequest();
  } on DioException catch (exception) {
    throw convertDioExceptionToAppError(exception);
  }
}
