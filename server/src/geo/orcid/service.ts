/**
 * The researcher's ORCID link and "ORCID에서 내 논문 가져오기" (gaid-orcid phase 1).
 *
 * The profile lives next to the personal library (`<library>/orcid.json`, local like `zotero.json`). Previews read the
 * public record only; confirming re-reads the record (never trusts a client-sent title or DOI), fills each kept work
 * by DOI (Crossref, then OpenAlex) or from the ORCID record, and adds or marks library items. Matching by DOI marks the
 * existing item; a similar title only informs the researcher and never merges.
 */
import fs from "node:fs";
import path from "node:path";
import type { LibraryItem, MetadataOrigin, UpdateSignal } from "../../../../web/src/geo/contracts/library.ts";
import {
  ORCID_LIMITS,
  ORCID_SCHEMA,
  normalizeOrcidId,
  type OrcidConfirmBody,
  type OrcidConfirmOutcome,
  type OrcidConfirmResult,
  type OrcidProfile,
  type OrcidStatus,
  type OrcidWorksPreview,
} from "../../../../web/src/geo/contracts/orcid.ts";
import { LibraryError, normalizeDoi, type LibraryStore } from "../library/store.ts";
import { lookupDoi as defaultLookupDoi, type MetadataRecord } from "../library/metadata/index.ts";
import { createOrcidClient, OrcidError, type OrcidClient } from "./client.ts";
import { orcidHub as defaultHub, type OrcidHubPort } from "./hub.ts";
import { AuthoringError } from "../authoring/store.ts";
import type { OrcidAuthStart, OrcidHubState } from "../../../../web/src/geo/contracts/orcid.ts";
import { cslFromWork, matchWork, parseWorks, personName } from "./works.ts";

export interface OrcidServiceOptions {
  client?: OrcidClient;
  lookupDoi?: (doi: string) => Promise<MetadataRecord>;
  now?: () => Date;
  /** Hub server ORCID port (phase 2); default: the logged-in hub server, if any. */
  hub?: () => OrcidHubPort | null;
}

/** Outcome of the ORCID redirect, worded by the callback page. */
export type OrcidCallbackResult =
  | { ok: true; orcid: string; environment: "production" | "sandbox" }
  | { ok: false; reason: "denied" | "no-account" | "expired" | "taken" | "not-configured" | "failed" | "unreachable" };

const iso = (now: () => Date) => now().toISOString();

