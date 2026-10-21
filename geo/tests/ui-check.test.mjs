// geo/ui/check-ui.mjs: the static checks behind docs/design/ui-guide.md (W1–W4, R1–R2, S1/T1).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkCopyLength, checkInternals, checkSlop, checkStyles, run, visibleLength } from "../ui/check-ui.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const rules = JSON.parse(fs.readFileSync(path.join(root, "geo/ui/ui-rules.json"), "utf-8"));
const s = (id, text, locale = "ko") => ({ id, locale, text });

test("visible length counts arguments and the longest plural branch", () => {
  assert.equal(visibleLength("파일 {name} 열기", 4), 10);
  assert.equal(visibleLength("{count, plural, one {파일 #개} other {파일 #개를 골랐습니다}}", 4), 13);
  // Arguments inside branches (Codex review B1): the longest rendered branch, not the ICU source.
  assert.equal(visibleLength("{state, select, missing {파일 {name}을 찾지 못했습니다.} other {파일 {name}을 읽지 못했습니다. 다시 시도하세요.}}", 4), 28);
});

test("copy limits follow the first matching role", () => {
  const findings = checkCopyLength([
    s("map.save.button", "지도와 범례와 속성표를 모두 PNG로 저장"),
    s("map.title", "지도"),
    s("map.body", "가".repeat(141)),
    s("map.body", "a".repeat(281), "en"),
    s("map.command", "x".repeat(500)),
  ], rules);
  assert.deepEqual(findings.map((f) => f.key), ["ko:map.save.button", "ko:map.body", "en:map.body"]);
});

test("researcher-facing strings may not interpolate raw errors, models or ids", () => {
  const findings = checkInternals([
    s("workspace.setup.error", "작업 초안을 만들지 못했습니다. {detail}"),
    s("workspace.setup.error.technical", "{detail}"),
    s("previewMethod.details", "모델: {model}"),
    s("methods.trial.model", "모델: {model}"),
    s("app.chat.models.selectCurrent", "모델 선택, 현재 {model}"),
    s("work.run", "실행 {runId}"),
    s("files.read", "Traceback 표시", "en"),
    s("files.ok", "파일을 읽지 못했습니다. 형식을 확인하세요."),
  ], rules);
  assert.deepEqual(findings.map((f) => f.key), ["ko:workspace.setup.error", "ko:previewMethod.details", "ko:methods.trial.model", "ko:work.run", "en:files.read"]);
});

test("styles check finds hard-coded colours and text below the scale", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-ui-"));
  fs.mkdirSync(path.join(dir, "web/src/geo/x"), { recursive: true });
  fs.writeFileSync(path.join(dir, "web/src/geo/x/a.tsx"), `<p className="text-[11px] text-[12px]" style={{ color: "#1f5eff" }}>&#123;</p>`);
  fs.writeFileSync(path.join(dir, "web/src/geo/x/a.test.tsx"), `const c = "#000000";`);
  const keys = checkStyles(dir, rules).map((f) => f.key).sort();
  assert.deepEqual(keys, ["web/src/geo/x/a.tsx:#1f5eff", "web/src/geo/x/a.tsx:text-[11px]"]);
});

test("slop check finds AI icons, hue utilities, glass, filters, stripes, emoji and a missing brand font", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gaid-slop-"));
  fs.mkdirSync(path.join(dir, "web/src/geo/x"), { recursive: true });
  fs.mkdirSync(path.join(dir, "web/src/app"), { recursive: true });
  fs.writeFileSync(path.join(dir, "web/src/geo/x/a.tsx"), [
    'import { FolderIcon, SparklesIcon, Bot as Robot } from "lucide-react";',
    '<div className="bg-violet-500/10 dark:text-sky-400 backdrop-blur border-l-4 border-l bg-gradient-to-r" />',
    '<img className="dark:invert object-contain" />',
    '<p className="text-gaid-warning bg-gaid-warning-bg border-border" />',
  ].join("\n"));
  fs.writeFileSync(path.join(dir, "web/src/geo/x/a.test.tsx"), 'const c = "bg-violet-500";');
  fs.writeFileSync(path.join(dir, "web/src/app/globals.css"), ":root { --font-sans: x; }");
  const keys = checkSlop(dir, rules, [s("hub.title", "허브 ✨"), s("hub.ok", "허브")]).map((f) => f.key).sort();
  assert.deepEqual(keys, [
    "ko:hub.title:emoji",
    "web/src/app/globals.css:font-face",
    "web/src/geo/x/a.tsx:ai-icon:Bot",
    "web/src/geo/x/a.tsx:ai-icon:SparklesIcon",
    "web/src/geo/x/a.tsx:glass:backdrop-blur",
    "web/src/geo/x/a.tsx:gradient:bg-gradient-t",
    "web/src/geo/x/a.tsx:hue-utility:bg-violet-500",
    "web/src/geo/x/a.tsx:hue-utility:dark:text-sky-400",
    "web/src/geo/x/a.tsx:image-filter:dark:invert",
    "web/src/geo/x/a.tsx:side-stripe:border-l-4",
  ]);
});

test("the repository passes with its recorded baseline", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "geo/ui/ui-baseline.json"), "utf-8"));
  const result = run({ root, rules, baseline });
  assert.deepEqual(result.failures, []);
});
