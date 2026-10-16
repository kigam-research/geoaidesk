/** Source-grounded private method packages; contract: docs/specs/gaid-method-package.md. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { gzipSync } from "node:zlib";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse, parseDocument, stringify } from "yaml";
import {
  distributionOf,
  normalizeDependency,
  portabilityFindings,
  pythonImports,
  pythonStdlib,
  treeListing,
  withBundled,
  type PackageFile,
} from "./python.ts";
import type {
  AtlasTextInput,
  AuthoringProject,
  CheckFinding,
  CheckId,
  MethodDraft,
  MethodPackageRecord,
} from "../../../../web/src/geo/contracts/authoring.ts";
import { GAID_METHOD_SCHEMA } from "../../../../web/src/geo/contracts/methods.ts";
import { lintProfile, type AtlasProfile, type LintFinding } from "./profile-lint.ts";
import { safeRelative, sourceFile } from "./sources.ts";
import { AuthoringError, type AuthoringStore } from "./store.ts";
import { HUB_INPUTS_DIR, type Vocabulary } from "./vocabulary.ts";

/** `provenance.hub.url` of packages authored inside GAID (no remote hub). */
export const LOCAL_HUB_URL = "gaid-local:";
/** Archive limits shared with GAID's hub gate. */
export const PACKAGE_LIMITS = { compressed: 20 * 1024 * 1024, expanded: 64 * 1024 * 1024, entries: 10_000 };

const L = (value: AtlasTextInput): { ko: string; en?: string } =>
  typeof value === "string" ? { ko: value } : value.en ? { ko: value.ko, en: value.en } : { ko: value.ko };
const schema = (name: string) =>
  JSON.parse(readFileSync(join(HUB_INPUTS_DIR, "schemas", name), "utf8")) as { $id: string };