export class OrcidService {
  private client: OrcidClient;
  private lookupDoi: (doi: string) => Promise<MetadataRecord>;
  private now: () => Date;
  private hub: () => OrcidHubPort | null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private store: LibraryStore, options: OrcidServiceOptions = {}) {
    this.client = options.client ?? createOrcidClient();
    this.lookupDoi = options.lookupDoi ?? ((doi) => defaultLookupDoi(doi));
    this.now = options.now ?? (() => new Date());
    this.hub = options.hub ?? defaultHub;
  }

  private get file() { return path.join(this.store.root, "orcid.json"); }

  /** Null when unlinked or the file is unreadable (an unreadable file is left as is, never rewritten here). */
  profile(): OrcidProfile | null {
    try {
      const p = JSON.parse(fs.readFileSync(this.file, "utf8")) as OrcidProfile;
      return p?.schema === ORCID_SCHEMA && typeof p.orcid === "string" && normalizeOrcidId(p.orcid) === p.orcid ? p : null;
    } catch { return null; }
  }

  private save(profile: OrcidProfile | null) {
    if (!profile) { fs.rmSync(this.file, { force: true }); return; }
    fs.mkdirSync(this.store.root, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(profile, null, 2) + "\n");
    fs.renameSync(tmp, this.file);
  }

  /** Serializes profile writes and confirms (one researcher, but two tabs can click at once). */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  async status(): Promise<OrcidStatus> {
    const hub = await this.hubState();
    // The hub account is the source of an authenticated iD: adopt it, or drop "authenticated" when it was removed there.
    if (hub.state === "linked" || hub.state === "ready" || hub.state === "not-configured") await this.serial(async () => {
      const current = this.profile();
      if (hub.state === "linked") {
        const link = hub.link;
        if (!current || current.orcid !== link.id || !current.authenticated || current.environment !== link.environment) {
          this.save({ schema: ORCID_SCHEMA, orcid: link.id, authenticated: true, environment: link.environment, authenticatedAt: link.authenticatedAt,
            ...(link.name ? { name: link.name } : current?.orcid === link.id && current.name ? { name: current.name } : {}),
            linkedAt: current?.orcid === link.id ? current.linkedAt : link.authenticatedAt,
            ...(current?.orcid === link.id && current.lastReadAt ? { lastReadAt: current.lastReadAt } : {}),
            ...(current?.orcid === link.id && current.lastImportAt ? { lastImportAt: current.lastImportAt } : {}) });
        }
      } else if (current?.authenticated) {
        const { authenticatedAt: _a, environment: _e, ...rest } = current;
        this.save({ ...rest, authenticated: false });
      }
    });
    const profile = this.profile();
    const ownWorks = profile ? (await this.store.all()).filter((i) => !i.removedFromSourceAt && i.ownWork?.orcid === profile.orcid).length : 0;
    return { profile, ownWorks, hub };
  }

  private async hubState(): Promise<OrcidHubState> {
    const port = this.hub();
    if (!port) return { state: "no-account" };
    try {
      const s = await port.status();
      if (s.link) return { state: "linked", environment: s.link.environment, link: s.link };
      return s.configured && s.environment ? { state: "ready", environment: s.environment } : { state: "not-configured" };
    } catch (error) {
      if (error instanceof AuthoringError && error.status === 401) return { state: "no-account" };
      // A hub server older than ORCID support has no /orcid route.
      if (error instanceof AuthoringError && error.status === 404) return { state: "not-configured" };
      return { state: "unreachable" };
    }
  }

  /** Starts ORCID sign-in through the hub server (phase 2); the screen opens the returned URL. */
  async authStart(): Promise<OrcidAuthStart> {
    const port = this.hub();
    if (!port) throw new LibraryError("기관 GAID 허브에 로그인해야 ORCID 본인 확인을 할 수 있습니다.", 409);
    try { return await port.start(); }
    catch (error) {
      if (error instanceof AuthoringError && (error.status === 409 || error.status === 404)) throw new LibraryError("기관 GAID 허브에 ORCID 연결이 설정되어 있지 않습니다.", 409);
      if (error instanceof AuthoringError && error.status === 401) throw new LibraryError("기관 GAID 허브에 다시 로그인해 주세요.", 409);
      throw new LibraryError("기관 GAID 허브에 연결하지 못했습니다.", 502);
    }
  }

  /** ORCID's redirect (`?code&state` or `?error`): the hub exchanges and verifies; the local profile follows its result. */
  async callback(query: Record<string, unknown>): Promise<OrcidCallbackResult> {
    if (typeof query.error === "string") return { ok: false, reason: "denied" };
    const code = typeof query.code === "string" ? query.code : "", state = typeof query.state === "string" ? query.state : "";
    if (!code || !state || code.length > 200 || state.length > 200) return { ok: false, reason: "failed" };
    const port = this.hub();
    if (!port) return { ok: false, reason: "no-account" };
    let link;
    try { ({ link } = await port.finish({ code, state })); }
    catch (error) {
      const status = error instanceof AuthoringError ? error.status : 0;
      return { ok: false, reason: status === 401 ? "no-account" : status === 410 || status === 400 ? "expired" : status === 409 ? "taken" : status === 502 ? "unreachable" : "failed" };
    }
    await this.status();
    return { ok: true, orcid: link.id, environment: link.environment };
  }

  /** Removes the authenticated iD from the hub account; the local iD stays, unauthenticated. */
  async authUnlink(): Promise<OrcidStatus> {
    const port = this.hub();
    if (!port) throw new LibraryError("기관 GAID 허브에 로그인해야 합니다.", 409);
    try { await port.unlink(); }
    catch { throw new LibraryError("기관 GAID 허브에 연결하지 못했습니다.", 502); }
    return this.status();
  }

  /** Links a typed iD after checking that a public record exists; re-linking the same iD keeps its dates. */
  async link(input: unknown): Promise<OrcidStatus> {
    await this.serial(async () => {
      const orcid = typeof input === "string" ? normalizeOrcidId(input) : null;
      if (!orcid) throw new LibraryError("ORCID iD 형식이 맞지 않습니다.", 400);
      const name = personName(await this.client.person(orcid));
      const previous = this.profile();
      this.save({
        schema: ORCID_SCHEMA,
        orcid,
        authenticated: false,
        ...(name ? { name } : {}),
        linkedAt: previous?.orcid === orcid ? previous.linkedAt : iso(this.now),
        ...(previous?.orcid === orcid && previous.lastReadAt ? { lastReadAt: previous.lastReadAt } : {}),
        ...(previous?.orcid === orcid && previous.lastImportAt ? { lastImportAt: previous.lastImportAt } : {}),
      });
    });
    // Outside the queue: status() reconciles with the hub through the same queue.
    return this.status();
  }

  /** Removes the link; items keep their own-work marks (they record the iD they came from). */
  async unlink(): Promise<OrcidStatus> {
    await this.serial(async () => { this.save(null); });
    return this.status();
  }

  private linked(): OrcidProfile {
    const profile = this.profile();
    if (!profile) throw new LibraryError("ORCID iD가 연결되어 있지 않습니다.", 409);
    return profile;
  }

  async preview(): Promise<OrcidWorksPreview> {
    const profile = this.linked();
    const [person, body] = [await this.client.person(profile.orcid), await this.client.works(profile.orcid)];
    const { works, omitted } = parseWorks(body, ORCID_LIMITS.works);
    const items = (await this.store.all()).filter((i) => !i.removedFromSourceAt);
    const readAt = iso(this.now);
    await this.serial(async () => {
      const current = this.profile();
      if (current?.orcid === profile.orcid) this.save({ ...current, lastReadAt: readAt });
    });
    const name = personName(person);
    return { orcid: profile.orcid, ...(name ? { name } : {}), works: works.map((w) => ({ ...w, match: matchWork(w, items, profile.orcid) })), omitted, readAt };
  }

  confirm(body: Partial<OrcidConfirmBody> | undefined): Promise<OrcidConfirmResult> {
    return this.serial(async () => {
      const profile = this.linked();
      if (!Array.isArray(body?.putCodes)) throw new LibraryError("putCodes is required", 400);
      const wanted = [...new Set(body.putCodes.filter((c): c is number => Number.isSafeInteger(c) && c > 0))];
      if (wanted.length > ORCID_LIMITS.confirm) throw new LibraryError(`최대 ${ORCID_LIMITS.confirm}건까지 한 번에 넣을 수 있습니다.`, 413);
      const collectionId = typeof body.collectionId === "string" ? body.collectionId : undefined;
      if (collectionId && !(await this.store.collections()).some((c) => c.id === collectionId)) throw new LibraryError("Folder not found", 404);

      const { works } = parseWorks(await this.client.works(profile.orcid), ORCID_LIMITS.works);
      const byCode = new Map(works.map((w) => [w.putCode, w]));
      const markedAt = iso(this.now);
      const mark = { orcid: profile.orcid, markedAt };
      const outcomes: OrcidConfirmOutcome[] = [];
      let lookupFailed = 0;

      // Metadata for works that will become new items: DOI lookups first, then one bulk read for the rest.
      const items = (await this.store.all()).filter((i) => !i.removedFromSourceAt);
      const drafts = new Map<number, { csl: unknown; metadataOrigin: MetadataOrigin; signals: UpdateSignal[] }>();
      const needDetails: number[] = [];
      for (const code of wanted) {
        const work = byCode.get(code);
        if (!work || matchWork(work, items, profile.orcid).kind === "in-library") continue;
        if (work.doi) {
          try {
            const record = await this.lookupDoi(work.doi);
            if (normalizeDoi(record.csl.DOI) === work.doi) {
              drafts.set(code, { csl: record.csl, metadataOrigin: record.metadataOrigin, signals: record.signals.map((s) => ({ kind: s.kind, relation: s.relation, source: s.source, ...(s.doi ? { doi: s.doi } : {}), ...(s.label ? { label: s.label } : {}), ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}) })) });
              continue;
            }
          } catch { /* filled from the ORCID record below */ }
          lookupFailed++;
        }
        needDetails.push(code);
      }
      if (needDetails.length) {
        for (const work of await this.client.workDetails(profile.orcid, needDetails)) {
          const code = Number((work as { "put-code"?: unknown })["put-code"]);
          const csl = cslFromWork(work);
          if (csl && needDetails.includes(code)) drafts.set(code, { csl, metadataOrigin: "orcid", signals: [] });
        }
      }

      for (const putCode of wanted) {
        const work = byCode.get(putCode);
        if (!work) { outcomes.push({ putCode, kind: "failed", reason: "not-found" }); continue; }
        const current = (await this.store.all()).filter((i) => !i.removedFromSourceAt);
        const match = matchWork(work, current, profile.orcid);
        if (match.kind === "in-library") {
          await this.markOwn(match.itemId, { ...mark, putCode });
          outcomes.push({ putCode, kind: "marked", itemId: match.itemId });
          continue;
        }
        const draft = drafts.get(putCode);
        if (!draft) { outcomes.push({ putCode, kind: "failed", reason: "invalid" }); continue; }
        try {
          const item = await this.store.addGaidItem({ ...draft, collectionIds: collectionId ? [collectionId] : [], ownWork: { ...mark, putCode } });
          outcomes.push({ putCode, kind: "added", itemId: item.id, metadataOrigin: draft.metadataOrigin });
        } catch (error) {
          if (error instanceof LibraryError && error.status === 409) {
            // The looked-up DOI differs in form but is already in the library: mark that item.
            const doi = normalizeDoi((draft.csl as { DOI?: unknown }).DOI);
            const same = doi ? current.find((i) => normalizeDoi(i.csl.DOI) === doi) : undefined;
            if (same) { await this.markOwn(same.id, { ...mark, putCode }); outcomes.push({ putCode, kind: "marked", itemId: same.id }); continue; }
          }
          outcomes.push({ putCode, kind: "failed", reason: error instanceof LibraryError && error.status === 413 ? "library-full" : "invalid" });
        }
      }
      const added = outcomes.filter((o) => o.kind === "added").length, marked = outcomes.filter((o) => o.kind === "marked").length;
      if (added + marked) {
        const current = this.profile();
        if (current?.orcid === profile.orcid) this.save({ ...current, lastImportAt: markedAt });
      }
      return { outcomes, added, marked, failed: outcomes.length - added - marked, lookupFailed };
    });
  }

  private async markOwn(itemId: string, ownWork: NonNullable<LibraryItem["ownWork"]>) {
    await this.store.mutate(itemId, (next) => { if (!next.ownWork) next.ownWork = ownWork; });
  }
}

/** HTTP status for an ORCID failure (routes). */
export function orcidErrorStatus(error: OrcidError): number {
  return error.kind === "not-found" ? 404 : 502;
}

const services = new WeakMap<LibraryStore, OrcidService>();
export function orcidService(store: LibraryStore): OrcidService {
  let s = services.get(store);
  if (!s) { s = new OrcidService(store); services.set(store, s); }
  return s;
}
