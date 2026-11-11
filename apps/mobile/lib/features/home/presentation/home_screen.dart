import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/core/widgets/app_bar_shortcuts.dart';
import 'package:the_game/features/home/application/home_providers.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(currentPlayerProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.homeTitle),
        actions: [
          IconButton(
            key: const Key('open-account'),
            tooltip: l10n.accountTitle,
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () => context.push(AppRoutes.account),
          ),
          ...buildAppBarShortcuts(context),
        ],
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              switch (profile) {
                AsyncData(:final value) => Column(
                  children: [
                    Text(
                      l10n.homeGreeting(value.displayName),
                      key: const Key('home-display-name'),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(l10n.homeProfileLocale(value.locale)),
                  ],
                ),
                AsyncError(:final error) => Column(
                  children: [
                    Text(describeErrorForUser(error, l10n)),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () =>
                          ref.invalidate(currentPlayerProfileProvider),
                      child: Text(l10n.tryAgainButton),
                    ),
                  ],
                ),
                _ => const CircularProgressIndicator(),
              },
            ],
          ),
        ),
      ),
    );
  }
}
