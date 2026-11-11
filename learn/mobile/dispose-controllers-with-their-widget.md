# Dispose controllers with their widget
> A `TextEditingController` lives as long as the widget that shows it: create it in a `State`, dispose it in that `State.dispose()`.

**Problem:** `showDialog` returns a future that completes when the dialog is **popped**, not when it is gone. The closing animation still builds the dialog for a few frames. Disposing the controller in `.whenComplete(controller.dispose)` makes those frames use a dead controller: "A TextEditingController was used after being disposed", then `'_dependents.isEmpty': is not true` and a red screen.

**How:**
- Put the dialog in its own `StatefulWidget`; the controller is a field of its `State`.
- `State.dispose()` runs when the element leaves the tree, after the animation, so it is always the right moment.
- The caller just awaits `showDialog(builder: (_) => const MyDialog())` for the result.

**In our code:** `_DevSubjectDialog` in [account_screen.dart](../../apps/mobile/lib/features/account/presentation/account_screen.dart); the regression tests at the end of [account_deletion_test.dart](../../apps/mobile/test/features/account/account_deletion_test.dart) close it by tapping outside and by submitting.

**Watch out:**
- Tests pass with this bug unless they close the dialog and `pumpAndSettle()`: the crash happens during the exit animation.
- The same rule holds for `AnimationController`, `ScrollController`, `FocusNode`: the owner disposes, in `dispose()`.

**Check yourself:** why did the bug show up on the emulator when Escape closed the dialog, but no test caught it before?
<details><summary>Answer</summary>No test ever closed that dialog and let the animation run. Any close (Escape, tap outside, Cancel, submit) completes the future first and animates after, so every path crashed; the earlier tests used the dev re-authentication service directly, not the dialog.</details>
