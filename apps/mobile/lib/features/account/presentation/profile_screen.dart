import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/features/account/application/profile_form_errors.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

final _accountProfileProvider =
    FutureProvider.autoDispose<PlayerAccountProfile>(
      (ref) => ref.watch(profileRepositoryProvider).fetchPlayerAccountProfile(),
    );

/// Display name and username. The language lives in Settings and is synced to the profile
/// (DEC-62), so it is not edited twice.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final profile = ref.watch(_accountProfileProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: switch (profile) {
        AsyncData(:final value) => _ProfileForm(profile: value),
        AsyncError(:final error) => Center(
          child: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(describeErrorForUser(error, l10n)),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () => ref.invalidate(_accountProfileProvider),
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

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({required this.profile});

  final PlayerAccountProfile profile;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late final _displayNameController = TextEditingController(
    text: widget.profile.displayName,
  );
  late final _usernameController = TextEditingController(
    text: widget.profile.username ?? '',
  );
  bool _isSaving = false;
  ProfileFormErrors _errors = const ProfileFormErrors();

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _saveChangedFields() async {
    if (!_formKey.currentState!.validate()) return;
    final displayName = _displayNameController.text.trim();
    final username = _usernameController.text.trim();
    final hasNewDisplayName = displayName != widget.profile.displayName;
    final hasNewUsername = username != (widget.profile.username ?? '');
    if (!hasNewDisplayName && !hasNewUsername) {
      context.pop();
      return;
    }

    setState(() {
      _isSaving = true;
      _errors = const ProfileFormErrors();
    });
    try {
      await ref
          .read(profileRepositoryProvider)
          .updatePlayerAccountProfile(
            displayName: hasNewDisplayName ? displayName : null,
            username: hasNewUsername && username.isNotEmpty ? username : null,
            removeUsername: hasNewUsername && username.isEmpty,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).profileSaved)),
      );
      context.pop();
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _errors = assignProfileSaveErrorToFields(
          error,
          AppLocalizations.of(context),
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_errors.form case final formError?)
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: 16),
                child: Text(
                  formError,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            TextFormField(
              key: const Key('profile-display-name'),
              controller: _displayNameController,
              decoration: InputDecoration(
                labelText: l10n.displayNameLabel,
                errorText: _errors.displayName,
              ),
              validator: (value) => (value ?? '').trim().isEmpty
                  ? l10n.fieldRequiredMessage
                  : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              key: const Key('profile-username'),
              controller: _usernameController,
              decoration: InputDecoration(
                labelText: l10n.usernameLabel,
                helperText: l10n.usernameHelper,
                errorText: _errors.username,
              ),
            ),
            const SizedBox(height: 24),
            FilledButton(
              key: const Key('profile-save'),
              onPressed: _isSaving ? null : _saveChangedFields,
              child: Text(l10n.saveButton),
            ),
          ],
        ),
      ),
    );
  }
}
