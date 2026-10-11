// Minimal ICU MessageFormat parser for GAID string catalogues (dependency-free).
// Supports literal text, `{name}`, `{name, number|date|time[, style]}`, `{name, plural|selectordinal, …}` with
// `=N`/category branches and `#`, `{name, select, …}`, and apostrophe quoting (`''`, `'{…}'`).
// parse() throws IcuSyntaxError on malformed input; argumentNames() and lintText() read the resulting tree.

export class IcuSyntaxError extends Error {}

const SIMPLE_TYPES = new Set(['number', 'date', 'time'])
const BRANCH_TYPES = new Set(['plural', 'selectordinal', 'select'])

export function parse(message) {
  let i = 0
  const fail = (why) => {
    throw new IcuSyntaxError(`${why} at offset ${i}`)
  }

  function skipSpace() {
    while (i < message.length && /\s/.test(message[i])) i++
  }

  function readIdent() {
    skipSpace()
    const start = i
    while (i < message.length && /[\p{L}\p{N}_=-]/u.test(message[i])) i++
    if (i === start) fail('expected a name')
    return message.slice(start, i)
  }

  // Reads nodes until `}` (when nested) or end of input.
  function readNodes(nested, inPlural) {
    const nodes = []
    let text = ''
    const flush = () => {
      if (text) nodes.push({ type: 'text', value: text })
      text = ''
    }
    while (i < message.length) {
      const ch = message[i]
      if (ch === "'") {
        if (message[i + 1] === "'") {
          text += "'"
          i += 2
          continue
        }
        // Quoted literal only when the quote starts a syntax character; otherwise a plain apostrophe.
        if (message[i + 1] === '{' || message[i + 1] === '}' || (inPlural && message[i + 1] === '#')) {
          const end = message.indexOf("'", i + 1)
          if (end < 0) fail('unterminated quote')
          text += message.slice(i + 1, end)
          i = end + 1
          continue
        }
        text += ch
        i++
        continue
      }
      if (ch === '{') {
        flush()
        i++
        nodes.push(readArgument())
        continue
      }
      if (ch === '}') {
        if (!nested) fail('unmatched }')
        flush()
        return nodes
      }
      if (ch === '#' && inPlural) {
        flush()
        nodes.push({ type: 'pound' })
        i++
        continue
      }
      text += ch
      i++
    }
    if (nested) fail('missing }')
    flush()
    return nodes
  }

  function readArgument() {
    const name = readIdent()
    skipSpace()
    if (message[i] === '}') {
      i++
      return { type: 'argument', name }
    }
    if (message[i] !== ',') fail(`expected , or } after "${name}"`)
    i++
    const kind = readIdent()
    skipSpace()
    if (SIMPLE_TYPES.has(kind)) {
      if (message[i] === ',') {
        i++
        const start = i
        while (i < message.length && message[i] !== '}') {
          if (message[i] === '{') fail('unexpected { in style')
          i++
        }
        if (!message.slice(start, i).trim()) fail('empty style')
      }
      skipSpace()
      if (message[i] !== '}') fail(`expected } after ${kind}`)
      i++
      return { type: 'argument', name, kind }
    }
    if (!BRANCH_TYPES.has(kind)) fail(`unknown argument type "${kind}"`)
    if (message[i] !== ',') fail(`expected , after ${kind}`)
    i++
    const branches = {}
    skipSpace()
    if (kind !== 'select' && message.startsWith('offset:', i)) {
      i += 'offset:'.length
      readIdent()
    }
    for (;;) {
      skipSpace()
      if (message[i] === '}') {
        i++
        break
      }
      if (i >= message.length) fail('missing } after branches')
      const key = readIdent()
      skipSpace()
      if (message[i] !== '{') fail(`expected { after branch "${key}"`)
      if (key in branches) fail(`duplicate branch "${key}"`)
      i++
      branches[key] = readNodes(true, kind !== 'select')
      i++ // closing }
    }
    if (!('other' in branches)) fail(`${kind} needs an "other" branch`)
    return { type: kind, name, branches }
  }

  return readNodes(false, false)
}

export function argumentNames(nodes, out = new Set()) {
  for (const node of nodes) {
    if (node.type === 'argument') out.add(node.name)
    if (node.branches) {
      out.add(node.name)
      for (const branch of Object.values(node.branches)) argumentNames(branch, out)
    }
  }
  return out
}

// Literal text for linting: placeholders become a neutral mark, every branch is kept on its own line.
export function lintText(nodes) {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.value
      if (node.type === 'argument' || node.type === 'pound') return '◇'
      return Object.values(node.branches).map(lintText).join('\n')
    })
    .join('')
}
