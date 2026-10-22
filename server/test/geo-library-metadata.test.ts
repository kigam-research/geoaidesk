import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arxivDoi, createMetadataClient, doiCandidates, identifyPdf, normalizeDoi } from "../src/geo/library/metadata/index.ts";

const fixture = async (name: string) => JSON.parse(await readFile(new URL(`./fixtures/library/${name}.json`, import.meta.url), "utf8"));
const json = (v: unknown, status = 200, headers = {}) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", ...headers } });
const mockFetch = (fn: (url: URL, init?: RequestInit) => Response | Promise<Response>): typeof fetch => vi.fn((u, init) => fn(new URL(String(u)), init)) as typeof fetch;

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Live fetch forbidden in vitest"); })); });
afterEach(() => vi.unstubAllGlobals());

describe("metadata services", () => {
  it("normalises strict DOI candidates without losing balanced parentheses", () => {
    expect(doiCandidates("(doi:10.1000/ABC(1)). 10.1000/abc(1); bad 10.12/x https://doi.org/10.9999/OK."))
      .toEqual(["10.1000/abc(1)", "10.9999/ok"]);
    expect(normalizeDoi("https://doi.org/10.1038%2Fnphys1170")).toBe("10.1038/nphys1170");
    expect(() => normalizeDoi("text 10.1038/nphys1170")).toThrow("Invalid DOI");
  });

  it("maps recorded Crossref metadata, polite mailto and update signals", async () => {
    const value = await fixture("crossref");
    value.message["update-to"] = [{ DOI: "10.1000/original", type: "retraction" }];
    value.message["updated-by"] = [{ DOI: "10.1000/notice", type: "correction", source: "publisher", "record-id": "42",
      updated: { "date-time": "2024-01-01T00:00:00Z" }, label: "Correction" }];
    value.message.relation = { "is-corrected-by": [{ id: "10.1000/correction", "id-type": "doi" }] };
    value.message["update-type"] = "correction";
    const f = mockFetch((url, init) => {
      expect(url.searchParams.get("mailto")).toBe("researcher@example.org");
      expect(init?.headers).toMatchObject({ "User-Agent": "GAID-metadata/1 (mailto:researcher@example.org)" });
      return json(value);
    });
    const r = await createMetadataClient({ fetch: f, mailto: "researcher@example.org" }).lookupDoi("10.1038/nphys1170");
    expect(r.csl.title).toBe("Measured measurement");
    expect(r.csl.author?.[0].family).toBe("Aspelmeyer");
    expect(r.metadataOrigin).toBe("crossref"); expect(r.metadataConfirmed).toBe(false);
    expect(r.signals.map((s) => s.kind)).toEqual(["retraction", "correction", "correction", "correction"]);
    expect(r.signals[1]).toMatchObject({ relation: "updated-by:correction", assertionSource: "publisher", recordId: "42", updatedAt: "2024-01-01T00:00:00Z" });
  });

  it("falls back to OpenAlex after Crossref fails, keyless or with an optional key", async () => {
    const value = await fixture("openalex"); value.is_retracted = true;
    const f = mockFetch((url) => url.host === "api.crossref.org" ? json({}, 404) : json(value));
    const r = await createMetadataClient({ fetch: f, openAlexApiKey: "fixture-key" }).lookupDoi("10.1038/nphys1170");
    expect(r.metadataOrigin).toBe("openalex"); expect(r.signals[0].kind).toBe("retraction");
    expect(r.csl.issued?.["date-parts"][0][0]).toBe(2009);
    expect(new URL(String(vi.mocked(f).mock.calls[1][0])).searchParams.get("api_key")).toBe("fixture-key");
    await createMetadataClient({ fetch: mockFetch((url) => { expect(url.searchParams.has("api_key")).toBe(false); return json(value); }), openAlexApiKey: "" })
      .lookupDoi("10.1038/nphys1170", "openalex");
  });

  // gaid-first-use-fixes: an arXiv PDF got five unrelated title-search suggestions. Its DataCite DOI names the preprint;
  // OpenAlex answers that DOI with the later journal article (a different DOI), which must not be offered as this PDF.
  it("looks up an arXiv identifier through DataCite as a preprint, before Crossref and OpenAlex", async () => {
    expect(arxivDoi("2005.07939v1")).toBe("10.48550/arxiv.2005.07939");
    expect(arxivDoi("hep-th/9901001v2")).toBe("10.48550/arxiv.hep-th/9901001");
    const record = { type: "article-journal", DOI: "10.48550/ARXIV.2005.07939", "container-title": "arXiv", publisher: "arXiv", version: "1",
      title: "Predicting into unknown space? Estimating the area of applicability of spatial prediction models",
      author: [{ family: "Meyer", given: "Hanna" }, { family: "Pebesma", given: "Edzer" }], issued: { "date-parts": [[2020]] },
      URL: "https://arxiv.org/abs/2005.07939" };
    const f = mockFetch((url) => url.host === "api.datacite.org" ? json(record) : json({}, 404));
    const r = await createMetadataClient({ fetch: f }).lookupDoi(arxivDoi("2005.07939v1"));
    expect(new URL(String(vi.mocked(f).mock.calls[0][0])).host).toBe("api.datacite.org");
    expect(f).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ metadataOrigin: "datacite", metadataConfirmed: false, csl: { type: "article", DOI: "10.48550/arxiv.2005.07939",
      "container-title": "arXiv", author: [{ family: "Meyer", given: "Hanna" }, { family: "Pebesma", given: "Edzer" }] } });
    const journal = { title: record.title, doi: "https://doi.org/10.1111/2041-210x.13650", publication_year: 2021 };
    const later = mockFetch((url) => url.host === "api.datacite.org" ? json({}, 404) : url.host === "api.openalex.org" ? json(journal) : json({}, 404));
    await expect(createMetadataClient({ fetch: later }).lookupDoi(arxivDoi("2005.07939"))).rejects.toThrow(/datacite: HTTP 404/);
  });

  it("asks DataCite last for a DOI that Crossref and OpenAlex do not know", async () => {
    const f = mockFetch((url) => url.host === "api.datacite.org"
      ? json({ type: "dataset", DOI: "10.1594/PANGAEA.123", title: "Core logs", author: [{ literal: "Survey team" }], publisher: "PANGAEA" })
      : json({}, 404));
    const r = await createMetadataClient({ fetch: f }).lookupDoi("10.1594/pangaea.123");
    expect(vi.mocked(f).mock.calls.map(([u]) => new URL(String(u)).host)).toEqual(["api.crossref.org", "api.openalex.org", "api.datacite.org"]);
    expect(r.csl).toMatchObject({ type: "dataset", author: [{ literal: "Survey team" }], publisher: "PANGAEA" });
  });

  it("paces Crossref from response headers and obeys Retry-After without live waiting", async () => {
    const value = await fixture("crossref"); let now = 0, attempts = 0;
    const sleep = vi.fn(async (ms: number) => { now += ms; });
    const f = mockFetch(() => ++attempts === 2 ? json({}, 429, { "retry-after": "2" }) : json(value, 200, { "x-rate-limit-limit": "2", "x-rate-limit-interval": "1s" }));
    const client = createMetadataClient({ fetch: f, now: () => now, sleep });
    await client.lookupDoi("10.1038/nphys1170"); await client.lookupDoi("10.1038/nphys1170");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 2000]); expect(attempts).toBe(3);
  });

  it("does not ignore long cooldowns, leak key-bearing errors or accept a different DOI", async () => {
    const value = await fixture("openalex");
    const f = mockFetch((url) => url.host === "api.crossref.org" ? json({}, 429, { "retry-after": "120" }) : json(value));
    const result = await createMetadataClient({ fetch: f, maxRateWaitMs: 10 }).lookupDoi("10.1038/nphys1170");
    expect(result.metadataOrigin).toBe("openalex"); expect(f).toHaveBeenCalledTimes(2);
    await expect(createMetadataClient({ fetch: mockFetch(() => json(value)) }).lookupDoi("10.1000/different")).rejects.toThrow();
    const secret = "do-not-print";
    await expect(createMetadataClient({ fetch: mockFetch(() => { throw new Error(`https://api.openalex.org/?api_key=${secret}`); }) }).lookupDoi("10.1038/nphys1170"))
      .rejects.not.toThrow(secret);
  });

  it("keeps the list rate bucket when singleton requests intervene", async () => {
    const value = await fixture("crossref"); let now = 0;
    const sleep = vi.fn(async (ms: number) => { now += ms; });
    const f = mockFetch((url) => url.host === "api.openalex.org" ? json({ results: [] }) : url.pathname === "/works"
      ? json({ message: { items: [value.message] } }, 200, { "x-rate-limit-limit": "1", "x-rate-limit-interval": "1s" })
      : json(value, 200, { "x-rate-limit-limit": "10", "x-rate-limit-interval": "1s" }));
    const c = createMetadataClient({ fetch: f, now: () => now, sleep, kciApiKey: "" });
    await c.searchByTitle("Measured measurement"); await c.lookupDoi("10.1038/nphys1170"); await c.searchByTitle("Measured measurement");
    expect(sleep.mock.calls).toEqual([[1000]]);
  });

  it("ranks title candidates but requires selection and retains provider failures", async () => {
    const cr = await fixture("crossref"), oa = await fixture("openalex");
    const other = structuredClone(cr.message); other.title = ["An unrelated geology paper"]; other.DOI = "10.1000/other";
    const f = mockFetch((url) => {
      if (url.host === "api.crossref.org") { expect(url.searchParams.has("query.bibliographic")).toBe(true); return json({ message: { items: [other, cr.message, {}] } }); }
      expect(url.searchParams.get("search")).toBe("Measured measurement"); return json({ results: [oa] });
    });
    const r = await createMetadataClient({ fetch: f, kciApiKey: "" }).searchByTitle("Measured measurement");
    expect(r.requiresSelection).toBe(true); expect(r.candidates[0].score).toBe(1);
    expect(r.candidates.at(-1)!.score).toBeLessThan(1); expect(r.errors).toHaveLength(1);
    expect(r.candidates.every((c) => !c.metadataConfirmed)).toBe(true);
  });

  it("extracts DOI from URL patterns and recognised HTML tags only", async () => {
    const f = mockFetch(() => new Response(`<meta NAME="citation_doi" content="10.1000/ONE"><meta property="dc.identifier" content="doi:10.1000/two."><meta name="prism.doi" content="10.1000/three"><p>Ignore DOI 10.1000/no</p>`, { headers: { "content-type": "text/html" } }));
    const c = createMetadataClient({ fetch: f });
    expect((await c.resolveUrl("https://doi.org/10.1038/nphys1170")).method).toBe("url"); expect(f).not.toHaveBeenCalled();
    expect((await c.resolveUrl("https://192.0.2.10/article")).doiCandidates).toEqual(["10.1000/one", "10.1000/two", "10.1000/three"]);
  });

  it("preserves URL intake's loopback, redirect and stream-size limits", async () => {
    const c = createMetadataClient({ fetch: mockFetch(() => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })) });
    await expect(c.resolveUrl("http://127.0.0.1/article")).rejects.toThrow();
    await expect(c.resolveUrl("https://192.0.2.10/article")).rejects.toThrow();
    const large = createMetadataClient({ fetch: mockFetch(() => new Response("x".repeat(4 * 1024 * 1024 + 1), { headers: { "content-type": "text/html" } })) });
    await expect(large.resolveUrl("https://192.0.2.10/article")).rejects.toThrow("size limit");
    const redirect = createMetadataClient({ fetch: mockFetch(() => new Response(null, { status: 302, headers: { location: "/again" } })) });
    await expect(redirect.resolveUrl("https://192.0.2.10/article")).rejects.toThrow("redirects");
  });

  it("skips KCI without a key and maps the documented XML fields when enabled", async () => {
    const xml = await readFile(new URL("./fixtures/library/kci.xml", import.meta.url), "utf8");
    const f = mockFetch((url) => { expect(url.origin + url.pathname).toBe("https://open.kci.go.kr/po/openapi/openApiSearch.kci"); expect(url.searchParams.get("apiCode")).toBe("articleSearch"); expect(url.searchParams.get("title")).toBe("지질 연구"); return new Response(xml); });
    expect((await createMetadataClient({ fetch: f, kciApiKey: "" }).searchKci("지질 연구")).skipped).toBe(true); expect(f).not.toHaveBeenCalled();
    const r = await createMetadataClient({ fetch: f, kciApiKey: "fixture" }).searchKci("지질 연구");
    expect(r.candidates[0].csl.title).toBe("지질 연구"); expect(r.candidates[0].csl.author?.[0].literal).toBe("김연구");
    expect(r.candidates[0].csl["container-title"]).toBe("합성 학술지");
    const err = await createMetadataClient({ fetch: mockFetch(() => new Response("<error>bad key</error>")), kciApiKey: "fixture" }).searchKci("지질 연구");
    expect(err.errors).toHaveLength(1);
  });
});

