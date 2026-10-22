import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeOrcidId, orcidChecksumOk } from "../../web/src/geo/contracts/orcid.ts";
import { registerGeoOrcidRoutes } from "../src/geo/routes/orcid.ts";
import { registerGeoLibraryRoutes } from "../src/geo/routes/library.ts";
import { LibraryStore } from "../src/geo/library/store.ts";
import { createOrcidClient } from "../src/geo/orcid/client.ts";
import { OrcidService } from "../src/geo/orcid/service.ts";
import { cslFromWork, parseWorks } from "../src/geo/orcid/works.ts";
import type { MetadataRecord } from "../src/geo/library/metadata/index.ts";

const ID = "0000-0002-1825-0097";

const ext = (type: string, v: string, relationship = "self") => ({ "external-id-type": type, "external-id-value": v, "external-id-normalized": { value: v.toLowerCase() }, "external-id-relationship": relationship });
const summary = (putCode: number, title: string, opts: { doi?: string; year?: string; journal?: string; source?: string; type?: string } = {}) => ({
  "put-code": putCode,
  title: { title: { value: title } },
  type: opts.type ?? "journal-article",
  "publication-date": opts.year ? { year: { value: opts.year } } : null,
  "journal-title": opts.journal ? { value: opts.journal } : null,
  "external-ids": { "external-id": opts.doi ? [ext("issn", "0264-3561", "part-of"), ext("doi", opts.doi)] : [] },
  source: { "source-name": { value: opts.source ?? "Crossref" } },
});
const group = (...summaries: ReturnType<typeof summary>[]) => ({ "external-ids": { "external-id": summaries.flatMap((s) => s["external-ids"]["external-id"]) }, "work-summary": summaries });

const WORKS = {
  group: [
    group(summary(101, "Sparse labels in mineral prospectivity", { doi: "10.1000/ABC", year: "2024", journal: "Natural Resources Research" }), summary(102, "Sparse labels (Scopus copy)", { doi: "10.1000/abc", source: "Scopus - Elsevier" })),
    group(summary(201, "A KIGAM technical report on drilling", { year: "2021", type: "report", source: "Josiah Carberry" })),
    group(summary(301, "Already kept paper", { doi: "10.1000/kept", year: "2020" })),
    group(summary(401, "Nickel occurrence mapping in Gangwon", { year: "2019" })),
  ],
};
const DETAILS: Record<number, unknown> = {
  201: { "put-code": 201, title: { title: { value: "A KIGAM technical report on drilling" } }, type: "report", "publication-date": { year: { value: "2021" }, month: { value: "03" } },
    contributors: { contributor: [{ "credit-name": { value: "Carberry, Josiah" } }, { "credit-name": { value: "Hong Gildong" } }] },
    citation: { "citation-type": "bibtex", "citation-value": "@techreport{c2021, title={A KIGAM technical report on drilling}, institution={KIGAM}, year={2021}, number={GP2021-01}}" }, url: { value: "https://example.org/report" } },
  401: { "put-code": 401, title: { title: { value: "Nickel occurrence mapping in Gangwon" } }, type: "journal-article", "publication-date": { year: { value: "2019" } } },
};

function fakeOrcid(calls: string[]) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    calls.push(url.replace("https://pub.orcid.org/v3.0/", ""));
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (!url.includes(ID)) return json({ "response-code": 404 }, 404);
    if (url.endsWith("/person")) return json({ name: { "given-names": { value: "Josiah" }, "family-name": { value: "Carberry" }, "credit-name": null } });
    if (url.endsWith("/works")) return json(WORKS);
    const bulk = /\/works\/([\d,]+)$/.exec(url);
    if (bulk) return json({ bulk: bulk[1].split(",").map((c) => (DETAILS[Number(c)] ? { work: DETAILS[Number(c)] } : { error: { "response-code": 404 } })) });
    return json({}, 404);
  };
}

const lookupDoi = async (doi: string): Promise<MetadataRecord> => {
  if (doi === "10.1000/abc") return { csl: { type: "article-journal", title: "Sparse labels in mineral prospectivity", DOI: "10.1000/abc", author: [{ family: "Carberry", given: "Josiah" }], issued: { "date-parts": [[2024]] } }, metadataOrigin: "crossref", metadataConfirmed: false, signals: [] };
  throw new Error("not found");
};

