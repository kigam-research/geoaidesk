import fs from "node:fs";
import path from "node:path";
import type { ProjectPaths } from "../../projects.ts";
import { apiRelative, safePath } from "../../sandbox-fs.ts";
import { runHelperScript } from "../../api/sci-helpers.ts";
import { FIGURE_CHECKS_DIR, type FigureCheckBody, type FigureRecord } from "../../../../web/src/geo/contracts/figures.ts";
import { FigureError, SKILL_DIR, figurePath, figureRecord, figureTarget, journalProfiles, readFigureCheck, writeFigureState } from "./store.ts";

export async function checkFigure(paths: ProjectPaths, body: FigureCheckBody, skillDir = SKILL_DIR): Promise<FigureRecord> {
  const { relative, absolute } = figurePath(paths, body?.path);
  const figure = figureRecord(paths, relative, null, null, skillDir);
  if (!figure.exists) throw new FigureError(404, "figure-missing", "Figure not found");
  if (!figure.sha256) throw new FigureError(422, "figure-hash", "Cannot identify figure contents");
  const script = path.join(skillDir, "scripts/check_figure.py");
  if (!fs.existsSync(script)) throw new FigureError(503, "figure-check-unavailable", "The figure check script is not installed");
  const selected = figureTarget(paths);
  const journalId = body.journalId ?? selected?.journalId, width = body.width ?? selected?.width;
  if ((journalId !== undefined && typeof journalId !== "string") || (width !== undefined && typeof width !== "string") ||
      (body.use !== undefined && body.use !== "figure" && body.use !== "graphical-abstract")) throw new FigureError(400, "figure-target", "Invalid figure check options");
  if (journalId && !journalProfiles(skillDir).find(j => j.id === journalId)?.widths.some(w => w.id === width)) throw new FigureError(400, "figure-target", "Choose an available journal and width");
  if (width && !journalId) throw new FigureError(400, "figure-target", "A width needs a target journal");
  const out = safePath(`${FIGURE_CHECKS_DIR}/${figure.sha256}.json`, paths.sandbox);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const result = await runHelperScript(script, [absolute, "--journals", path.join(skillDir, "assets/journals.json"),
    ...(journalId ? ["--journal", journalId] : []), ...(width ? ["--width", width] : []),
    "--kind", figure.kind, ...(body.use ? ["--use", body.use] : []), "--out", out]);
  if (result.status !== 0) throw new FigureError(result.timedOut ? 504 : ({ 3: 503, 4: 404, 5: 422 }[result.status] ?? 500),
    result.timedOut ? "figure-check-timeout" : "figure-check-failed", result.stderr || "Figure check failed");
  const refreshed = figureRecord(paths, relative, null, null, skillDir);
  if (refreshed.sha256 !== figure.sha256) throw new FigureError(409, "figure-changed", "Figure changed while checking; run the check again");
  const check = readFigureCheck(paths, figure.sha256);
  if (!check) throw new FigureError(502, "figure-check-result", "The figure checker did not write a valid result");
  // The CLI may receive an absolute input. Persist API paths, never host paths.
  check.path = relative;
  check.cvdPreviews = check.cvdPreviews.flatMap(p => {
    try {
      const rel = path.isAbsolute(p) ? apiRelative(paths.sandbox, p) : p;
      return ["deuteranopia", "protanopia", "tritanopia"].some(v => rel === `${FIGURE_CHECKS_DIR}/${figure.sha256}-cvd-${v}.png`) ? [rel] : [];
    } catch { return []; }
  });
  writeFigureState(paths, `${FIGURE_CHECKS_DIR}/${figure.sha256}.json`, check);
  return { ...refreshed, check };
}
