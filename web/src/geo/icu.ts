/**
 * ICU message formatting for the GAID locale catalogues: the subset the WP00
 * copy validator (geo/copy/validate-copy.mjs) accepts — `{name}`,
 * `{name, number}`, `{name, plural|selectordinal, =N {…} one {…} other {…}}`
 * with `#`, `{name, select, …}` and apostrophe quoting.
 *
 * Ported from skill_hub web/shared/site-copy.ts (commit 63cbdad22f), the
 * formatter of the C site catalogues, so app and site format identically.
 */
export type MessageValues = Record<string, string | number>;

type Node =
  | { type: 'text'; value: string }
  | { type: 'pound' }
  | { type: 'argument'; name: string; kind?: string }
  | { type: 'branch'; kind: string; name: string; offset: number; branches: Record<string, Node[]> }

function parse(message: string): Node[] {
  let i = 0
  const fail = (why: string): never => {
    throw new Error(`ICU message: ${why} at offset ${i} in "${message}"`)
  }
  const space = () => {
    while (i < message.length && /\s/.test(message[i])) i++
  }
  const ident = () => {
    space()
    const start = i
    while (i < message.length && /[\p{L}\p{N}_=:-]/u.test(message[i])) i++
    if (i === start) fail('expected a name')
    return message.slice(start, i)
  }
  const nodes = (nested: boolean, inPlural: boolean): Node[] => {
    const out: Node[] = []
    let text = ''
    const flush = () => {
      if (text) out.push({ type: 'text', value: text })
      text = ''
    }
    while (i < message.length) {
      const ch = message[i]
      if (ch === "'" && message[i + 1] === "'") {
        text += "'"
        i += 2
      } else if (ch === "'" && (message[i + 1] === '{' || message[i + 1] === '}' || (inPlural && message[i + 1] === '#'))) {
        const end = message.indexOf("'", i + 1)
        if (end < 0) fail('unterminated quote')
        text += message.slice(i + 1, end)
        i = end + 1
      } else if (ch === '{') {
        flush()
        i++
        out.push(argument())
      } else if (ch === '}') {
        if (!nested) fail('unmatched }')
        flush()
        return out
      } else if (ch === '#' && inPlural) {
        flush()
        out.push({ type: 'pound' })
        i++
      } else {
        text += ch
        i++
      }
    }
    if (nested) fail('missing }')
    flush()
    return out
  }
  const argument = (): Node => {
    const name = ident()
    space()
    if (message[i] === '}') {
      i++
      return { type: 'argument', name }
    }
    if (message[i] !== ',') fail('expected , or }')
    i++
    const kind = ident()
    space()
    if (kind === 'number' || kind === 'date' || kind === 'time') {
      while (i < message.length && message[i] !== '}') i++
      i++
      return { type: 'argument', name, kind }
    }
    if (kind !== 'plural' && kind !== 'selectordinal' && kind !== 'select') fail(`unknown type ${kind}`)
    if (message[i] !== ',') fail('expected ,')
    i++
    let offset = 0
    space()
    if (message.startsWith('offset:', i)) {
      i += 'offset:'.length
      offset = Number(ident())
    }
    const branches: Record<string, Node[]> = {}
    for (;;) {
      space()
      if (message[i] === '}') {
        i++
        break
      }
      if (i >= message.length) fail('missing }')
      const key = ident()
      space()
      if (message[i] !== '{') fail('expected {')
      i++
      branches[key] = nodes(true, kind !== 'select')
      i++
    }
    if (!branches.other) fail(`${kind} needs other`)
    return { type: 'branch', kind, name, offset, branches }
  }
  return nodes(false, false)
}

const parsed = new Map<string, Node[]>()

export function formatMessage(message: string, locale: string, values: MessageValues = {}): string {
  let tree = parsed.get(message)
  if (!tree) {
    tree = parse(message)
    parsed.set(message, tree)
  }
  const render = (list: Node[], pound?: number): string =>
    list
      .map((node) => {
        if (node.type === 'text') return node.value
        if (node.type === 'pound') return pound === undefined ? '#' : new Intl.NumberFormat(locale).format(pound)
        const value = values[node.name]
        if (value === undefined) throw new Error(`missing value {${node.name}} for "${message}"`)
        if (node.type === 'argument') {
          return node.kind === 'number' && typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : String(value)
        }
        if (node.kind === 'select') return render(node.branches[String(value)] ?? node.branches.other)
        const n = Number(value)
        const exact = node.branches[`=${n}`]
        if (exact) return render(exact, n - node.offset)
        const category = new Intl.PluralRules(locale, { type: node.kind === 'selectordinal' ? 'ordinal' : 'cardinal' }).select(
          n - node.offset,
        )
        return render(node.branches[category] ?? node.branches.other, n - node.offset)
      })
      .join('')
  return render(tree)
}
