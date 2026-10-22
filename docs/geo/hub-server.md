# Institute GAID hub server

The hub server is a separate process for accounts, shared Workflow records and per-account library sync. Researchers
continue to run their own GAID workspace. The hub has no agent, shell, project filesystem, model credentials, Zotero
connection keys or web UI. Its only API is `/hub/v1`; any request carrying `Origin` or `Sec-Fetch-Site` is refused.
Configure the hub address in each researcher's GAID, not in the browser address bar.

The design is recorded in `docs/adr/2026-10-22-gaid-hub-server.md`. Plain HTTP on the institute LAN is the accepted
pilot setting. Passwords, session tokens, Workflows and synchronized PDFs travel unencrypted. Before expanding beyond the pilot,
review that choice. HTTPS can be added with a reverse proxy without converting the stored data.

## Install and create the first admin

Use Node >= 22.19 and the same pinned GAID checkout on the hub PC. There is no extra database dependency: Node supplies
SQLite. From the checkout:

```bash
npm ci --prefix server
node geo/hub-server.mjs --help
node geo/hub-server.mjs invite --email admin@example.org --role admin
```

The invite command prints the email, role, one-time `code` and `expiresAt`. Pass the code to the intended administrator.
The administrator enters it in their own GAID and sets a display name and password. No SMTP service is used. Codes expire
after seven days and cannot be accepted twice. The default invite role is `member`; the first invite must explicitly use
`--role admin`. The local operator can create further invites if recovery is needed.

All commands accept `--home DIR`. Otherwise `GAID_HUB_SERVER_HOME` applies, with `~/.geoaidesk-hub` as the default. Use an
absolute path outside every Git checkout. The check follows symlinks. For a test instance, use a separate home, for example:

```bash
node geo/hub-server.mjs invite --home /home/operator/data/geoaidesk/work/pilot/hub \
  --email admin@example.org --role admin
```

Keep using that same home for the following commands. Do not point this process at the researcher's GAID home.

## Serve

```bash
node geo/hub-server.mjs serve --host 0.0.0.0 --port 8700
```

The command prints candidate LAN URLs to enter in GAID Settings. The default bind address and port are `0.0.0.0:8700`;
`--host 127.0.0.1` is useful for a local test. A backend-only health request is:

```bash
curl http://127.0.0.1:8700/hub/v1/health
```

Health returns the schema, GAID version and persistent `serverId`. Closing the process with SIGINT or SIGTERM closes the
server and database. For a lasting service, use the host's service manager and a pinned checkout under `~/deploy/geoaidesk`.
Run it as the account that owns the home. Keep logs private and never add passwords, invite codes or bearer tokens to logs.
The server does not log request bodies or authorization headers.

The home contains:

| Path | Contents |
| --- | --- |
| `server.json` | Persistent server identity and creation time |
| `hub.sqlite` | Accounts, hashed passwords/tokens/invites, records, audit events and library versions |
| `hub.sqlite-wal`, `hub.sqlite-shm` | Live SQLite WAL files; do not copy the database alone while running |
| `blobs/<sha256>` | Content-checked Workflow archives, pictures and library PDFs |

SQLite uses WAL, foreign keys, a busy timeout and numbered migrations. Database/file operations commit audit events with
their mutations. Blob publication precedes its database reference. A failed import can leave an unreferenced blob; backup
includes only referenced blobs. There is no automatic blob deletion in phase 1.

## Accounts

```bash
node geo/hub-server.mjs users
node geo/hub-server.mjs invite --email researcher@example.org --role member
```

Admins can also invite people, revoke unused invites, list users and change role or disabled state through their GAID.
The last enabled admin cannot be demoted or disabled. Disabled accounts cannot log in and their existing sessions end.
A password change requires the current password and ends other sessions. Sessions slide for 90 days, with a database touch
at most once a minute. Passwords use scrypt with per-password salts. Ten failed logins per email or source IP within 15
minutes block further attempts until failures age out; this counter survives restarts. Shared source IPs share that limit.

Display names have 1 to 40 characters and passwords 10 to 200 characters. Email addresses are normalized to lowercase. Author,
revision registrar and comment identity come from the authenticated account, not display-name headers. Other researchers
and admins can read shared entries, star, comment and record installs. Only the author can update an entry or its files.
Existing revisions are immutable. A registration can append one next revision; a draft-link/metadata edit can leave the
revision unchanged. Every referenced package and light/dark picture must already be stored. Retrying identical file bytes
is allowed; overwriting an entry file with different bytes is refused.

## Personal library sync

