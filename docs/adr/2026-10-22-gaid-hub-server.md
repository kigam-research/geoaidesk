# ADR 2026-10-22: An institute GAID hub server with accounts; researchers' GAIDs connect to it

Status: accepted 2026-10-22 (gaid-backend). User decision on reports/2026-10-22-gaid-backend §6, verbatim: "2번 다, 4번 나로
하고 나머지는 권장으로 하자." → 1 가 (institute GAID hub server), 2 다 (phase 1 = accounts + shared hub + existing entries +
backup + personal library sync), 3 가 (admin invites, email + password), 4 나 (plain HTTP on the institute network),
5 가 (SQLite). The two confirmations (institute SSO/SMTP/certificates; may PC74 host the pilot) were not answered: treated as
unknown, PC74 is the pilot host. Amends decision 5 of `docs/adr/2026-10-21-research-hub-library.md` (libraries reach the
institute server in phase 1, as a per-account synchronized copy).

## Context

GAID runs per researcher. The shared hub (`server/src/geo/hub-shared/`) stores entries in the running GAID's agent
directory and identifies people by an unchecked display name (`X-GAID-User`); "shared" works only when everybody opens one
GAID, and exposing that GAID on the LAN hands every researcher one token that also drives its agent shell, settings,
credentials and projects. There are no accounts, no remote hub client for stars/comments/registration, no notifications,
and the library owner is "local". Target: at most 50 researchers, usually 10-20, test level, free. Web research
(Oracle Pro, `웹 조사/geoaidesk/2026-10-22-research-question-2026-10-22--a9eaa9446b.md`) found every hosted free tier
large enough for 50 logins; hosted options store names/emails abroad (PIPA art. 28-8 transfer basis, CSAP not confirmed),
pause idle free projects (Supabase, Appwrite 7 days) and lack free backups. The institute network blocks inbound access from
outside and needs permission for port opening/VPNs (user, 2026-09-14). PC74 has no Docker/PostgreSQL and no passwordless sudo.

## Decision

1. **A hub server mode in this repository.** `server/src/geo/hub-server/` is a separate Fastify process (launcher
   `geo/hub-server.mjs`, data under `GAID_HUB_SERVER_HOME`, default `~/.geoaidesk-hub`, refused inside a checkout). It opens
   only accounts, the shared hub records and personal library sync under `/hub/v1/*`. It has no agent, shell, projects,
   model credentials, Zotero keys or web UI, and it refuses browser requests (any `Origin` or `Sec-Fetch-Site` header):
   only researchers' GAID backends call it.
2. **Researchers' GAIDs stay the workspace.** A GAID with a configured hub server (Settings, or `GAID_HUB_SERVER_URL`) logs
   in and keeps the session token in `<agentDir>/hub-server/connection.json` (mode 0600; never sent to the browser). The
   existing `/geo/hub/*` routes and screens keep working: registration still builds the package from the local draft and
   uploads package, pictures and snapshot; installation downloads a pinned revision, checks its hash and runs the existing
   install gate locally. The hub server never writes a researcher's project. Without a hub server the local file store
   stays (development, single PC).
3. **One record interface, three stores.** `HubRecordStore` (`server/src/geo/hub-shared/records.ts`) is what the hub
   routes, "고치기/복사해서 고치기", skill preview and CLI export use: the local file store (`SharedHubStore`), the remote
   client (`server/src/geo/hub-client/`) and, behind `/hub/v1`, the server's SQLite store. Records keep the
   `gaid-hub-entry/v1` shape. People act as an `Actor {id, name}`: account id + display name on a hub server, the display
   name for both in the local store. Ownership compares `entry.authorId ?? entry.author` with `actor.id`; stars are keyed
   by actor id; the server sets author, registeredBy and comment authors from the account, never from the request body.
   An author may append exactly the next revision (earlier snapshots unchanged) and update the entry's metadata and its
   draft link; installs are recorded by anyone through a separate call. Files are write-once per entry path and
   content-checked.
