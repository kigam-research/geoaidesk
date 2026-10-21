# Metadata fixtures

- `crossref.json`: fields recorded on PC74, 2026-10-21, from `https://api.crossref.org/works/10.1038%2Fnphys1170`.
- `openalex.json`: fields recorded at the same time from `https://api.openalex.org/works/doi:10.1038%2Fnphys1170`, with
  no key. Only mapped metadata is retained; no article body, abstract or images.
- `kci.xml`: original synthetic XML based on KCI's public basic-article API field table, not a keyed API capture.
  Titles/authors/journal in this fixture are invented. Official table:
  `https://www.kci.go.kr/kciportal/po/openapi/openDataView.kci?datasetBean.dtstSeqNo=1`.

Retraction/correction and error variants are explicit mutations in tests, not claims about the real paper. PDF
fixtures are original byte-correct minimal PDFs built inside the test and written to OS temp storage. One contains
text on four pages, and one has a painted rectangle with no text layer (the same observable condition as a scan
without OCR). No copyrighted publisher PDF is bundled. Vitest stubs global fetch to fail; all requests are injected.
