import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/core/widgets/app_bar_shortcuts.dart';
import 'package:the_game/features/account/application/dev_sign_in_controller.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// Dev flavor only: signs in through `POST /v1/_dev/auth/sign-in` until Google sign-in (M1).
class DevSignInScreen extends ConsumerStatefulWidget {
  const DevSignInScreen({super.key});

  @override
  ConsumerState<DevSignInScreen> createState() => _DevSignInScreenState();
}

class _DevSignInScreenState extends ConsumerState<DevSignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _displayNameController = TextEditingController();

  @override
  void dispose() {
    _subjectController.dispose();
    _displayNameController.dispose();
    super.dispose();
  }

  Future<void> _submitSignIn() async {
    if (!_formKey.currentState!.validate()) return;
    final displayName = _displayNameController.text.trim();
    await ref
        .read(devSignInControllerProvider.notifier)
        .signIn(
          subject: _subjectController.text.trim(),
          displayName: displayName.isEmpty ? null : displayName,
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final signInState = ref.watch(devSignInControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.devSignInTitle),
        actions: buildAppBarShortcuts(context),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(l10n.devSignInExplanation),
                const SizedBox(height: 24),
                TextFormField(
                  key: const Key('dev-sign-in-subject'),
                  controller: _subjectController,
                  decoration: InputDecoration(
                    labelText: l10n.devSignInSubjectLabel,
                    helperText: l10n.devSignInSubjectHelper,
                  ),
                  textInputAction: TextInputAction.next,
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? l10n.fieldRequiredMessage
                      : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('dev-sign-in-display-name'),
                  controller: _displayNameController,
                  decoration: InputDecoration(
                    labelText: l10n.devSignInDisplayNameLabel,
                  ),
                  onFieldSubmitted: (_) => _submitSignIn(),
                ),
                const SizedBox(height: 24),
                if (signInState case AsyncError(:final error))
                  Padding(
                    padding: const EdgeInsetsDirectional.only(bottom: 16),
                    child: Text(
                      describeErrorForUser(error, l10n),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                FilledButton(
                  onPressed: signInState.isLoading ? null : _submitSignIn,
                  child: signInState.isLoading
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.signInButton),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
