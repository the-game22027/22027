# mobile/

Flutter cards, written while building the app (`apps/mobile`). Start with M0:

- [generated-rest-client](generated-rest-client.md): the Dart client is generated from the backend's OpenAPI document
- [secure-token-storage](secure-token-storage.md): tokens in the platform keystore, not in preferences
- [riverpod-providers-as-di](riverpod-providers-as-di.md): providers build dependencies; tests override them
- [go-router-redirect-guard](go-router-redirect-guard.md): one function decides who may see which screen
- [rtl-and-localization](rtl-and-localization.md): ARB strings and right-to-left layouts

M1:

- [refresh-token-rotation-on-the-client](refresh-token-rotation-on-the-client.md): one refresh for parallel `401`s
- [google-id-token-sign-in](google-id-token-sign-in.md): Google ID token, `serverClientId`, `aud`
- [reauthentication-before-sensitive-actions](reauthentication-before-sensitive-actions.md): confirm it is you, and the different-account trap
- [dispose-controllers-with-their-widget](dispose-controllers-with-their-widget.md): a dialog's text controller dies with its `State`, not with `showDialog`'s future

M1.5 (data layer):

- [etag-conditional-download](etag-conditional-download.md): `If-None-Match` and `304` for the answer catalog
- [riverpod-paused-providers](riverpod-paused-providers.md): no listener, no retry
- [server-clock-offset](server-clock-offset.md): countdowns in server time from `time:sync`
- [sequenced-events-and-resync](sequenced-events-and-resync.md): apply battle events by `seq`; a gap asks for a snapshot

Coming later: Socket.IO client and reconnection (M3), state for live battles, store release.
