# apps/mobile

Flutter app for the football prediction & trivia game (A-09; ADR-0011, ADR-0014). Android and iOS.

Decided in ADR-0014:
- Flutter latest stable, pinned with `fvm` (committed `.fvmrc`);
- Riverpod for state and dependency injection, go_router for navigation;
- application id deferred (DEC-52): placeholder `com.example.thegame`, `.dev` suffix for the dev flavor.

## Setup

```bash
dart pub global activate fvm           # once per machine
cd apps/mobile
fvm install                            # installs the version in .fvmrc
fvm flutter pub get                    # also generates lib/l10n/generated
```

## Run against the local backend

The backend runs from the backend worktree (`npm run start:api:dev`, port 3000). Do not start a second one from here.

```bash
# Android emulator or USB device: make the phone's localhost:3000 reach this machine's port 3000
adb reverse tcp:3000 tcp:3000
fvm flutter run --flavor dev --dart-define-from-file=config/dev.json
```

Without `adb reverse`, an Android emulator reaches the host at `10.0.2.2`: copy `config/dev.json` to an untracked file with `"apiBaseUrl": "http://10.0.2.2:3000"` and pass that file instead. Cleartext HTTP is allowed only in the dev flavor (`android/app/src/dev/AndroidManifest.xml`).

Check the connection on the **Server status** screen (icon in the app bar): it calls `GET /health/ready`. Then, on the sign-in screen, open **Dev sign-in** and use any subject (for example `alice`). **Continue with Google** needs the setup below.

## Flavors and config

| Flavor | Android id | App label | Config | Sign-in |
|---|---|---|---|---|
| `dev` | `com.example.thegame.dev` | The Game (dev) | `config/dev.json` (`http://localhost:3000`) | Google, plus dev sign-in (`POST /v1/_dev/auth/sign-in`) |
| `prod` | `com.example.thegame` | The Game | `config/prod.json` (placeholder URL) | Google |

- Config is passed with `--dart-define-from-file`; `AppConfig` validates it at startup and stops the app if a value is missing. Config files hold only URLs, flags and public client ids, never secrets.
- `googleServerClientId` is empty in the committed files, so the Google button is disabled. Put your web client id in a local, uncommitted copy of the config file (see below).
- `--flavor` (Android) and the `flavor` value in the define file must match; `main.dart` checks it.
- iOS: no separate schemes yet (they cannot be verified without macOS). Run iOS with only `--dart-define-from-file=config/<flavor>.json`; the bundle id is `com.example.thegame` for both.

## Google sign-in setup

Free, about 20 minutes, done once by the project owner in [Google Cloud Console](https://console.cloud.google.com/). No Firebase.

1. Create a project, then **APIs & Services → OAuth consent screen**: user type External, publishing status **Testing**, and add your Google accounts as test users.
2. **Credentials → Create credentials → OAuth client ID → Web application**. Its client id (`…apps.googleusercontent.com`) is the `googleServerClientId`: Google puts it in the ID token's `aud`.
3. **Create credentials → OAuth client ID → Android**, once per flavor: package `com.example.thegame.dev` and `com.example.thegame`, with the SHA-1 of the signing key. For debug builds:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA1
   ```
   The app never sends this client id; Google matches it by package name and SHA-1. If Google Cloud refuses the `com.example.*` placeholder, the application id (DEC-52) has to be decided first.
4. App: copy `config/dev.json` to `config/dev.local.json` (git-ignored), set `"googleServerClientId"` to the **web** client id, and run with `--dart-define-from-file=config/dev.local.json`.
5. Backend (in the backend worktree's `.env`, not here): `GOOGLE_CLIENT_IDS` must contain the same web client id, or the backend answers `401 PROVIDER_TOKEN_INVALID`.
6. The emulator needs a Google account: use a system image **with Google Play** and sign in on the device.

## Code layout

```
lib/
├── main.dart              # reads config, sets up ProviderScope overrides
├── app/                   # root widget, router (with the session guard), theme
├── core/                  # shared plumbing: config, network, errors, session, storage, l10n, routing
├── features/<feature>/
│   ├── data/              # the only layer that calls the generated REST client
│   ├── application/       # Riverpod providers / controllers
│   └── presentation/      # screens and widgets
└── l10n/                  # app_en.arb, app_ar.arb (+ generated/, not committed)
packages/api_client/       # generated REST client (never edit by hand)
openapi/openapi.json       # snapshot of the backend contract
```

**Rule:** a feature imports `core/` and `packages/api_client`, never another feature. Only `app/` (the router) knows every feature. If two features need the same thing, it moves to `core/`.

## How it talks to the backend

| Channel | Source of truth | In the app |
|---|---|---|
| REST | `docs/api/API.md` → backend OpenAPI (`/docs-json`), snapshotted in `openapi/openapi.json` | Generated Dart client in `packages/api_client`; regenerate on contract change, never edit by hand |
| WebSocket (`/battles`) | `docs/api/WEBSOCKET.md` | Hand-written Dart message types + `socket_io_client` (M3) |

Every request carries `Accept-Language` (app language), a fresh `X-Request-Id`, and, on routes the contract marks as secured, `Authorization: Bearer <accessToken>`. A `401` on a secured route triggers **one** token refresh (`POST /v1/auth/refresh`, rotation); requests that failed with an older token retry with the new one instead of refreshing again. Only a refused refresh (`400`/`401`/`403`) signs the player out; no network, `429` or `5xx` keeps the session (ADR-0017). Errors are parsed from problem+json and shown by their `code` (`describeErrorForUser`).

Rules that matter for the client: the server is authoritative for every timer and score. Use `serverTime` for countdowns, never decide correctness or lock state locally, and show bots as bots (DEC-40).

## Updating the REST client

```bash
tool/update_openapi.sh          # needs the backend running; rewrites openapi/openapi.json
tool/generate_api_client.sh     # needs Docker; regenerates packages/api_client
```

Commit the snapshot and the generated code together. Running the generator twice gives no diff.

## Checks

```bash
dart format lib test            # generated code is excluded
fvm flutter analyze
fvm flutter test
fvm flutter build apk --flavor dev --debug --dart-define-from-file=config/dev.json
```
