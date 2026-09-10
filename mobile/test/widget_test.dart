import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/main.dart';

/// Hermetic HTTP stub: widget tests must not touch the network
/// (pending real timers fail the fake-async test zone).
class FakeAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final Object data;
    if (options.path.contains('/doctors')) {
      data = {
        'items': [],
        'meta': {'page': 1, 'pageSize': 20, 'totalCount': 0},
      };
    } else if (options.path.contains('/appointments')) {
      data = <dynamic>[];
    } else {
      data = {
        'items': [],
        'unreadCount': 0,
        'total': 0,
        'page': 1,
        'pageSize': 20,
      };
    }
    return ResponseBody.fromString(
      jsonEncode(data),
      200,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUpAll(() {
    ApiClient().dio.httpClientAdapter = FakeAdapter();
  });

  testWidgets('CliniSync app boots with bottom navigation', (WidgetTester tester) async {
    await tester.pumpWidget(const CliniSyncApp());
    await tester.pumpAndSettle();

    // Bottom nav labels render on the first frame (no network needed)
    expect(find.text('Specialists'), findsOneWidget);
    expect(find.text('My Tokens'), findsOneWidget);
    expect(find.text('Live Queue'), findsOneWidget);
    expect(find.text('Alerts'), findsOneWidget);
  });
}
