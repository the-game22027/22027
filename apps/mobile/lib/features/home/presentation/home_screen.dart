import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/core/widgets/app_bar_shortcuts.dart';
import 'package:the_game/features/home/application/home_providers.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _isSigningOut = false;

  Future<void> _signOut() async {
    setState(() => _isSigningOut = true);
    // On success the router leaves this screen, so there is nothing to reset.
    await signOutOfThisDevice(ref);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(currentPlayerProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.homeTitle),
        actions: buildAppBarShortcuts(context),
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
              const SizedBox(height: 32),
              FilledButton.tonal(
                onPressed: _isSigningOut ? null : _signOut,
                child: Text(l10n.signOutButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
