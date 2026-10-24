// UI quality kit checks per page and screen combination (ui-rules.json "quality"): a full-page screenshot compared with
// the baseline, axe-core, and impeccable's live detector attached over CDP. Findings are written to GAID_UI_QUALITY_OUT;
// run.mjs maps them to UI guide ids and decides report or block. Assertions here only drive Playwright's own report.
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { execFile } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const run = promisify(execFile)
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..", "..")
const rules = JSON.parse(readFileSync(path.join(root, "geo/ui/ui-rules.json"), "utf8")).quality
const out = process.env.GAID_UI_QUALITY_OUT || path.join(here, ".out")
const cdpPort = Number(process.env.GAID_UI_QUALITY_CDP_PORT || 9333)
const impeccableBin = path.join(here, "node_modules", ".bin", process.platform === "win32" ? "impeccable.cmd" : "impeccable")

test.use({ launchOptions: { args: [`--remote-debugging-port=${cdpPort}`] } })

function save(kind, name, data) {
  mkdirSync(path.join(out, kind), { recursive: true })
  writeFileSync(path.join(out, kind, `${name}.json`), JSON.stringify(data, null, 2))
}

for (const pageSpec of rules.pages) {
  test(pageSpec.id, async ({ page }, info) => {
    const combo = info.project.use.combo
    const name = `${pageSpec.id}-${combo.id}`
    await page.addInitScript(([style, theme]) => {
      localStorage.setItem("gaid:style", style)
      localStorage.setItem("theme", theme)
      localStorage.setItem("gaid:locale", "ko")
    }, [combo.style, combo.theme])
    // The combo in the query string names the tab for impeccable's --target.
    await page.goto(`${pageSpec.path}?combo=${combo.id}`, { waitUntil: "networkidle" })
    // The Next.js development indicator is not part of the page.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)

    const axe = await new AxeBuilder({ page }).withTags(rules.axe.tags).analyze()
    save("axe", name, axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })) })))

    let impeccable
    try {
      const { stdout } = await run(impeccableBin, ["detect", "--json", "--cdp", String(cdpPort), "--target", `combo=${combo.id}`], { env: { ...process.env, ...rules.impeccable.telemetryEnv }, maxBuffer: 16 << 20 })
      impeccable = JSON.parse(stdout || "[]")
    } catch (error) {
      // Exit 2 = findings; anything else means the scan did not run.
      if (error.code === 2) impeccable = JSON.parse(error.stdout || "[]")
      else impeccable = { error: String(error.stderr || error.message).slice(0, 2000) }
    }
    save("impeccable", name, impeccable)

    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true })
  })
}
