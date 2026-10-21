import { validateSourceUrl } from "../../authoring/url-sources.ts";

export const RESPONSE_LIMIT = 4 * 1024 * 1024;

/** Shared stream bound for provider JSON/XML and publisher HTML. */
export async function boundedText(response: Response, limit = RESPONSE_LIMIT): Promise<string> {
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("Metadata response exceeds size limit");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Metadata response exceeds size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const charset = /charset=["']?([^;\s"']+)/i.exec(response.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
  return new TextDecoder(charset).decode(Buffer.concat(chunks));
}

/** Mirrors authoring's redirect/size/deadline limits; reuses its loopback/link-local validator. No persistence. */
export async function fetchPublisherHtml(value: string, fetcher: typeof fetch, timeoutMs: number) {
  if (value.length > 8192) throw new Error("URL exceeds length limit");
  const signal = AbortSignal.timeout(timeoutMs);
  let url = await validateSourceUrl(value, signal);
  for (let redirects = 0; ; redirects++) {
    const response = await fetcher(url, { signal, redirect: "manual", headers: {
      Accept: "text/html, application/xhtml+xml", "User-Agent": "GAID-metadata/1",
    } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (redirects >= 5 || !location) throw new Error("Invalid or excessive publisher redirects");
      url = await validateSourceUrl(new URL(location, url).href, signal);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Publisher HTTP ${response.status}`);
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type && !["text/html", "application/xhtml+xml"].includes(type)) {
      await response.body?.cancel();
      throw new Error("Publisher did not return HTML");
    }
    return { html: await boundedText(response), url: url.href };
  }
}
