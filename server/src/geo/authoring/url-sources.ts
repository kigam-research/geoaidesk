/** Bounded URL intake. The configured global fetch dispatcher retains institutional proxy support. */
import { addAbortListener } from "node:events";
import { lookup } from "node:dns/promises";
import { isIP, BlockList } from "node:net";
import { Parser } from "htmlparser2";
import type {
  AddUrlSourceBody,
  ExtractionRecord,
  SourceDocument,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { extractPdf, figureCaptions, pageFile, sha256, SOURCE_LIMIT_BYTES } from "./sources.ts";
import { AuthoringError, newId, now, type AuthoringStore } from "./store.ts";

const blocked = new BlockList();
blocked.addSubnet("127.0.0.0", 8, "ipv4");
blocked.addSubnet("169.254.0.0", 16, "ipv4");
blocked.addAddress("0.0.0.0", "ipv4");
blocked.addAddress("::", "ipv6");
blocked.addAddress("::1", "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");

async function withinDeadline<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  let listener: ReturnType<typeof addAbortListener> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        listener = addAbortListener(signal, () => reject(signal.reason));
      }),
    ]);
  } finally {
    listener?.[Symbol.dispose]();
  }
}

export async function validateSourceUrl(value: string, signal?: AbortSignal): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthoringError("URL 형식을 확인해 주세요.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new AuthoringError("http 또는 https URL만 받을 수 있습니다.");
  if (url.username || url.password) throw new AuthoringError("인증 정보가 포함된 URL은 받을 수 없습니다.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const allow = (process.env.GAID_URL_SOURCE_ALLOW || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (allow.includes(host)) return url;
  const addresses = isIP(host) ? [{ address: host }] : await withinDeadline(lookup(host, { all: true }), signal);
  if (
    !addresses.length ||
    addresses.some(({ address }) => blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4"))
  )
    throw new AuthoringError("루프백 또는 링크 로컬 주소에서는 자료를 가져올 수 없습니다.");
  return url;
}

/** No scripts, styles, navigation or image/page crops. Headings and paragraphs retain boundaries. */
export function readableHtml(html: string): { title: string; text: string } {
  const skip = new Set(["script", "style", "nav", "noscript", "template", "svg", "header", "footer"]);
  const breaks = new Set([
    "p",
    "div",
    "section",
    "article",
    "main",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "br",
    "tr",
  ]);
  const stack: { tag: string; skip: boolean }[] = [];
  const out: string[] = [];
  let title = "";
  let inTitle = false;
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        const hidden = stack.at(-1)?.skip || skip.has(tag) || "hidden" in attrs || attrs["aria-hidden"] === "true";
        stack.push({ tag, skip: !!hidden });
        if (tag === "title") inTitle = true;
        if (!hidden && breaks.has(tag)) out.push("\n\n");
      },
      ontext(text) {
        if (inTitle) title += text;
        else if (!stack.at(-1)?.skip && !stack.some((x) => x.tag === "head")) out.push(text);
      },
      onclosetag(tag) {
        const entry = stack.pop();
        if (tag === "title") inTitle = false;
        if (!entry?.skip && breaks.has(tag)) out.push("\n\n");
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  return {
    title: title.replace(/\s+/g, " ").trim().slice(0, 200),
    text: out
      .join("")
      .replace(/[\t \r]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export interface UrlSourceOptions {
  limitBytes?: number;
  timeoutMs?: number;
}

export async function addUrlSource(
  store: AuthoringStore,
  projectId: string,
  body: AddUrlSourceBody,
  options: UrlSourceOptions = {},
) {
  if (
    !body ||
    typeof body.url !== "string" ||
    !body.url.trim() ||
    body.url.length > 8192 ||
    !["paper", "blog", "search"].includes(body.kind)
  )
    throw new AuthoringError("URL과 자료 종류를 확인해 주세요.");
  await store.read(projectId);
  // Never persist credentials, even for a refused URL.
  let requested = body.url.trim();
  try {
    const u = new URL(requested);
    if (u.username || u.password) {
      u.username = "";
      u.password = "";
      requested = u.href;
    }
  } catch {
    /* failure recorded below */
  }
  const source: SourceDocument = {
    id: newId("src"),
    kind: "web",
    name: "웹 자료",
    mediaType: "text/html",
    sha256: sha256(Buffer.alloc(0)),
    size: 0,
    addedAt: now(),
    status: "received",
    documentKind: body.kind,
    url: requested,
    fetch: { requestedUrl: requested, fetchedAt: now() },
  };
  let extraction: ExtractionRecord = {
    sourceId: source.id,
    sourceSha256: source.sha256,
    tool: "htmlparser2",
    coveredPages: [],
    emptyPages: [],
    figures: [],
    characters: 0,
    at: now(),
  };
  const signal = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  let response: Response | undefined;
  try {
    let url = await validateSourceUrl(body.url.trim(), signal);
    for (let redirects = 0; ; redirects++) {
      signal.throwIfAborted();
      response = await fetch(url, {
        signal,
        redirect: "manual",
        headers: {
          Accept: "text/html, application/pdf, text/plain;q=0.8",
          "User-Agent": "GAID-source-reader/1",
        },
      });
      source.fetch!.finalUrl = url.href;
      source.fetch!.status = response.status;
      source.url = url.href;
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects >= 5) throw new AuthoringError("URL 이동 횟수가 5회를 넘었습니다.");
        const location = response.headers.get("location");
        if (!location) throw new AuthoringError("이동할 URL을 찾지 못했습니다.");
        url = await validateSourceUrl(new URL(location, url).href, signal);
        continue;
      }
      if (!response.ok) throw new AuthoringError(`웹 서버가 자료를 제공하지 않았습니다 (HTTP ${response.status}).`);
      break;
    }
    const limit = Math.min(options.limitBytes ?? SOURCE_LIMIT_BYTES, SOURCE_LIMIT_BYTES);
    if (Number(response.headers.get("content-length")) > limit)
      throw new AuthoringError("웹 자료는 30 MiB 이하만 받을 수 있습니다.");
    const chunks: Uint8Array[] = [];
    const reader = response.body?.getReader();
    let size = 0;
    if (reader)
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw new AuthoringError("웹 자료는 30 MiB 이하만 받을 수 있습니다.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    const bytes = Buffer.concat(chunks);
    source.size = bytes.length;
    source.sha256 = sha256(bytes);
    source.fetch!.contentHash = source.sha256;
    source.mediaType = (response.headers.get("content-type") || "text/html").split(";")[0].trim().toLowerCase();
    const original = await store.writeFile(projectId, `sources/${source.id}/original`, bytes);
    if (source.mediaType === "application/pdf") {
      source.kind = "pdf";
      source.name = "웹 논문.pdf";
      extraction.tool = "pdftotext";
      extraction = await extractPdf(store, projectId, source, original);
    } else {
      if (!["text/html", "application/xhtml+xml", "text/plain"].includes(source.mediaType))
        throw new AuthoringError("PDF, HTML 또는 텍스트 자료만 읽을 수 있습니다.");
      const charset = /charset=["']?([^;\s"']+)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
      const content = new TextDecoder(charset).decode(bytes);
      const parsed = source.mediaType === "text/plain" ? { title: "", text: content } : readableHtml(content);
      source.title = parsed.title || undefined;
      source.name = parsed.title || "웹 자료";
      extraction.sourceSha256 = source.sha256;
      extraction.pages = Math.max(1, Math.ceil(parsed.text.length / 32_000));
      for (let page = 1; page <= extraction.pages; page++) {
        const text = parsed.text.slice((page - 1) * 32_000, page * 32_000);
        await store.writeFile(projectId, pageFile(source.id, page), text);
        if (text.trim()) extraction.coveredPages.push(page);
        else extraction.emptyPages.push(page);
        extraction.characters += text.length;
        extraction.figures.push(...figureCaptions(page, text));
      }
      if (!extraction.characters) extraction.error = "웹 자료에서 본문을 읽지 못했습니다.";
    }
  } catch (error) {
    extraction.error =
      error instanceof AuthoringError
        ? error.message
        : signal.aborted
          ? "웹 자료를 30초 안에 가져오지 못했습니다."
          : "웹 자료를 가져오거나 읽지 못했습니다. URL과 서버 연결을 확인해 주세요.";
  } finally {
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
  extraction.sourceSha256 = source.sha256;
  source.fetch!.fetchedAt = now();
  source.status = extraction.characters ? (extraction.error ? "partial" : "extracted") : "failed";
  await store.mutate(projectId, (p) => {
    p.sources.push(source);
    p.extractions[source.id] = extraction;
    p.sourceRevision++;
    if (p.title === "새 방법" && p.sources.length === 1) p.title = (source.title || source.name).slice(0, 120);
  });
  return { source, extraction };
}
