# ADR-0008: In-house provider verification, short-lived JWT access tokens, rotating opaque refresh tokens

- **Status:** Proposed; the phone OTP part is superseded by ADR-0012 (no phone sign-in)
- **Date:** 2026-11-07
- **Related:** DEC-25, DEC-26, 04-auth.md

## Context
Four providers (Google, Facebook, X, phone), native mobile clients, zero budget, WebSocket authentication, and account takeover risks.

## Decision
Verify provider credentials in the backend (Google ID token, Facebook token/OIDC token, X OAuth2 PKCE code exchange, phone OTP via an `SmsSender` port). Map identities `(provider, subject)` to one internal user; never auto-merge by email. Issue 15-minute asymmetric-signed JWT access tokens and opaque refresh tokens stored hashed, rotated on every use with reuse detection by family.

## Alternatives considered
| Option | Why not (for now) |
|---|---|
| Firebase Auth broker | Vendor lock-in; phone costs; viable fallback (DEC-25) |
| Long-lived JWTs without refresh | Cannot revoke |
| Server-side sessions only (cookie) | Awkward for native apps and WebSockets |

## Consequences
+ Revocable sessions, device list, stateless REST auth, same token for WS.
− Security-sensitive code we own; must be well tested.
