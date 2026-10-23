/**
 * Locate a cited quote in source text for highlighting (gaid-authoring-evidence-view). The server verified the quote
 * with a looser rule (server/src/geo/authoring/anchors.ts); here only the place is wanted, so letters and digits are
 * compared after NFKC and case folding, ignoring spacing, punctuation and line-break hyphens. When the whole quote is not
 * found, its longer leading or trailing part is tried; `partial` then says the mark covers only part of it.
 */
const WORD = /[\p{L}\p{N}]/u;
const LIGATURES: Record<string, string> = { ﬁ: "fi", ﬂ: "fl", ﬀ: "ff", ﬃ: "ffi", ﬄ: "ffl" };

/** Letters and digits of `text`, folded, with the original offset of each. */
function fold(text: string): { key: string; at: number[] } {
  let key = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const folded = (LIGATURES[c] ?? c).normalize("NFKC").toLowerCase();
    for (const f of folded)
      if (WORD.test(f)) {
        key += f;
        at.push(i);
      }
  }
  return { key, at };
}

export interface QuoteRange {
  /** Offsets into the searched text, end exclusive. */
  start: number;
  end: number;
  partial: boolean;
}

const MIN_KEY = 6;

export function locateQuote(quote: string, text: string): QuoteRange | null {
  const q = fold(quote).key;
  if (q.length < MIN_KEY) return null;
  const t = fold(text);
  const find = (needle: string, partial: boolean): QuoteRange | null => {
    const i = t.key.indexOf(needle);
    if (i < 0) return null;
    return { start: t.at[i], end: t.at[i + needle.length - 1] + 1, partial };
  };
  const whole = find(q, false);
  if (whole) return whole;
  const part = Math.max(MIN_KEY, Math.ceil(q.length * 0.6));
  if (part >= q.length) return null;
  return find(q.slice(0, part), true) ?? find(q.slice(q.length - part), true);
}

const LINE_NUMBER = /^\s*\d{1,4}\s*$/;

/**
 * Text-layer spans (in order) that hold the quote, by index; null when it is not on the page. Manuscript line numbers
 * (spans holding only a short number) are skipped when the quote is not found with them.
 */
export interface SpanHit {
  spans: number[];
  partial: boolean;
  /** Character offset where the quote starts in the first span and ends (exclusive) in the last span. */
  from: number;
  to: number;
}

export function quoteSpans(texts: string[], quote: string): SpanHit | null {
  const search = (use: number[]): SpanHit | null => {
    const starts: number[] = [];
    let joined = "";
    for (const i of use) {
      starts.push(joined.length);
      joined += `${texts[i]} `;
    }
    const range = locateQuote(quote, joined);
    if (!range) return null;
    const hit = use.flatMap((i, k) => (starts[k] < range.end && starts[k] + texts[i].length > range.start ? [k] : []));
    if (!hit.length) return null;
    const first = hit[0];
    const last = hit[hit.length - 1];
    return {
      spans: hit.map((k) => use[k]),
      partial: range.partial,
      from: Math.max(0, range.start - starts[first]),
      to: Math.min(texts[use[last]].length, range.end - starts[last]),
    };
  };
  const all = texts.map((_, i) => i);
  const found = search(all);
  if (found && !found.partial) return found;
  const numbered = all.filter((i) => !LINE_NUMBER.test(texts[i]));
  return (numbered.length < all.length ? search(numbered) : null) ?? found;
}

/** 1-based first and last line of the quote in a text file; null when it is not there. */
export function quoteLines(text: string, quote: string): { first: number; last: number; partial: boolean } | null {
  const range = locateQuote(quote, text);
  if (!range) return null;
  const lineAt = (offset: number) => text.slice(0, offset).split("\n").length;
  return { first: lineAt(range.start), last: lineAt(range.end - 1), partial: range.partial };
}
