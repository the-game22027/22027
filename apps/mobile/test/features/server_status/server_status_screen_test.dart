import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/server_status/data/health_repository.dart';
import 'package:the_game/features/server_status/presentation/server_status_screen.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class _FakeHealthRepository implements HealthRepository {
  _FakeHealthRepository(this.health);

  ServerHealth health;

  @override
  Future<ServerHealth> checkServerHealth() async => health;
}

void main() {
  Future<void> pumpStatusScreen(
    WidgetTester tester,
    HealthRepository repository,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [healthRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ServerStatusScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('shows up when the backend is ready', (tester) async {
    await pumpStatusScreen(tester, _FakeHealthRepository(ServerHealth.up));

    expect(find.byKey(const Key('server-status-up')), findsOneWidget);
    expect(find.text('The server is up'), findsOneWidget);
  });

  testWidgets('shows down, and up again after "Check again"', (tester) async {
    final repository = _FakeHealthRepository(ServerHealth.down);
    await pumpStatusScreen(tester, repository);

    expect(find.byKey(const Key('server-status-down')), findsOneWidget);

    repository.health = ServerHealth.up;
    await tester.tap(find.text('Check again'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('server-status-up')), findsOneWidget);
  });
}
