import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/core/widgets/app_bar_shortcuts.dart';
import 'package:the_game/features/account/application/google_sign_in_controller.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final config = ref.watch(appConfigProvider);
    final googleSignIn = ref.watch(googleSignInControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.signInTitle),
        actions: buildAppBarShortcuts(context),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.signInWelcome, textAlign: TextAlign.center),
              const SizedBox(height: 32),
              FilledButton(
                key: const Key('continue-with-google'),
                onPressed:
                    !config.isGoogleSignInConfigured || googleSignIn.isLoading
                    ? null
                    : () => ref
                          .read(googleSignInControllerProvider.notifier)
                          .signInWithGoogle(),
                child: googleSignIn.isLoading
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(l10n.continueWithGoogleButton),
              ),
              if (!config.isGoogleSignInConfigured)
                Padding(
                  padding: const EdgeInsetsDirectional.only(top: 8),
                  child: Text(
                    l10n.googleSignInNotConfigured,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              if (googleSignIn case AsyncError(:final error))
                Padding(
                  padding: const EdgeInsetsDirectional.only(top: 16),
                  child: Text(
                    error is GoogleSignInUnavailableError
                        ? l10n.googleSignInUnavailable
                        : describeErrorForUser(error, l10n),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (config.isDevFlavor) ...[
                const SizedBox(height: 32),
                TextButton(
                  onPressed: () => context.push(AppRoutes.devSignIn),
                  child: Text(l10n.openDevSignInButton),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
