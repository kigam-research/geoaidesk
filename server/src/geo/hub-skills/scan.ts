/** Heuristic findings are reading aids, never a safety verdict or a legal opinion. */
import { basename } from "node:path";
import { parse } from "yaml";
import { PRIVATE } from "../authoring/package.ts";
import type { HubSkillFinding, HubSkillLicence, HubSkillOrigin } from "../../../../web/src/geo/contracts/hub-skills.ts";
import type { TarEntry } from "../tar.ts";

const SPDX = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "Unlicense", "CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "GPL-2.0-only", "GPL-2.0-or-later", "GPL-3.0-only", "GPL-3.0-or-later", "LGPL-2.1-only", "LGPL-2.1-or-later", "LGPL-3.0-only", "AGPL-3.0-only"];
const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/gu;
const visible = (s: string) => s.replace(INVISIBLE, (c) => `<U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}>`).slice(0, 160);
export function textOf(data: Buffer): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    return /[\x00-\x08\x0e-\x1f]/.test(text) ? null : text;
  } catch { return null; }
}
function metadata(content: string): Record<string, unknown> | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return null;
  try {
    const data = parse(match[1], { maxAliasCount: 20 });
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
function recognized(value: string): string | undefined {
  const direct = SPDX.find((id) => value.trim() === id || new RegExp(`SPDX-License-Identifier:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(value));
  if (direct) return direct;
  if (/Permission is hereby granted, free of charge/.test(value) && /THE SOFTWARE IS PROVIDED "AS IS"/.test(value)) return "MIT";
  if (/Apache License[\s\S]*Version 2\.0/.test(value)) return "Apache-2.0";
  if (/Redistribution and use in source and binary forms/.test(value) && /THIS SOFTWARE IS PROVIDED/.test(value))
    return /Neither the name/.test(value) ? "BSD-3-Clause" : "BSD-2-Clause";
  if (/Permission to use, copy, modify, and\/or distribute/.test(value) && /THE SOFTWARE IS PROVIDED/.test(value)) return "ISC";
  return undefined;
}
export function scanSkill(name: string, entries: TarEntry[], origin: HubSkillOrigin) {
  const content = entries.find((e) => e.path === "SKILL.md")?.data.toString("utf8") ?? "";
  const meta = metadata(content);
  const findings: HubSkillFinding[] = [];
  const add = (kind: HubSkillFinding["kind"], file: string, excerpt: string, line?: number) => {
    if (findings.length < 200) findings.push({ kind, file, ...(line ? { line } : {}), excerpt: visible(excerpt) });
  };
  if (!meta || meta.name !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64 ||
    typeof meta.description !== "string" || !meta.description.trim() || meta.description.length > 1024 || textOf(Buffer.from(content)) === null)
    add("format", "SKILL.md", "SKILL.md needs matching name and a description (1–1024 characters) in YAML frontmatter.");
  const declarations: { file: string; value: string }[] = [];
  // The builder's exact placeholder is not an external licence declaration.
  if (meta?.license !== undefined && meta.license !== PRIVATE) declarations.push({ file: "SKILL.md", value: String(meta.license) });
  for (const e of entries) if (e.type === "file" && /^(LICENSE|COPYING)(?:[._-].*)?$/i.test(basename(e.path)))
    declarations.push({ file: e.path, value: e.data.toString("utf8") });
  const decision = declarations.map((d) => ({ ...d, spdx: recognized(d.value) }));
  const restricted = decision.find((d) => !d.spdx && /all rights reserved|proprietary|no (?:copying|redistribution)|do not (?:copy|redistribute)|복제\s*금지|재배포\s*금지/i.test(d.value));
  const unknown = decision.find((d) => !d.spdx);
  const known = decision.find((d) => d.spdx);
  const chosen = restricted ?? unknown ?? known;
  const licence: HubSkillLicence = chosen
    ? { state: restricted ? "restricted" : unknown ? "unknown" : "declared", ...(chosen.spdx ? { spdx: chosen.spdx } : {}), file: chosen.file, excerpt: chosen.value.slice(0, 200) }
    : { state: origin.kind === "github" ? "unknown" : "institute" };
  const patterns: [HubSkillFinding["kind"], RegExp][] = [
    ["network", /https?:\/\/|\b(?:curl|wget|fetch|requests\.(?:get|post)|urllib|httpx|socket)\b/i],
    ["shell", /(?:^|[\s`;(])(?:bash|sh|zsh|powershell|cmd\.exe)\b|subprocess[.\s]|os\.(?:system|popen)|child_process|\bexec(?:File|Sync|\s*\()/i],
    ["package-install", /\b(?:pip3?|npm|pnpm|yarn|conda|mamba|apt(?:-get)?|brew)\s+(?:install|add)|\buv\s+(?:add|pip\s+install|sync)/i],
    ["credentials", /\.env\b|auth\.json|credentials|api[_ -]?key|(?:access|refresh)[_ -]?token|\.ssh|\.aws|secrets\//i],
    ["outside-write", /(?:write|open|mkdir|copy|move|unlink|remove|rm|cp|mv|>|tee).*?(?:~\/|\/home\/|\/etc\/|\/usr\/|\/root\/|\.\.\/|[A-Z]:\\)/i],
  ];
  for (const e of entries) {
    if (e.type !== "file") continue;
    const text = textOf(e.data);
    if (text === null) continue;
    const md = /\.md$/i.test(e.path);
    let blank = 0;
    for (const [i, line] of text.split(/\r?\n/).entries()) {
      if (findings.length >= 200) break;
      blank = line.trim() ? 0 : blank + 1;
      if (md && (/<!--/.test(line) || /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0]/u.test(line) || blank === 8))
        add("hidden-text", e.path, blank === 8 ? "[8 or more blank lines]" : line, i + 1);
      for (const [kind, pattern] of patterns) if (pattern.test(line)) add(kind, e.path, line, i + 1);
    }
  }
  return { description: typeof meta?.description === "string" ? meta.description : "", content, licence, findings };
}
export const shareable = (licence: HubSkillLicence) => licence.state === "institute" || licence.state === "declared";
