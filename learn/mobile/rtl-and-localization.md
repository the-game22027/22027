# RTL and localization
> Every visible string comes from a translation file, and layouts flip automatically for right-to-left languages.

**Problem:** a hard-coded `'Sign in'` stays English in Arabic. `EdgeInsets.only(left: 16)` stays on the left, so an Arabic screen looks mirrored the wrong way.

**How:**
- Strings live in `lib/l10n/app_en.arb` and `app_ar.arb`. `flutter gen-l10n` generates `AppLocalizations` with one typed getter per key (`l10n.signInButton`), so a missing key fails at compile time.
- `MaterialApp(locale: ...)` sets the language; for `ar` Flutter sets `Directionality` to RTL for the whole tree.
- Use directional widgets: `EdgeInsetsDirectional` (`start`/`end` instead of `left`/`right`), `AlignmentDirectional`. They follow the current direction.
- The chosen language is saved in `shared_preferences` and also sent as `Accept-Language`, so the backend answers in the same language.

**In our code:** [app_en.arb](../../apps/mobile/lib/l10n/app_en.arb), [app_ar.arb](../../apps/mobile/lib/l10n/app_ar.arb), [app_language_controller.dart](../../apps/mobile/lib/core/l10n/app_language_controller.dart), [right_to_left_test.dart](../../apps/mobile/test/app/right_to_left_test.dart).

**Watch out:**
- Placeholders (`Hello, {displayName}`) keep word order correct per language; never build sentences by concatenating strings.
- The server's `detail` is English for developers. Show messages chosen by the error `code` instead.

**Check yourself:** an icon arrow points "forward". What happens to it in Arabic?
<details><summary>Answer</summary>Directional icons like `Icons.arrow_forward` are mirrored automatically in RTL. A custom image is not, unless you wrap it or use `matchTextDirection: true`.</details>
