import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LibraryStore } from "../src/geo/library/store.ts";
import { ZoteroService, keepGaidFiles } from "../src/geo/library/zotero-service.ts";
import { fakeZotero, type FakeZotero } from "./fixtures/geo-zotero-server.ts";

function makePdf(pages: string[]): Buffer {
  const objs: string[] = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((text, i) => {
    const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let out = "%PDF-1.4\n"; const off: number[] = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${off.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

let dir: string, store: LibraryStore, fake: FakeZotero, service: ZoteroService;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-zotero-service-"));
  store = new LibraryStore(path.join(dir, "library"));
  fake = await fakeZotero("local");
  service = new ZoteroService(store, { localBaseUrl: fake.baseUrl });
});
afterEach(async () => {
  await fake.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Zotero service", () => {
  it("mirrors the local library, marks removed items, and keeps ids", async () => {
    fake.addCollection("COLLECT1", "광상");
    fake.addItem("PAPER001", { collections: ["COLLECT1"], citationKey: "hong2026" });
    fake.addItem("PAPER002");
    const lib = await service.connectLocal();
    expect(lib).toMatchObject({ connection: "local", state: "ok", serverId: "server-A" });
    const items = await store.all();
    expect(items).toHaveLength(2);
    const first = items.find((i) => i.zotero?.itemKey === "PAPER001")!;
    expect(first).toMatchObject({ source: "zotero", citationKey: "hong2026", metadataOrigin: "zotero" });
    expect((await store.collections()).map((c) => c.name)).toEqual(["광상"]);
    // No Better BibTeX key in Zotero: a GAID alias key, stable across syncs.
    const second = items.find((i) => i.zotero?.itemKey === "PAPER002")!;
    expect(second.citationKey).toMatch(/^refnd/);
    expect(first.collectionIds).toEqual([(await store.collections())[0].id]);

    fake.removeItem("PAPER002");
    fake.addItem("PAPER003");
    await service.syncAll();
    const after = await store.all();
    expect(after.find((i) => i.zotero?.itemKey === "PAPER002")?.removedFromSourceAt).toBeTruthy();
    expect(after.find((i) => i.zotero?.itemKey === "PAPER001")?.id).toBe(first.id);
    expect(after.filter((i) => !i.removedFromSourceAt)).toHaveLength(2);
    fake.addItem("PAPER001", { collections: ["COLLECT1"], citationKey: "hong2026" }); // edited in Zotero
    await service.syncAll();
    expect((await store.get(first.id)).citationKey).toBe("hong2026");
  });

  it("reports a closed Zotero or a disabled local API without touching the library", async () => {
    fake.apiOff = true;
    expect(await service.connectLocal()).toMatchObject({ state: "local-api-off" });
    expect(await service.libraries()).toEqual([]);
  });

  it("connects a web key, records why a refresh failed with the library, and clears it once a refresh works", async () => {
    const web = await fakeZotero("web");
    web.webKey = "SyntheticWebKey0123456789";
    try {
      const svc = new ZoteroService(store, { webBaseUrl: web.baseUrl });
      web.addItem("PAPER001");
      const [connected] = await svc.connectWeb(web.webKey);
      expect(connected).toMatchObject({ connection: "web", libraryId: "123", state: "ok", lastSyncAt: expect.any(String) });
      expect((await store.all()).map((i) => i.zotero?.itemKey)).toEqual(["PAPER001"]);
      web.libraryForbidden = true;
      await svc.syncAll();
      const [failed] = await svc.libraries();
      expect(failed).toMatchObject({ state: "no-library-access", failedAt: expect.any(String), detail: "web · access-denied · HTTP 403", lastSyncAt: connected.lastSyncAt });
      expect(JSON.stringify(failed)).not.toContain(web.webKey);
      web.libraryForbidden = false;
      await svc.syncAll();
      const [recovered] = await svc.libraries();
      expect(recovered.state).toBe("ok");
      expect(recovered.failedAt).toBeUndefined();
      expect(recovered.detail).toBeUndefined();
    } finally { await web.close(); }
  });

  it("refuses a web key that cannot read the personal library and does not keep it", async () => {
    const web = await fakeZotero("web");
    web.webKey = "SyntheticWebKey0123456789";
    web.personalLibraryAccess = false;
    try {
      const svc = new ZoteroService(store, { webBaseUrl: web.baseUrl });
      await expect(svc.connectWeb(web.webKey)).rejects.toMatchObject({ state: "no-library-access" });
      expect(await svc.libraries()).toEqual([]);
      web.personalLibraryAccess = true;
      await expect(svc.connectWeb("SomeOtherKey0123456789")).rejects.toMatchObject({ state: "key-invalid" });
      expect(fs.readFileSync(fs.readdirSync(path.join(dir, "library", "secrets")).map((f) => path.join(dir, "library", "secrets", f))[0], "utf8")).toBe("{}");
    } finally { await web.close(); }
  });

  it("sends a GAID item to Zotero in place and keeps its PDF and citation key across syncs", async () => {
    await service.connectLocal();
    const pdf = await store.storePdf(makePdf(["Nickel prospectivity sparse labels page text long enough for reading"]));
    const gaid = await store.addGaidItem({ csl: { type: "article-journal", title: "Sent paper", author: [{ family: "Kim" }], issued: { "date-parts": [[2025]] } }, metadataOrigin: "manual", pdfSha256: pdf.sha256 });
    const sent = await service.sendToZotero(gaid.id);
    expect(sent).toMatchObject({ created: 1, merged: 0, attachments: 1, skipped: [], item: { id: gaid.id, source: "zotero", citationKey: "kim2025" } });
    expect(sent.item?.sentToZoteroAt).toBeTruthy();
    expect(fake.uploadedFiles.size).toBe(1);
    const inbox = [...fake.collections.values()].find((c) => c.data.name === "GAID 수집함");
    expect(inbox).toBeTruthy();
    await service.syncAll();
    const synced = await store.get(gaid.id);
    expect(synced.source).toBe("zotero");
    expect(synced.attachments.some((a) => a.stored?.sha256 === pdf.sha256)).toBe(true);
    // The uploaded PDF and GAID's stored copy are one attachment, not two.
    expect(synced.attachments.filter((a) => a.kind === "pdf")).toHaveLength(1);
    expect(fake.requests.some((r) => r.method !== "GET" && r.url.pathname.includes("/items/") && r.method === "DELETE")).toBe(false);
  });

  it("reads a Zotero PDF into page text for the agent", async () => {
    const file = path.join(dir, "paper.pdf");
    fs.writeFileSync(file, makePdf(["First page text about nickel occurrences and grids", "Second page text about spatial blocks and folds"]));
    fake.attachmentUrl = pathToFileURL(file).href;
    fake.addItem("PAPER001");
    fake.addItem("ATTACH01", { itemType: "attachment", parentItem: "PAPER001", contentType: "application/pdf", title: "PDF" });
    await service.connectLocal();
    const item = (await store.all())[0];
    const read = await service.readZoteroPdf(item);
    expect(read.read).toMatchObject({ coverage: "full", pagesTotal: 2 });
    await service.syncAll();
    expect((await store.get(item.id)).attachments[0].stored).toBeTruthy();
  });

  it("keeps GAID-held files when the connector maps attachments again", () => {
    const base = { id: "li-aaaaaaaaaaaa", owner: "local", source: "zotero" as const, csl: { type: "book", title: "x" }, metadataOrigin: "zotero" as const, metadataConfirmed: true, collectionIds: [], tags: [], addedAt: "", updatedAt: "" };
    const prior = { ...base, read: { coverage: "full" as const }, attachments: [{ id: "za-A", kind: "pdf" as const, zoteroAttachmentKey: "A", stored: { sha256: "a".repeat(64), size: 1, mediaType: "application/pdf" } }, { id: "la-x", kind: "pdf" as const, stored: { sha256: "b".repeat(64), size: 1, mediaType: "application/pdf" } }] };
    const next = { ...base, read: { coverage: "none" as const }, attachments: [{ id: "za-A", kind: "pdf" as const, zoteroAttachmentKey: "A" }] };
    const kept = keepGaidFiles(next, prior);
    expect(kept.attachments.map((a) => a.stored?.sha256[0])).toEqual(["a", "b"]);
    expect(kept.read.coverage).toBe("full");
  });
});
