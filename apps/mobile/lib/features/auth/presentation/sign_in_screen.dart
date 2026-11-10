import 'package:flutter/material.dart';

import 'package:the_game/core/widgets/app_bar_shortcuts.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// Placeholder until Google, Facebook and X sign-in arrive in M1.
/// The prod flavor lands here because it has no dev sign-in.
class SignInScreen extends StatelessWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.signInTitle),
        actions: buildAppBarShortcuts(context),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Text(
            l10n.signInNotAvailableYet,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
