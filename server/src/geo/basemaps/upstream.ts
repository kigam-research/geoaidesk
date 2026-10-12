import { BasemapError } from "./providers.ts";

const paths: Record<string, string> = { "map.ngii.go.kr": "/openapi/Gettile.do", "data.kigam.re.kr": "/openapi/wms" };
const MAX_BYTES = 4 * 1024 * 1024;
export const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 GeoAIDesk";
export function validateUpstream(url: URL): void {
  if (url.protocol !== "https:" || url.username || url.password || url.port || paths[url.hostname] !== url.pathname) {
    throw new BasemapError(400, "Basemap upstream is not allowed.");
  }
}
export function redactBasemapUrl(url: string): string {
  return url.replace(/([?&](?:apikey|key)=)[^&#]*/gi, "$1[redacted]");
}
export async function fetchImage(url: URL, headers: Record<string, string>, fetcher: typeof fetch = globalThis.fetch, pngOnly = false) {
  validateUpstream(url);
  try {
    const response = await fetcher(url, { headers, redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new BasemapError(502, `Basemap upstream returned HTTP ${response.status}.`);
    }
    if (Number(response.headers.get("content-length")) > MAX_BYTES) {
      await response.body?.cancel();
      throw new BasemapError(502, "Basemap image exceeds the response limit.");
    }
    if (!response.body) throw new BasemapError(502, "Basemap upstream returned no image.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new BasemapError(502, "Basemap image exceeds the response limit.");
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const body = Buffer.concat(chunks, size);
    const png = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = body.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!((png && type === "image/png") || (!pngOnly && jpeg && ["image/jpeg", "image/jpg"].includes(type)))) {
      throw new BasemapError(502, "Basemap upstream returned an invalid image.");
    }
    return { body, type };
  } catch (error) {
    if (error instanceof BasemapError) throw error;
    // Never expose fetch errors, URLs, upstream bodies, or headers containing credentials.
    throw new BasemapError(502, "Basemap upstream request failed or timed out.");
  }
}
