import 'package:flutter/material.dart';

/// Plain Material 3. The visual design comes later; do not add custom styling here yet.
ThemeData buildAppTheme(Brightness brightness) => ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: Colors.green,
    brightness: brightness,
  ),
);
