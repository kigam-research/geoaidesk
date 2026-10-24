#!/usr/bin/env node
// GAID UI quality kit (gaid-ui-quality-kit; settings in geo/ui/ui-rules.json "quality", guide docs/design/ui-guide.md).
//
//   node geo/ui/quality/run.mjs [--only shadcnLint,impeccable,visual,axe] [--update-baseline] [--out <dir>] [--json]
//
// Four tools, each mapped onto UI guide v2 rule ids:
//   shadcnLint  @shadcn/lint (MIT) over the GAID primary-path sources (the check-ui slop roots)
//   impeccable  impeccable detect (Apache-2.0): the regex rules over the same sources, and the live detector over each page
//               and screen combination through CDP; telemetry off (DO_NOT_TRACK=1, IMPECCABLE_NO_TELEMETRY=1)
//   visual      Playwright full-page screenshots of each page in 계측/도폭 × light/dark at 1440×900 against
//               geo/ui/quality/baseline/ (pages are served by `next dev`)
//   axe         axe-core on the same pages and combinations
// A tool in "report" mode prints its findings and never fails; in "block" mode a finding that is not accepted debt in
// geo/ui/ui-baseline.json quality.<tool> fails the run. A tool that cannot run is reported as skipped. The switch rule
// from report to block is ui-rules.json quality.switchRule. Install the tools with `npm ci` in geo/ui/quality/.
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..", "..")
const web = path.join(root, "web")
const allRules = JSON.parse(readFileSync(path.join(root, "geo/ui/ui-rules.json"), "utf8"))
const rules = allRules.quality
const baseline = JSON.parse(readFileSync(path.join(root, "geo/ui/ui-baseline.json"), "utf8")).quality ?? {}

const args = process.argv.slice(2)
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const TOOLS = ["shadcnLint", "impeccable", "visual", "axe"]
const only = option("--only", TOOLS.join(",")).split(",")
const out = path.resolve(option("--out", process.env.GAID_UI_QUALITY_OUT || path.join(os.tmpdir(), "gaid-ui-quality")))
const telemetry = rules.impeccable.telemetryEnv

const globRegex = (glob) => new RegExp(`^${glob.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`)
const skipFile = (rel) => (allRules.slop.skipFiles ?? []).some((g) => globRegex(g).test(rel))
const guideFor = (map, id) => map[id] ?? ["review"]

function sources() {
  const files = []
  const walk = (abs) => {
    if (statSync(abs).isDirectory()) for (const name of readdirSync(abs).sort()) walk(path.join(abs, name))
    else if (allRules.slop.extensions.some((ext) => abs.endsWith(ext))) files.push(abs)
  }
  for (const base of allRules.slop.roots) {
    const abs = path.join(root, base)
    if (existsSync(abs)) walk(abs)
  }
  return files.filter((file) => !skipFile(path.relative(root, file).split(path.sep).join("/")))
}

