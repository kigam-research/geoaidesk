import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pdftotextVersion } from "../../authoring/sources.ts";
import { arxivCandidates, doiCandidates } from "./identifiers.ts";

const exec = promisify(execFile);
export interface PdfIdentification {
  doiCandidates: string[];
  arxivIds: string[];
  titleGuess?: string;
  textFound: boolean;
  pagesRead: number[];
  emptyPages: number[];
  tool: string;
  error?: string;
}

/** Same Poppler/version helper as authoring, but no authoring store writes or whole-document extraction. */
export async function identifyPdf(file: string): Promise<PdfIdentification> {
  const result: PdfIdentification = {
    doiCandidates: [], arxivIds: [], textFound: false, pagesRead: [], emptyPages: [],
    tool: `pdftotext ${(await pdftotextVersion()) ?? "unavailable"}`,
  };
  const texts: string[] = [];
  try {
    const { stdout: info } = await exec("pdfinfo", [file], { timeout: 30_000, maxBuffer: 128 * 1024 });
    const pages = Math.min(3, Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0));
    if (!pages) throw new Error("PDF page count unavailable");
    for (let page = 1; page <= pages; page++) {
      const { stdout } = await exec("pdftotext", ["-f", `${page}`, "-l", `${page}`, "-layout", "-enc", "UTF-8", file, "-"],
        { timeout: 30_000, maxBuffer: 512 * 1024 });
      const text = stdout.replace(/\f/g, "").trim();
      texts.push(text);
      result.pagesRead.push(page);
      if (!text) result.emptyPages.push(page);
    }
  } catch {
    result.error = "PDF identification failed; check the file and Poppler availability";
  }
  result.textFound = texts.some(Boolean);
  result.doiCandidates = doiCandidates(texts.join("\n"));
  result.arxivIds = arxivCandidates(texts.join("\n"));
  // Deliberately a guess, not accepted metadata. Do not infer from a scanned PDF's properties.
  result.titleGuess = (texts[0] ?? "").split("\n").map((s) => s.trim())
    .find((s) => s.length >= 12 && s.length <= 300 && !/^(?:doi\b|arxiv\b|https?:|\d+$)/i.test(s));
  return result;
}
