import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/server_status/application/server_health_provider.dart';
import 'package:the_game/features/server_status/data/health_repository.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class ServerStatusScreen extends ConsumerWidget {
  const ServerStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final health = ref.watch(serverHealthProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.serverStatusTitle)),
      body: Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              switch (health) {
                AsyncData(value: ServerHealth.up) => _HealthLabel(
                  key: const Key('server-status-up'),
                  icon: Icons.check_circle,
                  color: Colors.green,
                  text: l10n.serverStatusUp,
                ),
                AsyncData(value: ServerHealth.down) || AsyncError() =>
                  _HealthLabel(
                    key: const Key('server-status-down'),
                    icon: Icons.error,
                    color: Theme.of(context).colorScheme.error,
                    text: l10n.serverStatusDown,
                  ),
                _ => const CircularProgressIndicator(),
              },
              const SizedBox(height: 24),
              FilledButton.tonal(
                onPressed: health.isLoading
                    ? null
                    : () => ref.invalidate(serverHealthProvider),
                child: Text(l10n.checkAgainButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HealthLabel extends StatelessWidget {
  const _HealthLabel({
    required this.icon,
    required this.color,
    required this.text,
    super.key,
  });

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 64),
        const SizedBox(height: 12),
        Text(text, style: Theme.of(context).textTheme.headlineSmall),
      ],
    );
  }
}