// An arbitrary value breaks the rule of its class family: type (T1), colour (V1), depth (S6), corners (I8), else spacing (L5).
function arbitraryGuide(cls) {
  const base = cls.split(":").at(-1).replace(/^!/, "")
  if (/^(text|leading|tracking|font)-\[/.test(base) && !/^text-\[(#|rgb|hsl|oklch|color|var)/.test(base)) return ["T1"]
  if (/^(bg|text|border|ring|outline|fill|stroke|from|to|via|decoration|caret|accent)-\[(#|rgb|hsl|oklch|color|var)/.test(base)) return ["V1"]
  if (/^shadow-\[/.test(base)) return ["S6"]
  if (/^rounded/.test(base)) return ["I8"]
  return ["L5"]
}

const results = {}
const record = (tool, value) => { results[tool] = { mode: rules.modes[tool] ?? "report", ...value } }

async function shadcnLint() {
  let ESLint
  try {
    ({ ESLint } = await import("eslint"))
  } catch {
    return record("shadcnLint", { skipped: "eslint is not installed (run npm ci in geo/ui/quality)" })
  }
  const eslint = new ESLint({ cwd: web, overrideConfigFile: path.join(root, rules.shadcnLint.config), errorOnUnmatchedPattern: false })
  const findings = []
  for (const result of await eslint.lintFiles(sources())) {
    const rel = path.relative(root, result.filePath).split(path.sep).join("/")
    for (const m of result.messages) {
      if (!m.ruleId?.startsWith("shadcn/")) continue
      const subject = m.message.match(/^"([^"]+)"/)?.[1] ?? m.message.slice(0, 60)
      const guide = m.ruleId === "shadcn/no-arbitrary-values" ? arbitraryGuide(subject) : guideFor(rules.shadcnLint.guide, m.ruleId)
      findings.push({ key: `${rel}:${m.ruleId}:${subject}`, rule: m.ruleId, guide, where: `${rel}:${m.line}`, detail: m.message })
    }
  }
  record("shadcnLint", { findings })
}

function impeccableStatic() {
  const bin = path.join(here, "node_modules", ".bin", process.platform === "win32" ? "impeccable.cmd" : "impeccable")
  if (!existsSync(bin)) return { skipped: "impeccable is not installed (run npm ci in geo/ui/quality)" }
  const files = sources()
  const run = spawnSync(bin, ["detect", "--json", ...files], { encoding: "utf8", env: { ...process.env, ...telemetry }, maxBuffer: 64 << 20 })
  if (run.status !== 0 && run.status !== 2) return { skipped: `impeccable detect exited ${run.status}: ${(run.stderr || "").slice(0, 300)}` }
  return {
    findings: JSON.parse(run.stdout || "[]").map((f) => {
      const rel = path.relative(root, f.file).split(path.sep).join("/")
      return { key: `${rel}:${f.antipattern}:${f.snippet}`, rule: f.antipattern, guide: guideFor(rules.impeccable.guide, f.antipattern), where: `${rel}:${f.line}`, detail: `${f.name}: ${f.snippet}` }
    }),
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function readDir(kind) {
  const dir = path.join(out, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => [f.replace(/\.json$/, ""), JSON.parse(readFileSync(path.join(dir, f), "utf8"))])
}

async function browserTools() {
  const wanted = ["impeccable", "visual", "axe"].filter((t) => only.includes(t))
  if (!wanted.length) return
  const cli = path.join(here, "node_modules", "@playwright", "test", "cli.js")
  const skipAll = (reason) => {
    for (const tool of wanted) {
      if (tool === "impeccable") results.impeccable = { ...results.impeccable, live: { skipped: reason } }
      else record(tool, { skipped: reason })
    }
  }
  if (!existsSync(cli)) return skipAll("@playwright/test is not installed (run npm ci in geo/ui/quality)")
  const { chromium } = await import("@playwright/test")
  if (!existsSync(chromium.executablePath())) {
    // The pinned Playwright's Chromium is fetched once per PC (Playwright's CDN; on a blocked network the tools are skipped).
    const install = spawnSync(process.execPath, [cli, "install", "chromium"], { cwd: here, stdio: "inherit" })
    if (install.status !== 0 || !existsSync(chromium.executablePath())) return skipAll("Chromium for Playwright is not installed and could not be downloaded")
  }
  for (const kind of ["axe", "impeccable", "playwright"]) rmSync(path.join(out, kind), { recursive: true, force: true })
  const env = { ...process.env, ...telemetry, GAID_UI_QUALITY_OUT: out, GAID_UI_QUALITY_PORT: String(await freePort()), GAID_UI_QUALITY_CDP_PORT: String(await freePort()) }
  const pw = spawnSync(process.execPath, [cli, "test", "-c", path.join(here, "playwright.config.mjs"), ...(args.includes("--update-baseline") ? ["--update-snapshots"] : [])], { cwd: here, env, encoding: "utf8", maxBuffer: 64 << 20 })
  writeFileSync(path.join(out, "playwright.log"), `${pw.stdout ?? ""}${pw.stderr ?? ""}`)
  const reportFile = path.join(out, "playwright.json")
  if (!existsSync(reportFile)) return skipAll(`Playwright did not run (exit ${pw.status})`)
  const report = JSON.parse(readFileSync(reportFile, "utf8"))
  const tests = []
  const collect = (suite) => { for (const s of suite.suites ?? []) collect(s); for (const spec of suite.specs ?? []) for (const t of spec.tests) tests.push({ title: spec.title, project: t.projectName, result: t.results.at(-1) }) }
  for (const suite of report.suites ?? []) collect(suite)
  if (!tests.length) return skipAll(`Playwright ran no tests (exit ${pw.status}); see ${reportFile}`)

  if (wanted.includes("visual")) {
    const findings = []
    for (const t of tests) {
      const message = (t.result?.errors ?? []).map((e) => e.message ?? "").join("\n").replace(/\u001b\[[0-9;]*m/g, "")
      if (t.result?.status === "passed") continue
      const kind = /snapshot doesn't exist|writing actual/i.test(message) ? "new baseline written" : /pixels|different|Screenshot comparison failed|toHaveScreenshot/i.test(message) ? "differs from baseline" : "page did not render"
      findings.push({ key: `${t.title}-${t.project}`, rule: kind, guide: ["section 12"], where: `${t.title} · ${t.project}`, detail: message.split("\n").find((l) => l.trim()) ?? kind })
    }
    record("visual", { findings, pages: tests.length, diffDir: path.join(out, "playwright") })
  }
  if (wanted.includes("axe")) {
    const findings = []
    for (const [name, violations] of readDir("axe")) {
      for (const v of violations) for (const node of v.nodes) findings.push({ key: `${name}:${v.id}:${node.target}`, rule: v.id, guide: guideFor(rules.axeGuide, v.id), where: `${name} ${node.target}`, detail: `${v.help} (${v.impact})` })
    }
    record("axe", { findings })
  }
  if (wanted.includes("impeccable")) {
    const findings = []
    const errors = []
    for (const [name, data] of readDir("impeccable")) {
      if (!Array.isArray(data)) { errors.push(`${name}: ${data.error}`); continue }
      for (const f of data) findings.push({ key: `${name}:${f.antipattern}:${f.selector ?? f.snippet}`, rule: f.antipattern, guide: guideFor(rules.impeccable.guide, f.antipattern), where: `${name} ${f.selector ?? ""}`.trim(), detail: `${f.name}: ${f.snippet}` })
    }
    results.impeccable = { ...results.impeccable, live: errors.length && !findings.length ? { skipped: errors.join("; ") } : { findings, errors } }
  }
}

function summarize(tool, value) {
  if (value.skipped) return { tool, mode: value.mode, skipped: value.skipped, findings: [], fresh: [] }
  const accepted = new Set(baseline[tool] ?? [])
  const findings = value.findings ?? []
  return { tool, mode: value.mode, findings, fresh: findings.filter((f) => !accepted.has(f.key)) }
}

mkdirSync(out, { recursive: true })
if (only.includes("shadcnLint")) await shadcnLint()
if (only.includes("impeccable")) results.impeccable = { mode: rules.modes.impeccable ?? "report", static: impeccableStatic() }
await browserTools()
if (results.impeccable) {
  const parts = [results.impeccable.static, results.impeccable.live].filter(Boolean)
  const ran = parts.filter((p) => !p.skipped)
  results.impeccable.findings = ran.flatMap((p) => p.findings)
  if (!ran.length) results.impeccable.skipped = parts.map((p) => p.skipped).join("; ")
  else results.impeccable.notes = parts.filter((p) => p.skipped).map((p) => `skipped part: ${p.skipped}`)
}

const summary = TOOLS.filter((t) => results[t]).map((t) => summarize(t, results[t]))
writeFileSync(path.join(out, "summary.json"), JSON.stringify({ generated: new Date().toISOString(), summary, results }, null, 2))
if (args.includes("--json")) console.log(JSON.stringify(summary, null, 2))
else {
  for (const s of summary) {
    if (s.skipped) { console.log(`ui-quality ${s.tool} [${s.mode}]: skipped — ${s.skipped}`); continue }
    const byGuide = {}
    for (const f of s.findings) for (const g of f.guide) byGuide[g] = (byGuide[g] ?? 0) + 1
    const guides = Object.entries(byGuide).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(", ")
    console.log(`ui-quality ${s.tool} [${s.mode}]: ${s.findings.length} finding(s), ${s.fresh.length} not accepted${guides ? ` (${guides})` : ""}`)
    for (const f of s.fresh.slice(0, 15)) console.log(`  ${f.guide.join(" ")}  ${f.rule}  ${f.where}  ${f.detail.split("\n")[0].slice(0, 160)}`)
    if (s.fresh.length > 15) console.log(`  … ${s.fresh.length - 15} more in ${path.join(out, "summary.json")}`)
  }
  console.log(`ui-quality: full results in ${path.join(out, "summary.json")}`)
}
const blocking = summary.filter((s) => s.mode === "block" && s.fresh.length)
if (blocking.length) console.log(`ui-quality: blocking tool(s) with findings: ${blocking.map((s) => s.tool).join(", ")}`)
process.exit(blocking.length ? 1 : 0)
