# Installing, updating and removing GeoAIDesk

GeoAIDesk (GAID) runs from a source checkout on your own computer. This page covers the distribution launcher
(`start-gaid.sh` / `start-gaid.cmd`); `start.sh` / `start.cmd` remain the development launchers (see
[installation.md](../installation.md)). Which operating systems and model routes were actually tested for a release is
in [`geo/compatibility.json`](../../geo/compatibility.json) and [compatibility.md](compatibility.md); anything not
listed there is untested.

## Requirements

| Need | Notes |
|---|---|
| Node.js 22.19 or newer | The launcher refuses Node < 22. |
| Git | On Windows, Git for Windows (the agent's shell is Git Bash). |
| uv | Installed by the launcher when missing (official installer into `~/.local/bin`). |
| Network on first start | npm registry, PyPI, GitHub (release download of the skill catalogue). |
| A model | A local model server, a personal API key, or a supported sign-in; configured inside the app. |

## Install and start

```bash
git clone --branch geo-v<version> https://github.com/kigam-research/geoaidesk.git
cd geoaidesk
./start-gaid.sh            # Windows: start-gaid.cmd
```

Use a published `geo-v<version>` tag; `main` is the development line. The first start installs the backend and UI
packages, builds the UI, prepares the Python helper environment, downloads the pinned skill catalogue and creates
the default project. Later starts reuse what is already installed and built. Open the address the launcher prints
(default http://localhost:3000); Ctrl+C stops the app.

`./start-gaid.sh --check` reports what a start would do (including whether the catalogue would be downloaded) without
installing or starting anything.

## Where your data lives

Everything you create is under the data home, never inside the checkout:

| Path (default `~/.geoaidesk`, or `GAID_HOME`) | Content |
|---|---|
| `projects/` | Projects: files, chats (Pi sessions), notebook, provenance, project skills |
| `pi-agent/` | Model sign-ins, app defaults, user-level skills and prompts |
| `config.env` | API keys and settings saved from Settings |
| `catalogue/` | The downloaded skill catalogue archive |
| `skills-cache/`, `office-assets/` | Caches; safe to delete while the app is stopped |

The launcher refuses a data home inside the checkout, because an update replaces the checkout.

On Windows, a data home whose path contains non-ASCII characters (for example a Korean user name under
`C:\Users\`) works from this release on: Node's native recursive copy/remove helpers terminate the process on such
paths, so the launcher preloads `geo/win-fs-shim.mjs` into every Node process it starts.

## The skill catalogue

`geo/distribution.json` pins one catalogue archive by version and sha256. On start the launcher looks for it in
`GAID_CATALOGUE_ARCHIVE`, `<GAID_HOME>/catalogue/`, `geo/catalogue/` in the checkout and `~/assets/geo-catalogue/<version>/`;
when none has it, it downloads `catalogue.download.url` (a file on this repository's `geo-catalogue-<version>`
release) into `<GAID_HOME>/catalogue/` and keeps it only if the sha256 matches. A failed download does not stop the
app: no catalogue skills are installed and Settings shows where the archive was looked for. Without network access,
download the file elsewhere, place it in `<GAID_HOME>/catalogue/` (or set `GAID_CATALOGUE_ARCHIVE`) and restart.
`GAID_CATALOGUE_URL` points the download at a mirror; `GAID_CATALOGUE_DOWNLOAD=0` turns it off.

The anthropics/skills document skills (`docx`, `pdf`, `pptx`, `xlsx`) are never bundled or fetched automatically, and
automatic catalogue refresh is off.

## Update

1. Stop the app (Ctrl+C).
2. In the checkout: `git fetch --tags` and `git checkout geo-v<new version>`. Keep local changes out of the checkout;
   your work is in the data home.
3. Start again with `./start-gaid.sh`. Changed packages are reinstalled and the UI is rebuilt when needed.

What an update keeps: projects, files, chats and their history, notebook entries and annotations, provenance,
settings, sign-ins and keys. Catalogue skills you have not changed move to the new catalogue version in each project;
a catalogue skill you edited, a skill you installed or authored, and a disabled skill are kept as they are (the
Skills settings show the edited ones). Chats that are already open keep the skill set they started with; new chats
use the updated one.

The app checks this repository's `geo-v*` releases and shows when a newer one exists; it never updates itself.

## Roll back

Stop the app, `git checkout geo-v<previous version>`, start again. Project data written by a newer version is not
guaranteed to be readable by an older one; copy the data home before an update if you may roll back.

## Remove

- **The application:** stop it and delete the checkout directory. Your data stays in the data home.
- **Your data:** delete the data home (`~/.geoaidesk` or your `GAID_HOME`). This removes projects, chats, keys and
  sign-ins and cannot be undone; copy what you want to keep first.
- **Helper tools** the launcher may have installed (uv in `~/.local/bin`) are shared with other software; remove
  them only if nothing else uses them.

## Problems

Report problems at https://github.com/kigam-research/geoaidesk/issues with the launcher output, your OS and the
GAID version shown at start. Do not paste keys or `config.env`.
