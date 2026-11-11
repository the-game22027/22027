import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Answers Dio requests from a function instead of the network, and records what was sent.
class FakeHttpAdapter implements HttpClientAdapter {
  FakeHttpAdapter(this.answerRequest);

  final ResponseBody Function(RequestOptions request) answerRequest;
  final List<RequestOptions> sentRequests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    sentRequests.add(options);
    return answerRequest(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(
  Object? body, {
  int status = 200,
  String contentType = 'application/json',
}) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: [contentType],
  },
);

ResponseBody problemResponse(int status, String code) => jsonResponse(
  {'status': status, 'code': code, 'title': code, 'traceId': 'trace-1'},
  status: status,
  contentType: 'application/problem+json',
);

const meJson = {
  'id': '0193a000-0000-7000-8000-000000000001',
  'displayName': 'Alice',
  'username': null,
  'avatarUrl': null,
  'locale': 'en',
  'favouriteTeamId': null,
  'identities': [
    {'id': 'i-1', 'provider': 'GOOGLE', 'label': 'dev:alice'},
  ],
  'privacy': {'predictionVisibility': null},
};
