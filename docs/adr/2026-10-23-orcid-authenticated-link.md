# ORCID authenticated iD: hub server holds the client, the researcher's GAID receives the redirect

Date: 2026-10-23 · Task: gaid-orcid (phase 2) · Status: accepted

## Context

Phase 1 (2026-10-22) lets a researcher type an ORCID iD, shown as unauthenticated. The user asked to link an
*authenticated* iD to the researcher's GAID hub account and show it on hub entries. User decisions 2026-10-22: phase 2
after the user registers an ORCID public API client with the user's own ORCID account; the client secret is stored only
server-side.

ORCID facts (checked 2026-10-22/23): the OAuth/OIDC token exchange needs `client_secret` (`client_secret_post`, no PKCE
advertised); public API credentials belong to one person and must not be shared or put in client-side code; production
redirect URIs are documented as HTTPS-only, sandbox accepts HTTP. The researcher's GAID runs at `http://127.0.0.1:8000`;
the hub server is a non-browser API on the institute LAN (it refuses requests with `Origin`/`Sec-Fetch-*`).

## Decision

- The hub server holds the ORCID client (`<GAID_HUB_SERVER_HOME>/orcid-client.json`, mode 600, written by the operator with
  `node geo/hub-server.mjs orcid-client set`, secret read from standard input; never in Git, backups or responses).
- Authorization code flow with `scope=openid`. The hub creates a single-use `state` + `nonce` bound to the calling account
  (10 minutes), returns the authorize URL; the researcher's browser goes to ORCID and comes back to the registered redirect
  URI on the researcher's own GAID backend (`/geo/orcid/callback`), which forwards `code` + `state` with its hub session.
  The hub checks that the state belongs to the same account, exchanges the code, verifies the ID token (RS256 against
  ORCID's JWKS, `iss`, `aud`, `exp`, `nonce`, `sub` = token `orcid`) and records the iD on the account (one account per
  iD).
- Hub accounts carry `orcid`; hub entries carry the author's current authenticated iD (`authorOrcid`, joined at read time,
  so linking later shows on older entries). The researcher's GAID marks its local profile authenticated with that iD.

## Alternatives

- Secret on every researcher's GAID: shares one person's credentials with every user, against the Public API terms.
- Redirect to the hub server: the hub serves no browser requests by design, and production would need HTTPS on the hub
  first (docs/geo/hub-server-https.md).
- Implicit flow (ID token in the URL fragment, no secret): ORCID supports it, but tokens pass through the browser and the
  backend cannot read a fragment without an extra page; kept as a fallback only if the code flow is blocked.

## Consequences

- Authentication needs a hub server account and a configured hub; without them phase 1 (unauthenticated iD) still works.
- The registered redirect URI fixes the GAID backend address (`http://127.0.0.1:8000/geo/orcid/callback`); a GAID on another
  port cannot authenticate until that URI is registered too.
- Whether ORCID production accepts the loopback HTTP redirect is unverified; if it does not, production needs an HTTPS
  redirect target and this ADR is revisited. Sandbox is the test environment until then.
