# Installation/update evidence

Run with Node >=22.19, Git and uv. Each `--out` must be fresh and outside a Git checkout. The runner clones the
requested app ref into `out/checkout`; it does **not** start the harness worktree. Every run uses a fresh data home
`out/GAID home 한글` (override its basename with `--data-name`). No real credentials or user projects are copied.

```sh
node geo/release-proof/install-proof.mjs --repo /path/to/git/repo --ref <candidate-sha> --out /external/fresh/install --catalogue-archive /assets/geo-catalogue-0.2.1.tar.gz
node geo/release-proof/update-proof.mjs --repo /path/to/git/repo --ref <candidate-sha> --base-ref 882cd56 --out /external/fresh/update --base-catalogue-archive /assets/geo-catalogue-0.2.0.tar.gz --catalogue-archive /assets/geo-catalogue-0.2.1.tar.gz
```

For install-only source archives use `--archive /path/to/git-archive.tar` instead of `--repo`; the archive must have
repository files at its root (no prefix directory). `--ref` then records the claimed source ref, not a verified Git
commit. For launcher downloads use `--catalogue-url file:///path/to/archive.tar.gz` instead of an archive override;
the launcher's existing asset lookup can still win over a URL. Inspect the launcher log to distinguish a true download.
Use `--host <label>` and `--setup <text>` for host identification/setup. Default output is `TASK_OUTPUT_DIR` in a task
job, otherwise `~/data/geoaidesk/work/gaid-release-proof/<kind>-<timestamp>`.

The install proof checks production HTML/build, backend health, pinned catalogue and project skill presence. It
prepares non-optional project environments using the real environment API (the backend's catalogue-owned import
probe), generates tiny independent fixtures through uv, uploads them through the real upload route, and checks:

- LAS depths 100/101/102 and gamma values 10/NULL/30;
- 4x2 categorical raster values including nodata;
- two projected polygon features and 10,000 m² per class, 20,000 m² full-layer area;
- CSV and TSV rows with known overlapping and invalid intervals.

After stopping it reuses the same ports (the frontend inlines its backend URL), verifies build reuse and repeats all
API checks. This is API/served-HTML evidence, **not** a browser interaction or visual-layout test.

The update proof installs the base, creates a second project via the API, uploads a file (including user provenance),
edits one catalogue skill, authors one user skill, disables another catalogue skill, sets a spend limit and edits
AGENTS.md. History is explicitly synthetic: the base's installed Pi `SessionManager.appendMessage` serializes a
user text block offline; no model is invoked. Notebook notes are created via the API. Both before and after the
in-place `git fetch`/`git checkout`, each state item is separately checked through the API; the untouched skill is
compared to bytes in the **current pin's** verified staging directory, not the old pin's cache.

`record.json` is `gaid-install-evidence/v1`, updated after every completed step; failed dependencies stay `not-run`.
Logs are beside the record with SHA-256. Exit 0 means all declared steps passed; 1 means failed or partial. Failed
records must be retained; reruns require new output directories. macOS or other absent hosts are not implied tested.
The Windows invocation uses the exact Node launcher target wrapped by `start-gaid.cmd`.
