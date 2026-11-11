import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

/// App bar buttons to the screens reachable whether signed in or not.
List<Widget> buildAppBarShortcuts(BuildContext context) {
  final l10n = AppLocalizations.of(context);
  return [
    IconButton(
      tooltip: l10n.serverStatusTitle,
      icon: const Icon(Icons.dns_outlined),
      onPressed: () => context.push(AppRoutes.serverStatus),
    ),
    IconButton(
      tooltip: l10n.settingsTitle,
      icon: const Icon(Icons.settings_outlined),
      onPressed: () => context.push(AppRoutes.settings),
    ),
  ];
}
