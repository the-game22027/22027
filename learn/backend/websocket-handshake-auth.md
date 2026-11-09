# Authenticating a WebSocket
> Check the token once, at the handshake, before the connection exists.

**Problem:** a socket stays open for hours and has no per-request headers. Checking each message is wasteful, and letting anyone connect costs memory.

**How:**
- The client sends the token in the Socket.IO handshake `auth` field. Never in the URL: URLs end up in logs.
- Namespace middleware (`namespace.use`) verifies it and stores the user on `socket.data`, or refuses with `connect_error`.
- Nest guards run per message, so they can't refuse the connection. That's why it's middleware.

**In our code:** [socket-authenticator.ts](../../apps/backend/src/modules/auth/presentation/socket-authenticator.ts), [dev-socket.gateway.ts](../../apps/backend/src/modules/auth/presentation/dev-socket.gateway.ts), [ws-auth.e2e-spec.ts](../../apps/backend/test/e2e/ws-auth.e2e-spec.ts).

**Watch out:** the token expires but the socket doesn't. The contract adds `auth:expiring` / `auth:refresh` and a forced disconnect on revocation; those arrive with battles (P6).

**Check yourself:** a user's token is valid at connect. Does that mean every message they send is allowed?
<details><summary>Answer</summary>No. That proves who they are. Each message still needs its own check: are they in this battle, is the round open.</details>