/** Original tiny PDFs generated here; no publisher files. Byte-correct xref; no third-party PDF dependency. */
function pdf(pages: string[]): Buffer {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((text, i) => {
    const stream = text ? `BT /F1 12 Tf 40 700 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET` : "0.5 g 20 20 100 100 re f";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

it("identifies only the first three PDF pages and reports textless PDFs without a title guess", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaid-library-pdf-"));
  try {
    const file = join(dir, "original.pdf");
    await writeFile(file, pdf(["An original synthetic research title", "doi:10.1000/ONE arXiv:2401.12345v2", "", "doi:10.1000/ignored"]));
    const r = await identifyPdf(file);
    expect(r.error).toBeUndefined(); expect(r.textFound).toBe(true); expect(r.titleGuess).toBe("An original synthetic research title");
    expect(r.doiCandidates).toEqual(["10.1000/one"]); expect(r.arxivIds).toEqual(["2401.12345v2"]); expect(r.pagesRead).toEqual([1, 2, 3]);
    await writeFile(file, pdf([""]));
    const blank = await identifyPdf(file);
    expect(blank.textFound).toBe(false); expect(blank.titleGuess).toBeUndefined(); expect(blank.emptyPages).toEqual([1]);
    expect((await identifyPdf(join(dir, "missing.pdf"))).error).toBeDefined();
  } finally { await rm(dir, { recursive: true, force: true }); }
});
