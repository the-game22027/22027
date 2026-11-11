# mobile/

Flutter cards, written while building the app (`apps/mobile`). Start with M0:

- [generated-rest-client](generated-rest-client.md): the Dart client is generated from the backend's OpenAPI document
- [secure-token-storage](secure-token-storage.md): tokens in the platform keystore, not in preferences
- [riverpod-providers-as-di](riverpod-providers-as-di.md): providers build dependencies; tests override them
- [go-router-redirect-guard](go-router-redirect-guard.md): one function decides who may see which screen
- [rtl-and-localization](rtl-and-localization.md): ARB strings and right-to-left layouts

Coming later: Socket.IO client and reconnection (M3), state for live battles, store release.
