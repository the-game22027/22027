/// Route paths, shared so features can navigate without importing each other.
abstract final class AppRoutes {
  static const splash = '/splash';
  static const signIn = '/sign-in';

  /// Registered only in the dev flavor.
  static const devSignIn = '/dev-sign-in';
  static const home = '/home';
  static const serverStatus = '/server-status';
  static const settings = '/settings';
}
