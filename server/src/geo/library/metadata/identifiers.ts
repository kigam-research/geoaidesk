/** Modern DOI syntax; retain balanced suffix parentheses, strip sentence punctuation. */
export function doiCandidates(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi)) {
    let doi = match[0].replace(/[.,;:]+$/, "");
    while (doi.endsWith(")") && (doi.match(/\)/g)?.length ?? 0) > (doi.match(/\(/g)?.length ?? 0))
      doi = doi.slice(0, -1).replace(/[.,;:]+$/, "");
    if (doi.endsWith("(")) doi = doi.slice(0, -1);
    doi = doi.toLowerCase();
    if (doi.split("/").slice(1).join("/") && !found.includes(doi)) found.push(doi);
  }
  return found;
}

export function normalizeDoi(input: string): string {
  const text = input.trim().replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  let decoded: string;
  try { decoded = decodeURIComponent(text); } catch { throw new Error("Invalid DOI encoding"); }
  const doi = doiCandidates(decoded)[0];
  if (!doi || doi !== decoded.toLowerCase()) throw new Error("Invalid DOI");
  return doi;
}

export function arxivCandidates(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:arxiv:\s*|arxiv\.org\/(?:abs|pdf)\/)((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?)/gi)]
    .map((m) => m[1]))];
}
