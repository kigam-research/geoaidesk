// Playwright config of the UI quality kit (geo/ui/quality/run.mjs sets the environment; see ui-rules.json "quality").
// One project per screen combination (계측/도폭 × light/dark) at the guide's design size; `next dev` serves the
// development parts page. Outputs (diffs, axe and impeccable results) go to GAID_UI_QUALITY_OUT, never into the repo.
import { defineConfig } from "@playwright/test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..", "..")
const rules = JSON.parse(readFileSync(path.join(root, "geo/ui/ui-rules.json"), "utf8")).quality
const port = Number(process.env.GAID_UI_QUALITY_PORT || 3317)
const out = process.env.GAID_UI_QUALITY_OUT || path.join(here, ".out")

export default defineConfig({
  testDir: here,
  testMatch: "pages.spec.mjs",
  outputDir: path.join(out, "playwright"),
  snapshotPathTemplate: path.join(root, rules.visual.baselineDir, "{arg}{ext}"),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["json", { outputFile: path.join(out, "playwright.json") }], ["line"]],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: rules.visual.maxDiffPixelRatio, threshold: rules.visual.threshold, animations: "disabled" } },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: rules.viewport,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  projects: rules.combos.map((combo) => ({ name: combo.id, use: { colorScheme: combo.theme, combo } })),
  webServer: {
    command: `npx next dev -p ${port} -H 127.0.0.1`,
    cwd: path.join(root, "web"),
    url: `http://127.0.0.1:${port}${rules.pages[0].path}`,
    reuseExistingServer: process.env.GAID_UI_QUALITY_REUSE === "1",
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
