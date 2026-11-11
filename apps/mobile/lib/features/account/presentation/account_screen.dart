import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/features/account/application/account_deletion.dart';
import 'package:the_game/features/account/application/google_sign_in_controller.dart';
import 'package:the_game/features/account/application/sign_out.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

enum _ReauthenticationMethod { google, devAccount }

/// Everything about the signed-in player's identity: profile, sessions, deletion, sign-out.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _isBusy = false;

  Future<void> _signOut() async {
    setState(() => _isBusy = true);
    // On success the router leaves this screen, so there is nothing to reset.
    await signOutOfThisDevice(ref);
  }

  Future<void> _confirmAndDeleteAccount() async {
    final l10n = AppLocalizations.of(context);
    final isConfirmed = await _askForConfirmation(
      title: l10n.deleteAccountTitle,
      body: l10n.deleteAccountConfirmBody,
      confirmLabel: l10n.deleteAccountConfirmButton,
    );
    if (isConfirmed != true || !mounted) return;

    setState(() => _isBusy = true);
    final service = ref.read(accountDeletionServiceProvider);
    try {
      var outcome = await service.requestAccountDeletion();
      if (outcome is ReauthenticationRequired) {
        outcome = await _reauthenticateAndRequestDeletion(service);
      }
      if (!mounted) return;
      switch (outcome) {
        case AccountDeletionRequested():
          return; // Signed out: the router shows the sign-in screen and its notice.
        case ReauthenticatedAsDifferentAccount():
          _showMessage(l10n.reauthenticatedAsDifferentAccount);
        case ReauthenticationRequired():
          _showMessage(l10n.errorRecentSignInRequired);
        case ReauthenticationCancelled():
          break;
      }
    } on GoogleSignInUnavailableError {
      if (mounted) _showMessage(l10n.googleSignInUnavailable);
    } on Object catch (error) {
      if (mounted) _showMessage(describeErrorForUser(error, l10n));
    }
    if (mounted) setState(() => _isBusy = false);
  }

  Future<AccountDeletionOutcome> _reauthenticateAndRequestDeletion(
    AccountDeletionService service,
  ) async {
    final method = await _askForReauthenticationMethod();
    switch (method) {
      case _ReauthenticationMethod.google:
        return service.reauthenticateWithGoogleAndRequestDeletion();
      case _ReauthenticationMethod.devAccount:
        final subject = await _askForDevSubject();
        if (subject == null) return const ReauthenticationCancelled();
        return service.reauthenticateWithDevAccountAndRequestDeletion(subject);
      case null:
        return const ReauthenticationCancelled();
    }
  }

  Future<bool?> _askForConfirmation({
    required String title,
    required String body,
    required String confirmLabel,
  }) {
    final l10n = AppLocalizations.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.cancelButton),
          ),
          FilledButton(
            key: const Key('confirm-delete-account'),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
  }

  Future<_ReauthenticationMethod?> _askForReauthenticationMethod() {
    final l10n = AppLocalizations.of(context);
    final config = ref.read(appConfigProvider);
    return showDialog<_ReauthenticationMethod>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.confirmIdentityTitle),
        content: Text(l10n.confirmIdentityBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.cancelButton),
          ),
          if (config.isDevFlavor)
            TextButton(
              key: const Key('reauthenticate-with-dev-account'),
              onPressed: () => Navigator.of(
                dialogContext,
              ).pop(_ReauthenticationMethod.devAccount),
              child: Text(l10n.openDevSignInButton),
            ),
          if (config.isGoogleSignInConfigured)
            FilledButton(
              key: const Key('reauthenticate-with-google'),
              onPressed: () => Navigator.of(
                dialogContext,
              ).pop(_ReauthenticationMethod.google),
              child: Text(l10n.continueWithGoogleButton),
            ),
        ],
      ),
    );
  }

  Future<String?> _askForDevSubject() {
    final l10n = AppLocalizations.of(context);
    final subjectController = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.devSignInTitle),
        content: TextField(
          key: const Key('reauthenticate-dev-subject'),
          controller: subjectController,
          autofocus: true,
          decoration: InputDecoration(labelText: l10n.devSignInSubjectLabel),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.cancelButton),
          ),
          FilledButton(
            key: const Key('reauthenticate-dev-submit'),
            onPressed: () {
              final subject = subjectController.text.trim();
              Navigator.of(dialogContext).pop(subject.isEmpty ? null : subject);
            },
            child: Text(l10n.signInButton),
          ),
        ],
      ),
    ).whenComplete(subjectController.dispose);
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.accountTitle)),
      body: ListView(
        children: [
          ListTile(
            key: const Key('open-profile'),
            leading: const Icon(Icons.badge_outlined),
            title: Text(l10n.profileTitle),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.accountProfile),
          ),
          ListTile(
            key: const Key('open-sessions'),
            leading: const Icon(Icons.devices_outlined),
            title: Text(l10n.sessionsTitle),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(AppRoutes.accountSessions),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: FilledButton.tonal(
              key: const Key('sign-out'),
              onPressed: _isBusy ? null : _signOut,
              child: Text(l10n.signOutButton),
            ),
          ),
          const Divider(),
          ListTile(
            key: const Key('delete-account'),
            enabled: !_isBusy,
            leading: Icon(
              Icons.delete_forever_outlined,
              color: Theme.of(context).colorScheme.error,
            ),
            title: Text(
              l10n.deleteAccountTitle,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            onTap: _confirmAndDeleteAccount,
          ),
        ],
      ),
    );
  }
}
