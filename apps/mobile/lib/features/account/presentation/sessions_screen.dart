import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/features/account/application/sign_out.dart';
import 'package:the_game/features/account/data/sessions_repository.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

final _signedInSessionsProvider =
    FutureProvider.autoDispose<List<PlayerSession>>(
      (ref) => ref.watch(sessionsRepositoryProvider).fetchSignedInSessions(),
    );

class SessionsScreen extends ConsumerWidget {
  const SessionsScreen({super.key});

  Future<void> _confirmAndRevoke(
    BuildContext context,
    WidgetRef ref,
    PlayerSession session,
  ) async {
    final l10n = AppLocalizations.of(context);
    final isConfirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.revokeSessionConfirmTitle),
        content: Text(l10n.revokeSessionConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.cancelButton),
          ),
          FilledButton(
            key: const Key('confirm-revoke-session'),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.signOutButton),
          ),
        ],
      ),
    );
    if (isConfirmed != true) return;

    if (session.isThisDevice) {
      // Same as signing out here; the router then leaves the account screens.
      await signOutOfThisDevice(ref);
      return;
    }
    try {
      await ref
          .read(sessionsRepositoryProvider)
          .revokeSessionOnServer(session.id);
    } on AppError catch (error) {
      final wasAlreadySignedOut =
          error is ApiProblemError && error.problem.status == 404;
      // Already signed out elsewhere: the refreshed list shows it is gone.
      if (!wasAlreadySignedOut) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(describeErrorForUser(error, l10n))),
        );
        return;
      }
    }
    ref.invalidate(_signedInSessionsProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final sessions = ref.watch(_signedInSessionsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.sessionsTitle)),
      body: switch (sessions) {
        AsyncData(:final value) => ListView(
          children: [
            for (final session in value)
              ListTile(
                key: Key('session-${session.id}'),
                leading: Icon(
                  session.platform == 'ios'
                      ? Icons.phone_iphone
                      : Icons.phone_android,
                ),
                title: Text(_describeDevice(session, l10n)),
                subtitle: session.lastUsedAt == null
                    ? null
                    : Text(
                        l10n.sessionLastUsed(
                          _formatLocalDateTime(session.lastUsedAt!, context),
                        ),
                      ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (session.isThisDevice)
                      Chip(label: Text(l10n.thisDeviceBadge)),
                    IconButton(
                      key: Key('revoke-session-${session.id}'),
                      tooltip: l10n.revokeSessionTooltip,
                      icon: const Icon(Icons.logout),
                      onPressed: () => _confirmAndRevoke(context, ref, session),
                    ),
                  ],
                ),
              ),
          ],
        ),
        AsyncError(:final error) => Center(
          child: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(describeErrorForUser(error, l10n)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(_signedInSessionsProvider),
                  child: Text(l10n.tryAgainButton),
                ),
              ],
            ),
          ),
        ),
        _ => const Center(child: CircularProgressIndicator()),
      },
    );
  }
}

String _describeDevice(PlayerSession session, AppLocalizations l10n) {
  if (session.deviceName case final name? when name.isNotEmpty) return name;
  return switch (session.platform) {
    'android' => 'Android',
    'ios' => 'iOS',
    'web' => 'Web',
    _ => l10n.unknownDevice,
  };
}

/// The server sends UTC; players read their own time zone, in the app language.
String _formatLocalDateTime(DateTime utc, BuildContext context) {
  final localeCode = Localizations.localeOf(context).languageCode;
  return DateFormat.yMMMd(localeCode).add_jm().format(utc.toLocal());
}
