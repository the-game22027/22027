import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/describe_error_for_user.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// Where a failed profile save shows its message: under a field, or above the form.
class ProfileFormErrors {
  const ProfileFormErrors({this.displayName, this.username, this.form});

  final String? displayName;
  final String? username;
  final String? form;
}

/// Puts each server error next to the field it is about. The format rules themselves stay on
/// the server (DEC-49 is pending), so the app only maps codes to messages.
ProfileFormErrors assignProfileSaveErrorToFields(
  Object error,
  AppLocalizations l10n,
) {
  if (error is ApiProblemError) {
    final problem = error.problem;
    switch (problem.code) {
      case 'DISPLAY_NAME_INVALID':
        return ProfileFormErrors(displayName: l10n.displayNameInvalid);
      case 'USERNAME_INVALID':
        return ProfileFormErrors(username: l10n.usernameInvalid);
      case 'USERNAME_TAKEN':
        return ProfileFormErrors(username: l10n.usernameTaken);
      case 'VALIDATION_FAILED':
        final invalidFields = problem.errors.map((e) => e.field).toSet();
        if (invalidFields.contains('displayName') ||
            invalidFields.contains('username')) {
          return ProfileFormErrors(
            displayName: invalidFields.contains('displayName')
                ? l10n.fieldValueInvalid
                : null,
            username: invalidFields.contains('username')
                ? l10n.fieldValueInvalid
                : null,
          );
        }
    }
  }
  return ProfileFormErrors(form: describeErrorForUser(error, l10n));
}
