import type { CslItem, CslName } from "../../../../../web/src/geo/contracts/library.ts";
import { plain } from "../metadata/mapping.ts";
import { yearOf } from "./common.ts";

function ascii(value: string): string {
  return value.replace(/[øØ]/g, "o").replace(/[łŁ]/g, "l").replace(/ß/g, "ss").replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe").replace(/[ðÐ]/g, "d").replace(/[þÞ]/g, "th")
    .normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
}

/** No Korean romanisation dependency: use supplied Latin family/name, else `ref`; never guess "Kim". */
export function citationKeyFor(csl: CslItem, taken: ReadonlySet<string> | readonly string[] = []): string {
  const n = csl.author?.[0];
  const literalParts = n?.literal?.trim().split(/\s+/);
  const family = n?.family || literalParts?.at(-1) || "";
  const base = `${ascii(family) || ascii(n?.given || "") || "ref"}${yearOf(csl) ?? "nd"}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 0; ; i++) {
    let number = i, suffix = "";
    do { suffix = String.fromCharCode(97 + number % 26) + suffix; number = Math.floor(number / 26) - 1; } while (number >= 0);
    if (!used.has(base + suffix)) return base + suffix;
  }
}

function authorName(n: CslName, locale: "ko" | "en"): string {
  if (n.literal) return plain(n.literal);
  if (locale === "ko" && /[가-힣]/.test(`${n.family}${n.given}`)) return plain(`${n.family || ""}${n.given || ""}`);
  const initials = plain(n.given).split(/[\s-]+/).filter(Boolean).map((s) => `${[...s][0]}.`).join(" ");
  return [plain(n.family), initials].filter(Boolean).join(", ");
}

/** Plain APA-like line, not a CSL processor or a guarantee of full APA compliance. */
export function formatReference(csl: CslItem, locale: "ko" | "en"): string {
  const authors = (csl.author ?? []).map((n) => authorName(n, locale)).filter(Boolean);
  const author = authors.length > 1 ? `${authors.slice(0, -1).join(", ")}${locale === "en" ? ", & " : ", "}${authors.at(-1)}` : authors[0];
  const date = yearOf(csl) ?? (locale === "ko" ? "연도 미상" : "n.d.");
  const source = [plain(csl["container-title"]),
    `${plain(csl.volume)}${csl.issue ? `(${plain(csl.issue)})` : ""}`, plain(csl.page)].filter(Boolean).join(", ") || plain(csl.publisher);
  const link = csl.DOI ? `https://doi.org/${plain(csl.DOI).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : plain(csl.URL);
  return [author ? `${author} (${date}).` : `(${date}).`, `${plain(csl.title).replace(/[.。]$/, "")}.`,
    source ? `${source.replace(/[.]$/, "")}.` : "", link].filter(Boolean).join(" ");
}
