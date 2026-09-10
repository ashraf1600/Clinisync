import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/main.dart';

void main() {
  testWidgets('CliniSync app boots with bottom navigation', (WidgetTester tester) async {
    await tester.pumpWidget(const CliniSyncApp());
    await tester.pump();

    // Bottom nav labels render on the first frame (no network needed)
    expect(find.text('Specialists'), findsOneWidget);
    expect(find.text('My Tokens'), findsOneWidget);
    expect(find.text('Live Queue'), findsOneWidget);
    expect(find.text('Alerts'), findsOneWidget);
  });
}
