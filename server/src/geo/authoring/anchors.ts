/**
 * Server-side anchor verification: a model may only cite a page or file it was given, and the quoted words must be
 * found there. Existence of the quote does not prove the claim; researchers still read the source.
 */
const LIGATURES: Record<string, string> = { ﬁ: 'fi', ﬂ: 'fl', ﬀ: 'ff', ﬃ: 'ffi', ﬄ: 'ffl' }

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ﬁﬂﬀﬃﬄ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/-\s*\n\s*/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

const compact = (s: string) => s.replace(/[\s"'`.,;:()[\]{}-]/g, '')
const tokens = (s: string) => s.split(/[^\p{L}\p{N}.%=<>±-]+/u).filter((t) => t.length > 0)

/**
 * True when the quote occurs in the text: exactly after normalization, ignoring spacing and punctuation (PDF layout
 * text), or as a contiguous run covering at least 80% of the quote's tokens (line breaks inside tables and columns).
 */
export function quoteFound(quote: string, text: string): boolean {
  const q = normalize(quote)
  if (q.length < 8) return false
  const t = normalize(text)
  if (t.includes(q)) return true
  const cq = compact(q)
  if (cq.length >= 8 && compact(t).includes(cq)) return true
  const qt = tokens(q)
  if (qt.length < 4) return false
  const tt = tokens(t)
  const need = Math.ceil(qt.length * 0.8)
  // Longest common contiguous token run (dynamic programming over a bounded quote length).
  let best = 0
  let prev = new Array<number>(qt.length + 1).fill(0)
  for (let i = 1; i <= tt.length; i++) {
    const cur = new Array<number>(qt.length + 1).fill(0)
    for (let j = 1; j <= qt.length; j++)
      if (tt[i - 1] === qt[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best) best = cur[j]
      }
    if (best >= need) return true
    prev = cur
  }
  return false
}

const LINE_NUMBER = /^\s*\d{1,4}(?:\s{2,}|\t)/
/**
 * Manuscripts often carry line numbers ("18    surfaces to ..."). When most text lines start with one, strip them so
 * sentences that cross lines can be read and quoted. The stored page text stays unchanged.
 */
export function readablePage(text: string): string {
  const lines = text.split('\n')
  const content = lines.filter((l) => l.trim())
  if (!content.length || content.filter((l) => LINE_NUMBER.test(l)).length < content.length * 0.4)
    return text
  return lines.map((l) => l.replace(LINE_NUMBER, '')).join('\n')
}
