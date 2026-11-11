# go_router redirect guard
> One function decides, for every navigation, whether the player may see the requested screen or must go elsewhere.

**Problem:** checking "am I signed in?" inside each screen is easy to forget, and a deep link or the back button can still reach a protected screen.

**How:**
- `GoRouter(redirect: ...)` runs before every navigation and returns a new location, or `null` to stay.
- Our rule is a pure function, `findRedirectForSession(session, location, isDevFlavor)`, so it is unit-tested without widgets: restoring → splash, signed out → sign-in, signed in → away from sign-in and splash.
- `refreshListenable` re-runs the guard whenever the session changes, so sign-in, sign-out and a `401` move the player without any screen calling `context.go`.
- Routes can be conditional: `/dev-sign-in` is only registered in the dev flavor, so the prod app has no way to reach it.

**In our code:** [router.dart](../../apps/mobile/lib/app/router.dart), [router_test.dart](../../apps/mobile/test/app/router_test.dart).

**Watch out:**
- A guard that redirects A → B → A loops forever. Every branch must return `null` for its own target.
- Public screens (server status, settings) are allowed first, before any session check.

**Check yourself:** a `401` arrives while the player is on the home screen. Which code moves them to sign-in?
<details><summary>Answer</summary>None directly. The auth interceptor ends the session; the session change fires `refreshListenable`; the router re-runs the guard, which now returns the sign-in route.</details>
