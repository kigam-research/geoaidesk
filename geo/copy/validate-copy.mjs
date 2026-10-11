#!/usr/bin/env node
// GAID copy validator: checks Korean/English string catalogues against design/copy/copy-policy.json and
// design/copy/terminology.csv (design/copy/gaid-writing.md explains the rules).
//
//   node design/copy/validate-copy.mjs [--policy <file>] [--terms <file>] [--json] [--strict] <dir|file>...
//
// A catalogue is a directory holding one <locale>.json per policy locale (ko.json, en.json); a path that is a
// directory without them is searched recursively. Values are ICU messages; nested objects flatten to dotted ids.
// Errors (missing keys, ICU syntax, argument mismatch, blocked patterns, limit strings without a limit) exit 1;
// warnings (patterns allowed after context review, glossary variants) are printed and exit 0 unless --strict.
// The validator only reports. It never rewrites strings, and it does not lint ids marked as user data, citations,
// commands, code or research questions, or text inside backticks.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IcuSyntaxError, argumentNames, lintText, parse } from './icu-lite.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))

export function loadPolicy(file = path.join(here, 'copy-policy.json')) {
  const policy = JSON.parse(readFileSync(file, 'utf8'))
  for (const rule of policy.rules) {
    const flags = rule.flags ?? (rule.locale === 'en' || rule.locale === '*' ? 'iu' : 'u')
    rule.regexes = (rule.patterns ?? []).map((p) => new RegExp(p, flags))
  }
  return policy
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  const [header, ...body] = rows
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

// Glossary variants become warnings: { locale: [{ variant, preferred }] }.
export function loadTerms(file = path.join(here, 'terminology.csv')) {
  const out = { ko: [], en: [] }
  if (!existsSync(file)) return out
  for (const row of parseCsv(readFileSync(file, 'utf8'))) {
    for (const locale of ['ko', 'en']) {
      for (const variant of (row[`forbidden_${locale}`] ?? '').split('|').map((s) => s.trim()).filter(Boolean)) {
        out[locale].push({ variant, preferred: row[locale] })
      }
    }
  }
  return out
}

function globToRegex(glob) {
  const body = glob
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}$`)
}

function matchesAny(id, globs = []) {
  return globs.some((g) => globToRegex(g).test(id))
}

export function flatten(value, prefix = '', out = {}) {
  for (const [key, v] of Object.entries(value)) {
    const id = prefix ? `${prefix}.${key}` : key
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, id, out)
    else out[id] = v
  }
  return out
}

// Replace protected spans with spaces of equal length so no rule can match inside them.
function maskProtected(text, words) {
  let masked = text
  for (const w of words) {
    const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
    masked = masked.replace(re, (m) => ' '.repeat(m.length))
  }
  return masked
}

function isTriad(text) {
  // Three or more consecutive sentences of at most two words each ("빠르게. 정확하게. 스마트하게.").
  const sentences = text
    .split(/(?<=[.。!！])\s+|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  let run = 0
  for (const s of sentences) {
    const words = s.replace(/[.。!！]+$/, '').split(/\s+/).filter(Boolean)
    run = words.length <= 2 && /[.。!！]$/.test(s) ? run + 1 : 0
    if (run >= 3) return true
  }
  return false
}

// Lint one message. Returns findings without file/locale context.
export function lintMessage(id, message, locale, policy, terms = { ko: [], en: [] }) {
  const findings = []
  if (matchesAny(id, policy.scope.exemptIds)) return findings
  let nodes
  try {
    nodes = parse(message)
  } catch (err) {
    if (err instanceof IcuSyntaxError) {
      return [{ id, rule: 'icu-syntax', severity: 'error', message: `ICU syntax: ${err.message}` }]
    }
    throw err
  }
  let text = lintText(nodes)
  if (policy.scope.stripInlineCode) text = text.replace(/`[^`]*`/g, '◇')
  const roles = new Set(Object.entries(policy.roles).filter(([, globs]) => matchesAny(id, globs)).map(([r]) => r))
  const dialog = matchesAny(id, policy.scope.dialogIds)
  const masked = maskProtected(text, policy.protected[locale] ?? [])
  const lines = masked.split('\n').map((s) => s.trim())

  for (const rule of policy.rules) {
    if (rule.locale !== '*' && rule.locale !== locale) continue
    if (rule.roles && !rule.roles.some((r) => roles.has(r))) continue
    if (rule.skipRoles && rule.skipRoles.some((r) => roles.has(r))) continue
    if (rule.skipDialogs && dialog) continue
    const hit = rule.check === 'triad' ? isTriad(masked) : rule.regexes.some((re) => lines.some((l) => re.test(l)))
    if (hit) findings.push({ id, rule: rule.id, severity: rule.severity, message: `${rule.message}. Fix: ${rule.fix}` })
  }

  if (roles.has('limit')) {
    const markers = policy.limitMarkers[locale] ?? []
    const lower = text.toLowerCase()
    if (!markers.some((m) => lower.includes(m.toLowerCase()))) {
      findings.push({
        id,
        rule: 'limit-marker-missing',
        severity: 'error',
        message: 'Scientific-limit string no longer states a limit (estimate, not reviewed, untested, …). Keep the limit.',
      })
    }
  }

  for (const { variant, preferred } of terms[locale] ?? []) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // English variants match whole words ("demo" must not hit "demonstrate"); Korean variants match as substrings.
    const re = locale === 'en' ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'u')
    if (re.test(masked)) {
      findings.push({ id, rule: 'terminology', severity: 'warning', message: `Glossary variant "${variant}"; use "${preferred}"` })
    }
  }
  return findings
}

