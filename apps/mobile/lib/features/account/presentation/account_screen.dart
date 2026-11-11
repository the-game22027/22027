import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/account/application/sign_out.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// Everything about the signed-in player's identity: profile, sessions, deletion, sign-out.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _isSigningOut = false;

  Future<void> _signOut() async {
    setState(() => _isSigningOut = true);
    // On success the router leaves this screen, so there is nothing to reset.
    await signOutOfThisDevice(ref);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountTitle)),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: FilledButton.tonal(
              key: const Key('sign-out'),
              onPressed: _isSigningOut ? null : _signOut,
              child: Text(l10n.signOutButton),
            ),
          ),
        ],
      ),
    );
  }
}