Library objects and stored PDFs are scoped to the authenticated account. Admins have no API to read another account's
library. This does not restrict a machine operator who can read the database or backups; protect both as private research
data. Zotero connection state and credentials stay in the researcher's GAID.

Objects use a per-account increasing version. A push must name the last server version of each object (`baseVersion`,
zero for a new object). A mismatch returns `stale`; a missing stored PDF returns `missing-file`. Upload the PDF, then retry
the item. Deletions are tombstones and remain in subsequent full pulls. The client handles merging and retained conflict
copies; the server does not choose between conflicting research content.

File limits are 20 MiB for a Workflow archive/picture and 64 MiB for a library PDF. Library files must begin with `%PDF-`
and match their SHA-256. Standard JSON requests are limited to 64 KiB, login/accept-invite to 16 KiB, and record/library
change requests to 4 MiB. A library batch contains at most 500 changes. A batch may apply some objects and return conflicts
for others; malformed batches roll back. The library is a synchronized copy, not a replacement for the local working copy.

## Backup and verify

Choose a new or empty destination outside the live home:

```bash
node geo/hub-server.mjs backup --to /srv/gaid-backups/2026-10-22
node geo/hub-server.mjs check-backup /srv/gaid-backups/2026-10-22
```

`backup` can run while the hub serves requests. It uses `VACUUM INTO` to snapshot committed database state, then copies
exactly the immutable blobs referenced by that snapshot, plus `server.json`. `manifest.json` records every copied file's
SHA-256 and size, the server identity and table row counts. Nonempty destinations are refused. Protect backups like the
live data: they include account/session hashes and private PDFs. Copy a verified backup to separate storage using the
institute's existing backup process.

`check-backup` copies the listed files into a temporary sibling directory, checks hashes, opens the restored database,
checks SQLite integrity and foreign keys, checks row counts and verifies every referenced blob. It prints a JSON summary
only after these checks pass and removes the temporary restore. The backup directory remains unchanged. An unsuccessful
check exits nonzero. These checks verify the backup files, not the scientific content of the stored Workflows or PDFs.

## Import an existing local hub

Create the destination accounts first. Prepare a JSON file mapping every entry author and revision registrar's old display
name to an existing account email. The mapping is explicit; names are never matched automatically:

```json
{
  "김 연구원": "kim@example.org",
  "박 연구원": "park@example.org"
}
```

The source is the local shared-store directory containing `folders.json` and `entries/`, usually the researcher's agent
directory followed by `skill-hub/shared`. Inspect the source location in that GAID's configuration. Do not pass the entire
GAID home. The import reads the source without initializing or writing it:

```bash
node geo/hub-server.mjs import-hub --from /srv/old-agent/skill-hub/shared --authors /srv/import/authors.json
node geo/hub-server.mjs import-hub --from /srv/old-agent/skill-hub/shared --authors /srv/import/authors.json --apply
```

The first command is a dry-run. It validates the real record rules and rolls back database changes without publishing
blobs. The result reports source entry/file/comment/star counts. `--apply` imports all entries in one transaction, with
original revision times, packages, light/dark pictures, folders, comments, stars and install records. Unmapped authors
stop the import. If intentionally assigning all remaining authors to one account, add `--unmapped-to EMAIL` explicitly.
Unmapped comment/star names receive stable `legacy-…` identities and comments display `이전 사용자 · <old name>`.

Repeating an applied import from the same source path and unchanged bytes skips existing imports. Changed source records
or colliding destination entry ids are refused. The server keeps source digests in its import ledger. Do not modify the
source between dry-run and apply. After importing, inspect entries and authors in GAID, run a backup and check that backup.

## Move to another PC or recover

1. Make and verify a fresh backup. Stop the old server before the final backup when switching PCs, so later writes cannot
   be left behind.
2. Install the same pinned GAID revision and Node version on the new PC. Copy the verified backup into an otherwise empty
   data home outside a Git checkout. Keep `server.json`, `hub.sqlite` and `blobs/` together. `manifest.json` may stay there.
3. Run `check-backup` on the copied backup before serving it. Protect the directory so only the service account can read
   it. Start `serve --home <new home>` and check health.
4. Change the hub URL in researchers' GAIDs if the address changed. The retained `serverId` identifies the same hub and the
   existing account/library versions remain usable. Existing unexpired sessions continue to work after a backup restore.

Restoring an older backup discards changes made after its snapshot. If researchers synchronized after that snapshot, use
fresh client sync state or preserve/export those local changes before reconnecting; server versions may have moved back.
Do not replace a live home's files. Stop its server first and retain the old home until the restored instance is checked.
