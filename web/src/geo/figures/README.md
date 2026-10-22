# Research-note figure inspector

Import `NoteFigures` from `@/geo/figures`. Mount it inside the selected note detail; pass `projectId`, `noteId`,
`onOpenFile(path)` and optionally `onOpenChat(sessionId, title)` and `onPrefill(text, options)`.
The latter receives `{ send: false }` and defaults to `prefillChat`. The parent may focus a chat before dispatching it.
No redraw action auto-sends a message or runs a tool. Remount after an agent run if the selected note's figures changed.

The component supplies its own container query at 960 px for the 38:62 list/inspector split;
in narrower note columns the inspector follows the list without a modal. Raw figure URLs include the API access token.
PDF/EPS/TIFF figures open in the existing file viewer, not a browser raster thumbnail.

CVD previews stay in the hidden check store. Their fixed-name, project-scoped `check-preview` endpoint accepts only
the content hash and one of the three supported simulation variants; the URL includes the usual API token.