export interface PackageContext {
  store: AuthoringStore;
  /** Taxonomy, catalogue environments and skill names. */
  vocabulary: Vocabulary;
  checker: string;
}
export interface DraftFile {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
}
const PRIVATE = "Private draft; sharing terms not chosen yet";
const CHECKS: CheckId[] = ["schema", "atlas", "taxonomy", "portability", "workflow", "claims"];
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const bytesOf = (f: DraftFile) => Buffer.from(f.content, f.encoding);
const versionOf = (p: AuthoringProject) => `0.${p.packages.length + 1}.0`;
const atlasSchema = schema("atlas-profile.schema.json");
const methodSchema = schema("gaid-method.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(atlasSchema);
ajv.addSchema(methodSchema);
const validateAtlas = ajv.getSchema(atlasSchema.$id)!;
const validateManifest = ajv.getSchema(methodSchema.$id)!;
const validateWorkflow = ajv.compile({ $ref: `${methodSchema.$id}#/$defs/workflow` });
const validateRecipe = ajv.compile({ $ref: `${methodSchema.$id}#/properties/recipes` });

function safePackagePath(path: string) {
  return (
    safeRelative(path) &&
    !path.split("/").some((part) => /^(?:\.env.*|secrets|secure|id_.*|node_modules|__pycache__)$/i.test(part)) &&
    !/\.(?:pem|key)$/i.test(path)
  );
}
function inventory(files: DraftFile[]): PackageFile[] {
  return files.map((f) => {
    const bytes = bytesOf(f);
    return {
      path: f.path,
      sha256: digest(bytes),
      size: bytes.length,
      text:
        f.encoding === "utf8" || /\.(?:py|md|ya?ml|txt|json|sh)$/i.test(f.path) ? bytes.toString("utf8") : undefined,
    };
  });
}
function licenseSpdx(text: string): string | undefined {
  const explicit =
    /SPDX-License-Identifier:\s*(MIT|Apache-2\.0|BSD-3-Clause|BSD-2-Clause|GPL-3\.0-only|GPL-2\.0-only|ISC)\b/.exec(
      text,
    );
  if (explicit) return explicit[1];
  if (/Permission is hereby granted, free of charge/.test(text) && /THE SOFTWARE IS PROVIDED "AS IS"/.test(text))
    return "MIT";
  if (/Apache License[\s\S]*Version 2\.0/.test(text)) return "Apache-2.0";
  if (
    /Permission to use, copy, modify, and\/or distribute this software/.test(text) &&
    /THE SOFTWARE IS PROVIDED "AS IS"/.test(text)
  )
    return "ISC";
  return undefined;
}

/** Generated tree relative to the installed skill folder; never includes original PDFs or notes. */
export async function draftFiles(
  project: AuthoringProject,
  draft: MethodDraft,
  ctx: PackageContext,
): Promise<DraftFile[]> {
  const files: DraftFile[] = [];
  const put = (path: string, content: string | Buffer) => {
    if (!safePackagePath(path) || files.some((f) => f.path === path))
      throw new AuthoringError(`패키지 파일 경로가 잘못되었거나 중복됩니다: ${path}`);
    files.push({
      path,
      content: typeof content === "string" ? content : content.toString("base64"),
      encoding: typeof content === "string" ? "utf8" : "base64",
    });
  };
  const version = versionOf(project);
  put(
    "SKILL.md",
    `---\nname: ${JSON.stringify(draft.slug)}\ndescription: ${JSON.stringify(draft.description)}\nlicense: ${JSON.stringify(PRIVATE)}\nmetadata:\n  version: "${version}"\n---\n\n${draft.instructions}\n`,
  );
  const licenses: AtlasProfile["licenses"] = [{ component: "skill-text", declared: PRIVATE }];
  if (!draft.codeFiles.length) licenses.push({ component: "code", declared: "No code included" });
  const codeSources = [...new Set(draft.codeFiles.map((f) => f.sourceId))].sort();
  let firstLicense = true;
  for (const sourceId of codeSources) {
    const selected = draft.codeFiles.filter((f) => f.sourceId === sourceId);
    const source = project.sources.find((s) => s.id === sourceId);
    if (!source || !["code", "gaid-analysis"].includes(source.kind))
      throw new AuthoringError(`제공한 코드 자료가 아닙니다: ${sourceId}`);
    const entries = project.extractions[sourceId]?.files ?? [];
    const notices = new Set<string>();
    for (const selectedFile of selected) {
      // Prefer the nearest ancestor's license over an unrelated vendored component's notice.
      let directory = posix.dirname(selectedFile.sourcePath);
      while (true) {
        const notice = entries.find(
          (f) =>
            posix.dirname(f.path) === directory && /^(?:LICENSE|COPYING)(?:\.[\w-]+)?$/i.test(posix.basename(f.path)),
        );
        if (notice) {
          notices.add(notice.path);
          break;
        }
        if (directory === ".") break;
        directory = posix.dirname(directory);
      }
    }
    if (!notices.size)
      licenses.push({
        component: "code",
        declared: "Supplied code; license not stated",
        spdx: "unknown",
        paths: selected.map((f) => f.path),
      });
    for (const notice of [...notices].sort()) {
      const content = await ctx.store.readFile(project.id, sourceFile(sourceId, notice));
      const spdx = licenseSpdx(content.toString("utf8"));
      const noticeFile = firstLicense ? "LICENSE" : `references/licenses/${sourceId}/${notice}`;
      firstLicense = false;
      put(noticeFile, content);
      licenses.push({
        component: "code",
        declared: spdx ? `${spdx} (supplied license)` : "Supplied license; see notice file",
        spdx: spdx ?? "unknown",
        noticeFile,
        paths: selected.map((f) => f.path),
      });
    }
  }
  const pdf = project.sources.find((s) => s.kind === "pdf");
  // Whitelist DraftProfile fields, then set all server-owned fields ourselves.
  const p = draft.profile;
  const profile: AtlasProfile = {
    schemaVersion: "atlas-profile/v1",
    id: `${project.owner}/${draft.slug}`,
    source: { kind: "owned", path: `skills/${draft.slug}` },
    release: { atlasVersion: version, state: "draft" },
    kind: p.kind,
    title: p.title,
    tagline: p.tagline,
    summary: p.summary,
    taxonomy: p.taxonomy,
    inputs: p.inputs,
    procedure: p.procedure,
    decisions: p.decisions,
    userDecisions: p.userDecisions,
    outputs: p.outputs,
    limitations: p.limitations,
    dependencies: p.dependencies,
    credits: {
      publisher: project.owner,
      authors: [{ name: project.owner }],
      ...(pdf?.doi || pdf?.title ? { citation: [pdf.title, pdf.doi].filter(Boolean).join(" — ") } : {}),
    },
    licenses,
  };
  put("atlas.yaml", stringify(profile));
  for (const ref of draft.references) {
    if (!ref.path.startsWith("references/")) throw new AuthoringError("참고 문서는 references/ 아래에 두어야 합니다.");
    put(ref.path, ref.content);
  }
  const evidence = new Set(draft.evidence.flatMap((e) => e.findingIds));
  const sources = ["# Source findings", "", "Only server-verified anchors selected by this draft are listed.", ""];
  for (const finding of project.findings.filter((f) => evidence.has(f.id))) {
    const anchors = finding.anchors.filter((a) => a.verified && project.sources.some((s) => s.id === a.sourceId));
    if (!anchors.length) continue;
    sources.push(`## ${finding.id}`, "", finding.statement, "");
    for (const anchor of anchors) {
      const source = project.sources.find((s) => s.id === anchor.sourceId)!;
      sources.push(
        `Source: ${source.name}; ${anchor.page ? `page ${anchor.page}` : `path ${anchor.path ?? "(not recorded)"}`}`,
        "",
        ...anchor.quote.split("\n").map((line) => `> ${line}`),
        "",
      );
    }
  }
  put("references/sources.md", sources.join("\n"));
  const decisions = ["# Researcher decisions", ""];
  for (const d of project.decisions.filter((d) => !d.supersededBy)) {
    const question = project.questions.find((q) => q.id === d.questionId && q.revision === d.questionRevision);
    decisions.push(
      `## ${d.key}`,
      "",
      question?.text ?? d.questionId,
      "",
      d.status === "deferred" ? "Unresolved (researcher deferred this question)." : d.response,
      "",
    );
  }
  for (const q of project.questions.filter((q) => q.status === "open"))
    decisions.push(`## ${q.key}`, "", q.text, "", "Unresolved (no researcher answer).", "");
  put("references/decisions.md", decisions.join("\n"));
  for (const file of draft.codeFiles) {
    if (!file.path.startsWith("scripts/") || !safePackagePath(file.sourcePath))
      throw new AuthoringError(`코드 파일 경로를 확인해 주세요: ${file.path}`);
    const entry = project.extractions[file.sourceId]?.files?.find((e) => e.path === file.sourcePath);
    if (!entry) throw new AuthoringError(`제공한 자료에 없는 코드 파일입니다: ${file.sourcePath}`);
    const bytes = await ctx.store.readFile(project.id, sourceFile(file.sourceId, file.sourcePath));
    if (digest(bytes) !== entry.sha256 || bytes.length !== entry.size)
      throw new AuthoringError(`원본과 코드 파일이 다릅니다: ${file.sourcePath}`);
    put(file.path, bytes);
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** Researcher-readable sentence per check code; the technical message stays in `message`. */
const PLAIN: Record<string, string> = {
  "package-file": "스킬 설명이 패키지에 없는 파일을 가리킵니다.",
  "package-link": "스킬 문서의 링크가 패키지 안의 파일로 이어지지 않습니다.",
  "profile-file": "단계 설명이 패키지에 없는 참고 파일을 가리킵니다.",
  "installed-path": "실행 명령이 설치된 스킬 폴더 기준 경로를 쓰지 않습니다.",
  "absolute-link": "스킬 문서에 설치 폴더 밖을 가리키는 링크가 있습니다.",
  "repo-relative-path": "스킬 문서에 설치 후 열 수 없는 저장소 기준 경로가 있습니다.",
  "personal-path": "개인 PC의 경로가 들어 있습니다.",
  "undeclared-dependency": "코드가 쓰는 Python 패키지가 의존성 목록에 없습니다.",
  "environment-package": "실행 환경에 없는 패키지의 설치 방법이 스킬 설명에 없습니다.",
  environment: "실행 환경 이름이 카탈로그에 없습니다.",
  "taxonomy-unknown": "분류 용어에 없는 값이 있습니다.",
  "workflow-schema": "Workflow 설정의 형식이 맞지 않습니다.",
  "recipe-schema": "레시피 설정의 형식이 맞지 않습니다.",
  "recipe-choice": "레시피에 Workflow에 없는 선택 항목이 있습니다.",
  "recipe-conflict": "레시피의 같은 항목이 정한 값과 미정 목록에 함께 있습니다.",
  "unverified-claim": "시험·발행·기관 보증을 확인하지 않은 표현이 있습니다.",
  "draft-note": "서버가 모델 제안을 고친 내용입니다.",
  "catalogue-name": "카탈로그 스킬과 이름이 같습니다.",
  "method-id-collision": "다른 작업에서 이미 쓴 방법 이름입니다.",
  description: "스킬을 언제 쓰는지 설명이 필요합니다.",
  lines: "스킬 본문이 너무 깁니다.",
  "package-limit": "패키지 크기나 파일 수가 제한을 넘습니다.",
};
const withPlain = (findings: CheckFinding[]): CheckFinding[] =>
  findings.map((f) => (PLAIN[f.code] ? { ...f, plain: PLAIN[f.code] } : f));

/** All six checks; errors block the archive, warnings remain in its validation receipt. */
export async function checkMethod(
  project: AuthoringProject,
  draft: MethodDraft,
  ctx: PackageContext,
): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = [];
  const find = (check: CheckId, code: string, path: string, message: string, level: CheckFinding["level"] = "error") =>
    findings.push({ check, code, path, message, level });
  const lint = (check: CheckId, values: LintFinding[]) =>
    findings.push(
      ...values.map((f) => ({
        level: f.level,
        code: f.code,
        path: f.path,
        message: f.message.ko,
        check,
      })),
    );
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(draft.slug))
    find("schema", "slug", "slug", "스킬 이름은 2~63자의 영문 소문자·숫자·하이픈이어야 합니다.");
  let files: DraftFile[];
  try {
    files = await draftFiles(project, draft, ctx);
  } catch (e) {
    find("portability", "draft-files", "files", e instanceof Error ? e.message : String(e));
    return withPlain(findings);
  }
  const profile = parse(files.find((f) => f.path === "atlas.yaml")!.content) as AtlasProfile;
  if (!validateAtlas(profile))
    for (const e of validateAtlas.errors ?? [])
      find(
        "schema",
        "schema",
        `atlas.yaml#${e.instancePath}`,
        `${e.message ?? "스키마 오류"} ${JSON.stringify(e.params)}`,
      );
  const skill = files.find((f) => f.path === "SKILL.md")!.content;
  const fm = parseDocument(/^---\n([\s\S]*?)\n---/.exec(skill)![1]);
  if (fm.errors.length || fm.get("name") !== draft.slug)
    find("schema", "frontmatter", "SKILL.md", "스킬 폴더 이름과 name을 맞춰 주세요.");
  if (
    !draft.description.trim() ||
    draft.description.length > 1024 ||
    !/(use\s+(?:this\s+skill\s+)?when|사용|때|경우)/i.test(draft.description)
  )
    find("schema", "description", "SKILL.md", "설명은 1~1024자로 작성하고 언제 사용하는지 포함해 주세요.");
  const version = fm.getIn(["metadata", "version"], true) as { type?: string; value?: unknown } | undefined;
  if (
    !version ||
    !["QUOTE_DOUBLE", "QUOTE_SINGLE"].includes(version.type ?? "") ||
    !/^\d+\.\d+\.\d+$/.test(String(version.value))
  )
    find("schema", "version", "SKILL.md", "버전은 따옴표로 묶은 semver여야 합니다.");
  if (skill.split("\n").length > 500)
    find("schema", "lines", "SKILL.md", "본문은 500줄 이내로 줄이고 긴 설명은 references/로 옮겨 주세요.");
  if (!draft.instructions.trim()) find("schema", "instructions", "SKILL.md", "스킬 지침을 작성해 주세요.");
  const generated = inventory(files);
  // Supplied original code keeps its bytes (like frozen upstream references); instruction rules apply to the
  // hub-written files only. Its imports are still checked below.
  const original = (path: string) => /^scripts\/upstream(?:-\d+)?\//.test(path);
  const instructionFiles = generated.filter(
    (f) => !["references/sources.md", "references/decisions.md"].includes(f.path) && !original(f.path),
  );
  const present = new Set(generated.map((f) => f.path));
  for (const node of profile.procedure?.nodes ?? [])
    for (const path of node.reads ?? [])
      if (!present.has(path))
        find(
          "portability",
          "profile-file",
          `atlas.yaml#procedure/${node.id}/reads`,
          `패키지에 없는 참고 파일입니다: ${path}`,
        );
  for (const file of instructionFiles.filter((f) => f.path.endsWith(".md"))) {
    for (const match of (file.text ?? "").matchAll(/\[[^\]]*\]\((\/[^)\s]+)\)/g))
      find("portability", "absolute-link", file.path, `설치 폴더를 벗어나는 링크입니다: ${match[1]}`);
    for (const match of (file.text ?? "").matchAll(
      /(?:python(?:3)?|node|bash|sh)\s+(?:["']?)(?:\.\/)?((?:scripts|tools|engine)\/[^\s`"']+)/g,
    ))
      find("portability", "installed-path", file.path, `실행 파일은 <skill>/ 기준으로 지정해 주세요: ${match[1]}`);
  }
  for (const id of await ctx.store.ids()) {
    if (id === project.id) continue;
    const other = await ctx.store.read(id);
    if (other.packages.some((p) => p.methodId === profile.id))
      find(
        "schema",
        "method-id-collision",
        "slug",
        "다른 프로젝트에서 이미 사용한 방법 이름입니다. 고유한 이름을 사용해 주세요.",
      );
  }
  try {
    lint(
      "portability",
      // All files must be visible for the named-file check; findings inside original code are not reported.
      portabilityFindings(generated)
        .filter((f) => !/(?:^|\/)scripts\/upstream(?:-\d+)?\//.test(f.path))
        .map((f) => ({ ...f, path: `${profile.id}/${f.path}`, message: { ko: f.message } })),
    );
  } catch {
    find("portability", "package-link", "SKILL.md", "문서 링크의 주소 형식을 확인해 주세요.");
  }
  for (const file of generated) {
    // Evidence quotes may legitimately describe the source author's machine; runtime instructions may not.
    if (["references/sources.md", "references/decisions.md"].includes(file.path)) continue;
    if (
      file.text &&
      /(?:\/(?:home|Users)\/[^\s/]+|[A-Za-z]:[\\/]Users[\\/]|\/mnt\/[a-z]\/(?:Users|home)\/)/.test(file.text)
    )
      find(
        "portability",
        "personal-path",
        file.path,
        original(file.path)
          ? "원본 코드에 개인 PC의 절대 경로가 있습니다. 실행 전에 입력 경로를 바꿔야 합니다."
          : "개인 PC의 절대 경로를 입력 변수나 설치 경로로 바꿔 주세요.",
        original(file.path) ? "warning" : "error",
      );
  }
  if (generated.some((f) => f.path.endsWith(".py"))) {
    try {
      const declared = withBundled(
        (profile.dependencies ?? []).flatMap((d) => {
          const name = normalizeDependency(d.name);
          // Accept either the distribution name or the import name (skgstat -> scikit-gstat).
          return [name, distributionOf(name)];
        }),
      );
      for (const module of pythonImports(generated, pythonStdlib()))
        if (!declared.has(distributionOf(module)))
          find(
            "portability",
            "undeclared-dependency",
            "atlas.yaml#dependencies",
            `코드가 사용하는 Python 패키지를 선언하거나, 같은 이름의 모듈 파일이 빠졌다면 포함해 주세요: ${module} (${distributionOf(module)})`,
          );
    } catch (e) {
      find("portability", "python-stdlib", "scripts", `Python 표준 라이브러리 목록을 읽지 못했습니다: ${String(e)}`);
    }
  }
  const v = ctx.vocabulary;
  // Single-profile Atlas lints (the per-profile part of skill_hub's catalogue compile); taxonomy terms are vendored.
  for (const f of lintProfile(profile, v.taxonomy, `skills/${draft.slug}/atlas.yaml`, {
    name: draft.slug,
    version: versionOf(project),
    license: PRIVATE,
  }))
    lint(f.code.startsWith("taxonomy") ? "taxonomy" : "atlas", [f]);
  if (v.catalogueNames.has(draft.slug) || v.catalogueIds.has(profile.id))
    find("atlas", "catalogue-name", "slug", `카탈로그 스킬과 같은 이름입니다: ${draft.slug}. 다른 이름을 쓰세요.`);
  if (draft.workflow) {
    const w = draft.workflow;
    if (!validateWorkflow(w))
      for (const e of validateWorkflow.errors ?? [])
        find("workflow", "workflow-schema", `workflow${e.instancePath}`, `${e.message} ${JSON.stringify(e.params)}`);
    if (w.skillIds?.[0] !== `local:${draft.slug}`)
      find("workflow", "primary-skill", "workflow/skillIds", "첫 스킬은 이 패키지의 local:<slug>여야 합니다.");
    for (const id of w.skillIds?.slice(1) ?? [])
      if (!v.catalogueIds.has(id))
        find("workflow", "workflow-skill", "workflow/skillIds", `카탈로그에 없는 스킬입니다: ${id}`);
    const env = v.environments.find((e) => e.id === w.environmentProfile);
    if (!env)
      find(
        "workflow",
        "environment",
        "workflow/environmentProfile",
        `카탈로그에 없는 환경입니다: ${w.environmentProfile}`,
      );
    else {
      // GAID prepares only the catalogue environment; anything else must be explained in SKILL.md.
      const installed = withBundled(env.packages);
      const skillText = skill.toLowerCase();
      for (const dep of profile.dependencies ?? []) {
        if (dep.kind !== "required") continue;
        const name = normalizeDependency(dep.name);
        if (installed.has(name) || installed.has(distributionOf(name))) continue;
        const mentioned = skillText.includes(name) || skillText.includes(distributionOf(name));
        find(
          "workflow",
          "environment-package",
          "atlas.yaml#dependencies",
          mentioned
            ? `${w.environmentProfile} 환경에 없는 패키지입니다: ${dep.name}. 실행 전에 SKILL.md의 설치 방법을 따라야 합니다.`
            : `${w.environmentProfile} 환경에 없는 패키지입니다: ${dep.name}. SKILL.md에 배포 이름과 설치 방법(예: uv run --with ${distributionOf(name)}), 설치할 수 없을 때의 대안을 적어 주세요.`,
          mentioned ? "warning" : "error",
        );
      }
    }
    for (const role of w.inputRoles ?? [])
      for (const format of role.formats ?? [])
        if (!v.taxonomy.formats.some((t) => t.id === format))
          find("workflow", "workflow-format", `workflow/inputRoles/${role.id}`, `분류에 없는 형식입니다: ${format}`);
    for (const discipline of w.disciplines ?? [])
      if (!v.taxonomy.disciplines.some((t) => t.id === discipline))
        find("workflow", "workflow-discipline", "workflow/disciplines", `분류에 없는 분야입니다: ${discipline}`);
    for (const a of w.expectedArtifacts ?? []) {
      if (a.skill && a.skill !== `local:${draft.slug}`) {
        if (!v.catalogueIds.has(a.skill))
          find(
            "workflow",
            "artifact-skill",
            `workflow/expectedArtifacts/${a.id}`,
            `카탈로그에 없는 스킬입니다: ${a.skill}`,
          );
        continue;
      }
      if (a.output && !profile.outputs.some((o) => o.id === a.output))
        find(
          "workflow",
          "artifact-output",
          `workflow/expectedArtifacts/${a.id}`,
          `스킬에 없는 산출물 포트입니다: ${a.output}`,
        );
    }
  }
  if (draft.recipe) {
    const w = draft.workflow;
    if (!w) find("workflow", "recipe-workflow", "recipe", "레시피에는 Workflow가 필요합니다.");
    else {
      const recipe = {
        ...draft.recipe,
        id: `${draft.slug}-default`,
        workflowId: w.id,
        title: L(w.title),
      };
      if (!validateRecipe([recipe]))
        for (const e of validateRecipe.errors ?? [])
          find("workflow", "recipe-schema", `recipe${e.instancePath}`, `${e.message} ${JSON.stringify(e.params)}`);
      const keys = new Set((w.requiredScientificChoices ?? []).map((c) => c.id));
      for (const key of [...Object.keys(draft.recipe.choices ?? {}), ...(draft.recipe.unresolvedChoices ?? [])])
        if (!keys.has(key)) find("workflow", "recipe-choice", "recipe", `Workflow에 없는 선택 항목입니다: ${key}`);
      for (const key of draft.recipe.unresolvedChoices ?? [])
        if (Object.hasOwn(draft.recipe.choices ?? {}, key))
          find("workflow", "recipe-conflict", "recipe", `답과 미해결 항목에 같은 키가 있습니다: ${key}`);
    }
  }
  // Server-recorded changes to the model proposal (overrides, dropped terms, declared imports) stay visible.
  for (const [i, note] of draft.notes.entries()) find("claims", "draft-note", `notes/${i}`, note, "warning");
  // Text claims stay advisory: structural validation does not establish scientific or institutional validity.
  for (const [path, text] of [
    ["SKILL.md", draft.instructions],
    ["atlas.yaml", stringify(draft.profile)],
  ])
    for (const line of text.split("\n")) {
      if (
        /\b(?:published|validated|tested|endorsed|certified)\b|검증\s*완료|공식\s*인증|기관\s*(?:보증|승인)/i.test(
          line,
        ) &&
        !/\b(?:not|never|unvalidated|untested|unpublished|no)\b|아니|않|미검증|미시험|미발행/.test(line)
      )
        find(
          "claims",
          "unverified-claim",
          path,
          `시험·발행·기관 보증을 확인하지 않은 표현입니다: ${line.trim()}`,
          "warning",
        );
    }
  const total = generated.reduce((sum, f) => sum + f.size, 0);
  if (total > PACKAGE_LIMITS.expanded || generated.length + 2 > PACKAGE_LIMITS.entries)
    find("portability", "package-limit", "files", "패키지의 크기 또는 파일 개수 제한을 초과했습니다.");
  return withPlain(findings);
}

/** One ustar header block; long paths go into a PAX `path` record (GAID's reader understands both). */
function tarHeader(name: string, size: number, mode: number, type: "0" | "5" | "x"): Buffer {
  const h = Buffer.alloc(512);
  const put = (value: string, offset: number, length: number) => h.write(value, offset, length, "utf8");
  const octal = (value: number, length: number) => value.toString(8).padStart(length - 1, "0") + "\0";
  put(name, 0, 100);
  put(octal(mode, 8), 100, 8);
  put(octal(0, 8), 108, 8);
  put(octal(0, 8), 116, 8);
  put(octal(size, 12), 124, 12);
  put(octal(0, 12), 136, 12);
  h.fill(0x20, 148, 156);
  put(type, 156, 1);
  put("ustar\0", 257, 6);
  put("00", 263, 2);
  let sum = 0;
  for (const byte of h) sum += byte;
  put(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return h;
}
const pad = (length: number) => Buffer.alloc((512 - (length % 512)) % 512);

function tarEntry(name: string, data: Buffer, mode: number, type: "0" | "5"): Buffer[] {
  const out: Buffer[] = [];
  if (Buffer.byteLength(name) > 99) {
    const record = (len: number) => `${len} path=${name}\n`;
    let len = Buffer.byteLength(record(0));
    while (Buffer.byteLength(record(len)) !== len) len = Buffer.byteLength(record(len));
    const pax = Buffer.from(record(len), "utf8");
    out.push(tarHeader("PaxHeader", pax.length, 0o644, "x"), pax, pad(pax.length));
  }
  out.push(tarHeader(name.slice(0, 99), data.length, mode, type), data, pad(data.length));
  return out;
}

/**
 * Deterministic tar.gz without external tools: sorted entries, mtime 0, owner 0, fixed modes (0755 for
 * directories and scripts with a shebang, 0644 otherwise). The same files always give the same bytes.
 */
export function archive(slug: string, files: DraftFile[]): Buffer {
  const dirs = new Set<string>([slug]);
  for (const f of files) {
    let dir = posix.dirname(`${slug}/${f.path}`);
    while (dir !== ".") {
      dirs.add(dir);
      dir = posix.dirname(dir);
    }
  }
  const entries: { name: string; data: Buffer; mode: number; type: "0" | "5" }[] = [
    ...[...dirs].map((d) => ({ name: `${d}/`, data: Buffer.alloc(0), mode: 0o755, type: "5" as const })),
    ...files.map((f) => {
      const data = bytesOf(f);
      const exec = f.path.startsWith("scripts/") && data.subarray(0, 2).toString() === "#!";
      return { name: `${slug}/${f.path}`, data, mode: exec ? 0o755 : 0o644, type: "0" as const };
    }),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const blocks = entries.flatMap((e) => tarEntry(e.name, e.data, e.mode, e.type));
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}

/** Build the next immutable package; the serialized caller appends the returned record. */
export async function buildPackage(
  project: AuthoringProject,
  draft: MethodDraft,
  ctx: PackageContext,
): Promise<{ record: MethodPackageRecord } | { findings: CheckFinding[] }> {
  const findings = await checkMethod(project, draft, ctx);
  if (findings.some((f) => f.level === "error")) return { findings };
  const revision = project.packages.length + 1;
  const files = await draftFiles(project, draft, ctx);
  const entries = inventory(files).map(({ path, sha256, size }) => ({ path, sha256, size }));
  const packageDigest = digest(treeListing(entries));
  // Use the draft timestamp, not the wall clock: retrying the same inputs yields identical bytes.
  const createdAt = draft.createdAt;
  const manifest = {
    schemaVersion: GAID_METHOD_SCHEMA,
    methodId: `${project.owner}/${draft.slug}`,
    revision,
    version: versionOf(project),
    lifecycle: "draft",
    implementation: draft.codeFiles.length ? "implemented" : "descriptive",
    ...(draft.codeFiles.length ? { codeOrigin: "supplied" as const } : {}),
    title: L(draft.profile.title),
    summary: L(draft.profile.summary),
    sources: project.sources.map((s) => ({
      kind: s.doi ? ("doi" as const) : ("file" as const),
      ref: s.doi ?? s.name,
      sha256: s.sha256,
      ...(s.title ? { title: s.title } : {}),
      ...(s.documentKind ? { documentKind: s.documentKind } : {}),
      ...(project.extractions[s.id]?.pages ? { pages: project.extractions[s.id].pages } : {}),
    })),
    workflows: draft.workflow ? [draft.workflow] : [],
    recipes:
      draft.recipe && draft.workflow
        ? [
            {
              ...draft.recipe,
              id: `${draft.slug}-default`,
              workflowId: draft.workflow.id,
              title: L(draft.workflow.title),
            },
          ]
        : [],
    checks: {
      passed: true,
      checker: ctx.checker,
      checkedAt: createdAt,
      items: CHECKS.map((id) => ({
        id,
        status: findings.some((f) => f.check === id) ? "warn" : "pass",
      })),
      warnings: findings.map(({ code, path, message }) => ({ code, path, message })),
    },
    provenance: {
      hub: { url: LOCAL_HUB_URL, projectId: project.id, draftRevision: draft.revision },
      decisions: project.decisions.filter((d) => !d.supersededBy && d.status === "answered").length,
      openQuestions: project.questions
        .filter((q) => ["open", "deferred"].includes(q.status))
        .map(({ id, text }) => ({ id, text })),
      attempts: project.attempts.map((a) => ({
        route: a.model.split("/")[0],
        model: a.model,
        at: a.startedAt,
        outcome: a.outcome,
      })),
    },
    files: entries,
    packageDigest,
  };
  if (!validateManifest(manifest))
    return {
      findings: [
        ...findings,
        ...(validateManifest.errors ?? []).map((e) => ({
          check: "schema" as const,
          level: "error" as const,
          code: "manifest-schema",
          path: `gaid-method.json${e.instancePath}`,
          message: `${e.message} ${JSON.stringify(e.params)}`,
        })),
      ],
    };
  files.push({
    path: "gaid-method.json",
    encoding: "utf8",
    content: `${JSON.stringify(manifest, null, 2)}\n`,
  });
  const directories = new Set<string>([draft.slug]);
  for (const f of files) {
    let dir = posix.dirname(f.path);
    while (dir !== ".") {
      directories.add(dir);
      dir = posix.dirname(dir);
    }
  }
  if (
    files.reduce((sum, f) => sum + bytesOf(f).length, 0) > PACKAGE_LIMITS.expanded ||
    files.length + directories.size > PACKAGE_LIMITS.entries
  )
    return {
      findings: [
        ...findings,
        {
          check: "portability",
          level: "error",
          code: "package-limit",
          path: "files",
          message: "패키지를 펼친 크기 또는 항목 개수가 제한을 초과했습니다.",
        },
      ],
    };
  const bytes = archive(draft.slug, files);
  if (bytes.length > PACKAGE_LIMITS.compressed)
    return {
      findings: [
        ...findings,
        {
          check: "portability",
          level: "error",
          code: "package-limit",
          path: "files",
          message: "압축 패키지가 20 MiB를 초과했습니다.",
        },
      ],
    };
  const path = `packages/${revision}/${draft.slug}.tar.gz`;
  if (ctx.store.exists(project.id, path) && !(await ctx.store.readFile(project.id, path)).equals(bytes))
    throw new AuthoringError("같은 패키지 판의 파일이 이미 있습니다. 기존 파일은 바꾸지 않았습니다.", 409);
  await ctx.store.writeFile(project.id, path, bytes);
  return {
    record: {
      revision,
      draftRevision: draft.revision,
      methodId: manifest.methodId,
      slug: draft.slug,
      sha256: digest(bytes),
      size: bytes.length,
      packageDigest,
      createdAt,
      manifest,
      archive: path,
    },
  };
}