// Validate one catalogue directory (ko.json + en.json ...). Returns findings with locale and file.
export function validateCatalogue(dir, policy, terms) {
  const findings = []
  const catalogues = {}
  for (const locale of policy.locales) {
    const file = path.join(dir, `${locale}.json`)
    if (!existsSync(file)) {
      findings.push({ file, locale, id: '*', rule: 'missing-locale', severity: 'error', message: `missing ${locale}.json` })
      continue
    }
    let data
    try {
      data = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      findings.push({ file, locale, id: '*', rule: 'json-syntax', severity: 'error', message: err.message })
      continue
    }
    catalogues[locale] = { file, messages: flatten(data) }
  }
  const locales = Object.keys(catalogues)
  const allIds = new Set(locales.flatMap((l) => Object.keys(catalogues[l].messages)))
  const argsByLocale = {}
  for (const locale of locales) {
    const { file, messages } = catalogues[locale]
    argsByLocale[locale] = {}
    for (const id of allIds) {
      const value = messages[id]
      if (value === undefined) {
        findings.push({ file, locale, id, rule: 'missing-key', severity: 'error', message: `missing in ${locale}.json` })
        continue
      }
      if (typeof value !== 'string' || !value.trim()) {
        findings.push({ file, locale, id, rule: 'empty-message', severity: 'error', message: 'message must be a non-empty string' })
        continue
      }
      try {
        argsByLocale[locale][id] = [...argumentNames(parse(value))].sort().join(',')
      } catch {
        // reported by lintMessage as icu-syntax
      }
      for (const f of lintMessage(id, value, locale, policy, terms)) findings.push({ file, locale, ...f })
    }
  }
  if (locales.length > 1) {
    const [first, ...rest] = locales
    for (const id of allIds) {
      for (const other of rest) {
        const a = argsByLocale[first][id]
        const b = argsByLocale[other][id]
        if (a !== undefined && b !== undefined && a !== b) {
          findings.push({
            file: catalogues[other].file,
            locale: other,
            id,
            rule: 'argument-mismatch',
            severity: 'error',
            message: `arguments {${b}} differ from ${first} {${a}}`,
          })
        }
      }
    }
  }
  return findings
}

export function findCatalogueDirs(target, policy) {
  const stat = statSync(target)
  if (stat.isFile()) return [path.dirname(target)]
  const names = readdirSync(target)
  if (policy.locales.some((l) => names.includes(`${l}.json`))) return [target]
  return names
    .filter((n) => !n.startsWith('.') && n !== 'node_modules')
    .map((n) => path.join(target, n))
    .filter((p) => statSync(p).isDirectory())
    .flatMap((p) => findCatalogueDirs(p, policy))
}

function main(argv) {
  const args = [...argv]
  const take = (flag) => {
    const i = args.indexOf(flag)
    if (i < 0) return undefined
    const [, value] = args.splice(i, 2)
    return value
  }
  const policyFile = take('--policy')
  const termsFile = take('--terms')
  const json = args.includes('--json')
  const strict = args.includes('--strict')
  const targets = args.filter((a) => !a.startsWith('--'))
  if (!targets.length) {
    console.error('usage: validate-copy.mjs [--policy file] [--terms file] [--json] [--strict] <dir|file>...')
    process.exit(2)
  }
  const policy = loadPolicy(policyFile)
  const terms = loadTerms(termsFile)
  const dirs = [...new Set(targets.flatMap((t) => findCatalogueDirs(t, policy)))].sort()
  const findings = dirs.flatMap((d) => validateCatalogue(d, policy, terms))
  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  if (json) console.log(JSON.stringify({ catalogues: dirs, findings }, null, 2))
  else {
    for (const f of findings) {
      console.log(`${f.severity.toUpperCase()} ${path.relative(process.cwd(), f.file)} ${f.id}: [${f.rule}] ${f.message}`)
    }
    console.log(`copy: ${dirs.length} catalogue(s), ${errors.length} error(s), ${warnings.length} warning(s)`)
  }
  process.exit(errors.length || (strict && warnings.length) ? 1 : 0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
