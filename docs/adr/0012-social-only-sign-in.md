# ADR-0012: Social sign-in only (Google, Facebook, X); no phone number or OTP

- **Status:** Accepted
- **Date:** 2026-11-08
- **Related:** DEC-26, DEC-48, DEC-07, ADR-0008 (phone part superseded), 04-auth.md, K-01, K-10, K-12

## Context
ADR-0008 planned four sign-in providers: Google, Facebook, X and phone number with an SMS one-time code behind an `SmsSender` port. Phone sign-in is the only provider that costs money per use: every code is a paid SMS, and production needs a paid SMS vendor (DEC-26 was still open for that). It also brings SMS pumping fraud, OTP brute-force controls, number recycling and country allow-lists, all security-sensitive code for a solo developer (K-08). The project has a zero budget, and the owner does not want to pay for SMS at all.

## Decision
Users sign in only with **Google, Facebook or X**. There is no phone number sign-in, no OTP, no `SmsSender` port and no `PHONE` provider. The rest of ADR-0008 stands: in-house verification, `(provider, subject)` identities, no auto-merge by email, short-lived JWT access tokens and rotating refresh tokens.

## Alternatives considered
| Option | Why not |
|---|---|
| Keep phone OTP with a paid SMS vendor | Recurring cost per sign-in; fraud surface (SMS pumping); the owner rejected paying for SMS |
| Firebase phone auth | Still billed beyond a small quota; vendor lock-in (DEC-25) |
| Email magic link or email code instead of phone | Needs an email sending service (free tiers exist but have limits and deliverability work); not requested; can be added later as another provider without schema changes |
| Email + password | Credential stuffing, password reset flows and storage: more security code, worse UX than social sign-in |

## Consequences
+ Zero cost per sign-in in development and production; no SMS vendor decision left.
+ Less security-sensitive code: no OTP storage, attempt counters, SMS pumping controls or number recycling handling.
+ No passwords and no codes: credential stuffing and OTP brute force do not apply.
− A user without a Google, Facebook or X account cannot sign up. Almost every Android user has Google; iOS users are covered once Sign in with Apple is added (DEC-48).
− **App Store guideline 4.8:** an iOS app that offers third-party social sign-in must also offer an equivalent privacy-focused option; Sign in with Apple satisfies it. This blocks the iOS release until DEC-48 is decided (K-12).
− Second accounts are cheaper to create than with a phone number, which matters for the monthly prize (K-10). Mitigations stay free: no points for rooms and bots (DEC-41), prize eligibility checks before awarding, app attestation and device limits later (`06-cross-cutting.md` §1.2).
− Revisit if: abuse of the monthly prize through second accounts becomes measurable, or users ask for a non-social option (then add email sign-in as a new provider, not phone).
