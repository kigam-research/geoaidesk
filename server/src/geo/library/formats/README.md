# Bibliography formats

Import `server/src/geo/library/formats/index.ts`:

| Function | Behaviour |
|---|---|
| `parseBibliography(text, "bibtex" | "ris" | "csl-json")` | Returns `{ items, errors }`; error indices are one-based input-entry positions (zero for a file-level failure). Invalid entries do not hide valid neighbours. Imports are bounded to 8 MiB / 10,000 entries. |
| `exportBibliography(items, format)` | Validates CSL items and writes the selected text format. CSL-JSON preserves all unknown CSL properties. BibTeX/RIS map the common bibliographic fields and preserve their own uninterpreted input fields. |
| `citationKeyFor(csl, taken)` | First-author family plus year; when occupied, suffixes `a` through `z`, then `aa`, etc. It does not mutate `taken`; the caller owns key reservation. |
| `formatReference(csl, "ko" | "en")` | One plain APA-like line: author, year, title, journal/volume/issue/pages or publisher, DOI/URL. This is not a full APA or arbitrary-CSL formatter. |

No new dependencies and no citeproc-js. The hand-written BibTeX reader supports nested braces, quoted values,
`@string`, numeric/month macros, `#` concatenation, comments/preambles, common TeX accents and escaped punctuation.
It does not execute TeX. Unknown string macros produce an entry error; unknown entry types remain in the imported
item's `gaid-bibtex` data and also produce an error. Unknown RIS types follow the same rule. Raw input data is stored
under `gaid-bibtex` / `gaid-ris` so uninterpreted fields can be exported again. These properties are metadata, never
instructions. A malformed BibTeX entry recovers at the next line starting with an entry header. Malformed RIS entries
recover at the next `TY`. Missing `ER` is an explicit error.

Supported common fields: title, personal/corporate authors and editors, date, container title, volume, issue, pages,
publisher, DOI, URL, language, abstract, note, keyword, ISSN (BibTeX also ISBN and edition). BibTeX uses `booktitle` for
chapters/conference papers and `journal` for articles. Detailed dates use year/month plus the BibLaTeX `date` field.
RIS multiline metadata is flattened for export so it cannot create a new RIS entry. Arbitrary CSL extension fields
are lossless only in CSL-JSON; BibTeX/RIS are deliberately common-field interchange, not full CSL serialisations.

Key rules: prefer a supplied Latin family; for a literal Latin name use the last token. Latin diacritics are removed
with Unicode NFKD plus common non-decomposing letters (`ø`, `ł`, `ß`, `æ`, `œ`, `ð`, `þ`). ASCII letters only, lowercase.
There is no Korean-name romanisation library in the existing dependencies, so a Korean-only name gets `ref2024`
(or `refnd` without a date), not an invented surname. Supplied `family: "Kim"` gets `kim2024`. A supplied Latin given
name is a fallback when the family cannot be transliterated. The parent must persist the assigned key; regenerating
keys after author/year edits would break existing citations. BibTeX export preserves an explicit `citation-key`
(preferred) or a usable unique CSL `id`; otherwise it generates one. Pass the library's persisted `citationKey` as
`csl["citation-key"]` for export. Duplicate or invalid keys are replaced by a generated unique key.

Researcher confirmation belongs to the caller. Import results do not mean checked/accepted metadata. Preview the
errors and candidates before storing items with `metadataOrigin: "import"`, `metadataConfirmed: false`.
