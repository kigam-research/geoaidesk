/** Opt-in only: GAID_METADATA_LIVE_SMOKE=1 npx tsx src/geo/library/metadata/live-smoke.ts [external-output-dir] */
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configureHttpProxy } from "../../../http-proxy.ts";
import { createMetadataClient } from "./index.ts";

if (process.env.GAID_METADATA_LIVE_SMOKE !== "1") throw new Error("Set GAID_METADATA_LIVE_SMOKE=1 to allow live requests");
configureHttpProxy();
const output = process.argv[2] ? resolve(process.argv[2]) : undefined;
const checkout = fileURLToPath(new URL("../../../../../", import.meta.url));
if (output) {
  const path = relative(checkout, output);
  if (!path || (!path.startsWith("..") && !isAbsolute(path))) throw new Error("Smoke outputs must be outside the checkout");
}
if (output) await mkdir(output, { recursive: true });
const client = createMetadataClient({ fetch: async (url, init) => {
  const response = await fetch(url, init);
  if (output && response.ok) {
    const u = new URL(String(url));
    // Fixture captures omit credential-bearing URLs and retain response data only.
    const name = `${u.hostname.includes("crossref") ? "crossref" : "openalex"}-${u.pathname.includes("nphys1170") ? "nphys1170" : "pone0000308"}.json`;
    await writeFile(`${output}/${name}`, await response.clone().text());
  }
  return response;
} });
for (const doi of ["10.1038/nphys1170", "10.1371/journal.pone.0000308"]) {
  for (const provider of ["crossref", "openalex"] as const) {
    try {
      const result = await client.lookupDoi(doi, provider);
      console.log(JSON.stringify({ doi, provider, ok: true, title: result.csl.title, metadataConfirmed: result.metadataConfirmed, signals: result.signals }));
    } catch (e) { console.log(JSON.stringify({ doi, provider, ok: false, error: String(e) })); process.exitCode = 1; }
  }
}
