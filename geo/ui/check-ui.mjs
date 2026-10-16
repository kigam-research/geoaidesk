#!/usr/bin/env node
// GAID UI guide checks (docs/design/ui-guide.md, rules in geo/ui/ui-rules.json).
//
//   node geo/ui/check-ui.mjs [--rules <file>] [--baseline <file>] [--root <repo>] [--json] [--list-debt]
//
// Three static checks, each a proxy for a guide rule that a reviewer still judges on screen:
//   copy-length   locale strings longer than their role's limit (guide "Information density")
//   internals     researcher-facing strings that interpolate raw errors, model names or internal ids
//                 (guide "What researchers never see")
//   styles        hard-coded colours and text smaller than the type scale in GAID components (guide "Tokens")
// Findings recorded in geo/ui/ui-baseline.json are accepted debt: they are counted, not failed. A new finding
// fails; a baseline entry that no longer occurs is reported so the baseline can shrink. The script only reports.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '../copy/icu-lite.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

export function globRegex(glob) {
  return new RegExp(`^${glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
}

const matcher = (globs = []) => {
  const regexes = globs.map(globRegex)
  return (value) => regexes.some((re) => re.test(value))
}

export function flatten(object, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const id = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[id] = value
    else if (value && typeof value === 'object') flatten(value, id, out)
  }
  return out
}

// Visible length over the ICU tree (geo/copy/icu-lite.mjs): a simple argument counts as `argumentChars`, `#` as two
// digits, and a plural/select block as its longest branch, so the limit applies to what a reader sees, not to ICU syntax.
// A message the parser rejects is measured raw (the copy validator reports the syntax error).
export function visibleLength(message, argumentChars = 4) {
  const measure = (nodes) => nodes.reduce((sum, node) => {
    if (node.type === 'text') return sum + node.value.length
    if (node.type === 'pound') return sum + 2
    if (node.branches) return sum + Math.max(0, ...Object.values(node.branches).map(measure))
    return sum + argumentChars
  }, 0)
  try {
    return measure(parse(message))
  } catch {
    return message.length
  }
}

export function loadCatalogues(dir, locales) {
  const out = []
  for (const name of readdirSync(dir).sort()) {
    const folder = path.join(dir, name)
    if (!statSync(folder).isDirectory()) continue
    for (const locale of locales) {
      const file = path.join(folder, `${locale}.json`)
      if (!existsSync(file)) continue
      const strings = flatten(JSON.parse(readFileSync(file, 'utf8')), name)
      for (const [id, text] of Object.entries(strings)) out.push({ id, locale, text })
    }
  }
  return out
}

export function checkCopyLength(strings, rules) {
  const { roles, argumentChars, exemptIds } = rules.copyLength
  const exempt = matcher(exemptIds)
  const ordered = roles.map((role) => ({ ...role, match: matcher(role.ids) }))
  const findings = []
  for (const { id, locale, text } of strings) {
    if (exempt(id)) continue
    const role = ordered.find((r) => r.match(id))
    const max = role?.max?.[locale]
    if (!max) continue
    const length = visibleLength(text, argumentChars)
    if (length > max) findings.push({ check: 'copy-length', key: `${locale}:${id}`, detail: `${role.id} ${length}/${max}` })
  }
  return findings
}

export function checkInternals(strings, rules) {
  const { surfaces, forbiddenArguments, allowedIds, forbiddenText } = rules.internals
  const allowed = matcher(allowedIds)
  const researcherFacing = matcher(surfaces)
  const findings = []
  for (const { id, locale, text } of strings) {
    if (!researcherFacing(id) || allowed(id)) continue
    const args = [...text.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1])
    const raw = args.filter((name) => forbiddenArguments.includes(name))
    const words = (forbiddenText[locale] ?? []).filter((word) => new RegExp(word, 'i').test(text))
    if (raw.length || words.length) findings.push({ check: 'internals', key: `${locale}:${id}`, detail: [...raw.map((a) => `{${a}}`), ...words].join(' ') })
  }
  return findings
}

function walk(dir, extensions, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) walk(file, extensions, out)
    else if (extensions.some((ext) => name.endsWith(ext))) out.push(file)
  }
  return out
}

export function checkStyles(root, rules) {
  const { roots, extensions, skipFiles, hexAllowFiles, minFontPx } = rules.styles
  const skip = matcher(skipFiles)
  const hexAllowed = matcher(hexAllowFiles)
  const findings = []
  for (const base of roots) {
    for (const file of walk(path.join(root, base), extensions)) {
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (skip(rel)) continue
      const source = readFileSync(file, 'utf8')
      if (!hexAllowed(rel)) {
        const hexes = new Set(source.match(/(?<![\w&])#[0-9a-fA-F]{6}\b|(?<![\w&])#[0-9a-fA-F]{3}\b(?![-\w])/g) ?? [])
        for (const hex of hexes) findings.push({ check: 'styles', key: `${rel}:${hex.toLowerCase()}`, detail: 'hard-coded colour; use a token' })
      }
      for (const m of source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        if (Number(m[1]) < minFontPx) findings.push({ check: 'styles', key: `${rel}:text-[${m[1]}px]`, detail: `text below ${minFontPx}px` })
      }
    }
  }
  return [...new Map(findings.map((f) => [f.key, f])).values()]
}

export function run({ root, rules, baseline }) {
  const strings = loadCatalogues(path.join(root, rules.locales.dir), rules.locales.locales)
  const findings = [...checkCopyLength(strings, rules), ...checkInternals(strings, rules), ...checkStyles(root, rules)]
  const accepted = new Set(Object.entries(baseline.debt ?? {}).flatMap(([check, keys]) => keys.map((key) => `${check}|${key}`)))
  const seen = new Set(findings.map((f) => `${f.check}|${f.key}`))
  return {
    strings: strings.length,
    failures: findings.filter((f) => !accepted.has(`${f.check}|${f.key}`)),
    debt: findings.filter((f) => accepted.has(`${f.check}|${f.key}`)),
    resolved: [...accepted].filter((key) => !seen.has(key)),
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
  const root = path.resolve(option('--root', path.join(here, '..', '..')))
  const rules = JSON.parse(readFileSync(option('--rules', path.join(here, 'ui-rules.json')), 'utf8'))
  const baseline = JSON.parse(readFileSync(option('--baseline', path.join(here, 'ui-baseline.json')), 'utf8'))
  const result = run({ root, rules, baseline })
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2))
  else {
    for (const f of result.failures) console.log(`error ${f.check} ${f.key} — ${f.detail}`)
    if (args.includes('--list-debt')) for (const f of result.debt) console.log(`debt  ${f.check} ${f.key} — ${f.detail}`)
    for (const key of result.resolved) console.log(`resolved (remove from geo/ui/ui-baseline.json): ${key}`)
    console.log(`ui: ${result.strings} strings, ${result.failures.length} error(s), ${result.debt.length} accepted debt, ${result.resolved.length} resolved`)
    if (result.failures.length) console.log('Fix the finding (docs/design/ui-guide.md). Record accepted debt in geo/ui/ui-baseline.json only with the reason in your change report.')
  }
  process.exit(result.failures.length ? 1 : 0)
}