let dir: string, store: LibraryStore, calls: string[];

async function app() {
  const server = Fastify();
  const service = new OrcidService(store, { client: createOrcidClient({ fetch: fakeOrcid(calls) as typeof fetch, spacingMs: 0, baseUrl: "https://pub.orcid.org/v3.0" }), lookupDoi });
  await registerGeoOrcidRoutes(server, { store: () => store, service: () => service });
  await registerGeoLibraryRoutes(server, { store: () => store });
  return server;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-orcid-"));
  store = new LibraryStore(path.join(dir, "library"));
  calls = [];
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("ORCID iD", () => {
  it("checks the ISO 7064 check digit and normalizes pasted forms", () => {
    expect(orcidChecksumOk(ID)).toBe(true);
    expect(orcidChecksumOk("0000-0002-1694-233X")).toBe(true);
    expect(orcidChecksumOk("0000-0002-1825-0098")).toBe(false);
    expect(normalizeOrcidId(`https://orcid.org/${ID}`)).toBe(ID);
    expect(normalizeOrcidId(" 0000 0002 1694 233x ")).toBe("0000-0002-1694-233X");
    expect(normalizeOrcidId("0000000218250097")).toBe(ID);
    expect(normalizeOrcidId("1234")).toBeNull();
  });
});

describe("ORCID mapping", () => {
  it("makes one row per group with the group's DOI and all sources", () => {
    const { works, omitted } = parseWorks(WORKS, 3);
    expect(omitted).toBe(1);
    expect(works[0]).toMatchObject({ putCode: 101, doi: "10.1000/abc", year: 2024, container: "Natural Resources Research", sources: ["Crossref", "Scopus - Elsevier"] });
    expect(works[1]).toMatchObject({ putCode: 201, type: "report", sources: ["Josiah Carberry"] });
    expect(works[1].doi).toBeUndefined();
  });
  it("fills CSL from a full work, record fields over the BibTeX citation", () => {
    const csl = cslFromWork(DETAILS[201])!;
    expect(csl).toMatchObject({ type: "report", title: "A KIGAM technical report on drilling", URL: "https://example.org/report", issued: { "date-parts": [[2021, 3]] } });
    expect(csl.author).toEqual([{ family: "Carberry", given: "Josiah" }, { literal: "Hong Gildong" }]);
    expect(csl.issue).toBe("GP2021-01");
    expect(csl.id).toBeUndefined();
  });
});

describe("ORCID routes", () => {
  it("links an iD after reading its public record and refuses invalid or unknown ones", async () => {
    const server = await app();
    expect((await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: "0000-0002-1825-0098" } })).statusCode).toBe(400);
    expect((await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: "0000-0002-1694-233X" } })).statusCode).toBe(404);
    const linked = await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: `https://orcid.org/${ID}` } });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().profile).toMatchObject({ orcid: ID, authenticated: false, name: "Josiah Carberry" });
    expect(JSON.parse(fs.readFileSync(path.join(store.root, "orcid.json"), "utf8")).orcid).toBe(ID);
    expect((await server.inject({ method: "DELETE", url: "/geo/orcid" })).json().profile).toBeNull();
    expect((await server.inject({ method: "POST", url: "/geo/orcid/works", payload: {} })).statusCode).toBe(409);
  });

  it("previews works against the library and confirms only what the researcher kept", async () => {
    const server = await app();
    const kept = await store.addGaidItem({ csl: { type: "article-journal", title: "Already kept paper", DOI: "10.1000/KEPT" }, metadataOrigin: "manual" });
    const similar = await store.addGaidItem({ csl: { type: "article-journal", title: "Nickel occurrence mapping in Gangwon.", issued: { "date-parts": [[2019]] } }, metadataOrigin: "manual" });
    await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: ID } });

    const preview = (await server.inject({ method: "POST", url: "/geo/orcid/works", payload: {} })).json();
    expect(preview.works.map((w: { putCode: number; match: { kind: string } }) => [w.putCode, w.match.kind])).toEqual([[101, "new"], [201, "new"], [301, "in-library"], [401, "similar"]]);
    expect(preview.works[2].match).toMatchObject({ itemId: kept.id, ownWork: false });
    expect(preview.works[3].match).toMatchObject({ itemId: similar.id });
    expect(await store.all()).toHaveLength(2);

    const folder = await store.addGaidCollection("내 논문");
    calls.length = 0;
    const res = await server.inject({ method: "POST", url: "/geo/orcid/works/confirm", payload: { putCodes: [101, 201, 301, 999], collectionId: folder.id } });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(result).toMatchObject({ added: 2, marked: 1, failed: 1, lookupFailed: 0 });
    expect(result.outcomes.find((o: { putCode: number }) => o.putCode === 101)).toMatchObject({ kind: "added", metadataOrigin: "crossref" });
    expect(result.outcomes.find((o: { putCode: number }) => o.putCode === 201)).toMatchObject({ kind: "added", metadataOrigin: "orcid" });
    expect(result.outcomes.find((o: { putCode: number }) => o.putCode === 999)).toMatchObject({ kind: "failed", reason: "not-found" });
    // Only the non-DOI work's details were read, in one bulk call.
    expect(calls.filter((c) => c.includes("/works/"))).toEqual([`${ID}/works/201`]);

    const all = await store.all();
    const report = all.find((i) => i.csl.title === "A KIGAM technical report on drilling")!;
    expect(report).toMatchObject({ metadataOrigin: "orcid", collectionIds: [folder.id], ownWork: { orcid: ID, putCode: 201 } });
    expect((await store.get(kept.id)).ownWork).toMatchObject({ orcid: ID, putCode: 301 });
    expect((await store.get(kept.id)).collectionIds).toEqual([]);
    expect((await store.get(similar.id)).ownWork).toBeUndefined();

    const list = (await server.inject({ method: "GET", url: "/geo/library?filter=mine" })).json();
    expect(list.total).toBe(3);
    expect(list.counts.mine).toBe(3);
    expect(list.items.every((i: { ownWork?: boolean }) => i.ownWork)).toBe(true);
    expect((await server.inject({ method: "GET", url: "/geo/orcid" })).json()).toMatchObject({ ownWorks: 3, profile: { orcid: ID } });

    // Confirming again adds nothing new: the same works are now in the library and stay marked once.
    const again = (await server.inject({ method: "POST", url: "/geo/orcid/works/confirm", payload: { putCodes: [101, 201] } })).json();
    expect(again).toMatchObject({ added: 0, marked: 2 });
    expect(await store.all()).toHaveLength(4);
  });

  it("falls back to the ORCID record when the DOI lookup fails", async () => {
    const server = await app();
    await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: ID } });
    const original = WORKS.group[0];
    DETAILS[101] = { "put-code": 101, title: { title: { value: "Sparse labels in mineral prospectivity" } }, type: "journal-article", "external-ids": { "external-id": [ext("doi", "10.1000/zzz")] } };
    WORKS.group[0] = group(summary(101, "Sparse labels in mineral prospectivity", { doi: "10.1000/zzz" }));
    try {
      const result = (await server.inject({ method: "POST", url: "/geo/orcid/works/confirm", payload: { putCodes: [101] } })).json();
      expect(result).toMatchObject({ added: 1, lookupFailed: 1 });
      expect((await store.all())[0]).toMatchObject({ metadataOrigin: "orcid", csl: { DOI: "10.1000/zzz" } });
    } finally {
      WORKS.group[0] = original;
      delete DETAILS[101];
    }
  });

  it("reports ORCID outages as 502 without changing the profile", async () => {
    const server = Fastify();
    const failing = createOrcidClient({ fetch: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch, spacingMs: 0, sleep: async () => {} });
    const service = new OrcidService(store, { client: failing, lookupDoi });
    await registerGeoOrcidRoutes(server, { store: () => store, service: () => service });
    const res = await server.inject({ method: "PUT", url: "/geo/orcid", payload: { orcid: ID } });
    expect(res.statusCode).toBe(502);
    expect(res.json().orcid).toBe("unavailable");
    expect(fs.existsSync(path.join(store.root, "orcid.json"))).toBe(false);
  });
});