4. **Accounts.** Invite-only. An admin creates an invite (email, role) and passes the one-time code on; the researcher
   sets display name and password in their GAID. Bootstrap: `geo/hub-server.mjs invite --email … --role admin` prints the
   first code. Roles `member` and `admin`. Passwords: scrypt; sessions: random bearer tokens stored as SHA-256, 90-day
   sliding expiry; login attempts rate-limited; account id never changes, display name and email may. Institute SSO later
   adds an identity (issuer + subject) to the same account; no SMTP is needed now.
5. **Transport.** Plain HTTP on the institute network (user decision 4 나). Passwords, tokens, Workflows and synced PDFs
   cross the LAN unencrypted; accepted for the pilot. The client allows `http:` only for this configured hub server.
   Moving to HTTPS later is a configuration change (reverse proxy or certificate), not a data change.
6. **SQLite.** `node:sqlite` (Node >= 22.13; no native dependency, no install). Standard SQL with explicit migrations
   (`schema_migrations`), WAL, foreign keys on; blobs as files under `blobs/<sha256>` referenced from tables. The schema is
   kept portable to PostgreSQL (TEXT ids, ISO-8601 TEXT times, JSON in TEXT columns).
7. **Personal library sync (phase 1).** The server keeps a per-account copy of the library: items, folders and stored
   PDFs, each object with a server version from a per-account counter, deletions as tombstones. The local library stays the
   working copy (agent tools, projects, offline). A sync pulls changes since the last seen version, then pushes local
   changes with their base versions; the server refuses a push whose base is stale (the client pulls again). On a real
   conflict the newer `updatedAt` wins and the replaced local copy is kept under the library's `sync/conflicts/`. Zotero
   items are synced like GAID items; a pulled Zotero item that matches a local one by Zotero library and item key (any
   connection) keeps the pulled id and records the local id as an alias. Zotero connection state (`zotero.json`) and Zotero
   keys stay local. Private material never enters the shared hub (decision 1 of the library ADR holds). Amended during
   implementation: a deletion carries no time, so a deletion on one side and an edit on the other resolve to whichever the
   server recorded first; folders take the server's version on conflict.
8. **Migration and operations.** `geo/hub-server.mjs import-hub --from <shared dir> --authors <map>` moves an existing
   local shared hub (the review instance has 5 entries) into the server; authors are mapped to accounts explicitly, never by
   matching names. `backup --to <dir>` writes a consistent SQLite copy (`VACUUM INTO`) plus the blobs and a manifest with
   hashes; `check-backup <dir>` restores it into a temporary directory and verifies. Every mutation writes an audit row.
   Stars and comments by names that are not mapped stay as "이전 사용자 · <name>" placeholders rather than being attached to
   an account.

## Alternatives considered

- **PocketBase on an institute PC (나).** Fastest start, but the hub rules (registration checks, revisions, edit/copy) would
  be rewritten as PocketBase rules and hooks, it is pre-1.0 (v0.40.5) and SQLite-only with an ETL to PostgreSQL later.
- **Supabase Free, Seoul (다).** Least operations, but limited to publishable Workflows, needs the PIPA transfer basis and
  institute cloud approval, pauses after 7 idle days, has no free backups and a 2-mails/hour default SMTP.
- **One shared GAID on the LAN (status quo).** One token opens the agent shell of that PC to everyone.
- **PostgreSQL now (5 나).** Needs an admin install on PC74; deferred until the hub moves to an institute server.
- **Better Auth / an IdP (Keycloak, authentik).** More than invite + password needs; reconsider when institute SSO is real.
- **Library on the server only (no local copy).** Breaks offline use and the local agent tools; rejected for sync.

## Consequences

- Researchers need the hub server's address and an invite; the hub stops (registration, stars, comments, sync) when the
  host PC is off, while installed Workflows and local research keep working.
- PC74 is the user's workstation (disk 88% used); a lasting service moves to an institute server, which is a copy of the
  data directory.
- Plain HTTP exposes credentials on the LAN; revisit before more than the pilot group uses it.
- Notifications are not part of phase 1.
