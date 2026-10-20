/** Shared fixtures of the GAID hub authoring tests (no real model, no catalogue). */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthoringStore } from "../../src/geo/authoring/store.ts";
import { addSource } from "../../src/geo/authoring/sources.ts";
import type { ChatFn, ModelConfig } from "../../src/geo/authoring/model.ts";
import { setPythonStdlibForTests } from "../../src/geo/authoring/python.ts";
import { environmentVocabulary, loadTaxonomy, type Vocabulary } from "../../src/geo/authoring/vocabulary.ts";

export const config: ModelConfig = { ref: "test/fake", thinkingLevel: "low", timeoutMs: 1000, maxTokens: 100 };

export function testVocabulary(): Vocabulary {
  return {
    taxonomy: loadTaxonomy(),
    environments: environmentVocabulary([
      {
        id: "geo-core",
        purpose: "core",
        packages: [{ name: "numpy", imports: ["numpy"] }, { name: "pandas" }, { name: "scikit-learn" }],
      },
      { id: "geo-mpm", extends: "geo-core", purpose: "mpm", packages: [{ name: "xgboost" }] },
    ]),
    catalogueNames: new Set(["spatial-pu-workflow", "geo-map-and-crs"]),
    catalogueIds: new Set(["kigam/spatial-pu-workflow", "kigam/geo-map-and-crs"]),
  };
}

setPythonStdlibForTests(new Set(["os", "sys", "json", "math", "pathlib", "typing", "re", "collections"]));

/** A one-page PDF with the given text lines (poppler reconstructs the xref). */
export function pdf(lines: string[]): Buffer {
  const content = `BT /F1 11 Tf 50 750 Td 14 TL ${lines.map((l) => `(${l}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

export const PAPER = [
  "We use 5 km grid cells and spatial blocks of 50 km for evaluation.",
  "Positive-unlabeled learning treats unlabeled cells as unknown, not negative.",
  "Nested cross-validation separates tuning from outer testing.",
  "Cross-conformal calibration provides approximate coverage.",
];

const dirs: string[] = [];
export async function cleanup() {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
}

export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "authoring-test-"));
  dirs.push(dir);
  const store = new AuthoringStore(dir);
  await store.initialize();
  const project = await store.create({ title: "PU paper", goal: "reuse the method" });
  const { source, extraction } = await addSource(store, project.id, {
    name: "paper.pdf",
    mediaType: "application/pdf",
    contentBase64: pdf(PAPER).toString("base64"),
    doi: "10.0000/test",
  });
  return { dir, store, projectId: project.id, source, extraction };
}

export async function work(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

export const reply =
  (...contents: unknown[]): ChatFn =>
  async () => {
    const next = contents.shift();
    return {
      content: typeof next === "string" ? next : JSON.stringify(next),
      finishReason: "stop",
      usage: { input: 10, output: 5 },
    };
  };

export const analysis = {
  findings: [
    {
      kind: "parameter",
      statement: "5 km 격자와 50 km 평가 block",
      anchors: [{ source: "S1", page: 1, quote: "spatial blocks of 50 km" }],
    },
    {
      kind: "method",
      statement: "PU 학습",
      anchors: [{ source: "S1", page: 1, quote: "treats unlabeled cells as unknown" }],
    },
    {
      kind: "method",
      statement: "nested CV",
      anchors: [{ source: "S1", page: 1, quote: "separates tuning from outer testing" }],
    },
    {
      kind: "result",
      statement: "없는 쪽 인용",
      anchors: [{ source: "S1", page: 7, quote: "separates tuning from outer testing" }],
    },
  ],
  scope: "새 자료에 적용할 일반화 방법",
  questions: [
    {
      key: "scope",
      text: "논문 재현과 새 자료 적용 중 무엇을 만들까요?",
      reason: "단계와 기본값이 달라집니다.",
      affects: "방법 초안",
      answerType: "choice",
      options: [
        { id: "reproduction", label: "논문 재현", hint: "논문 설정을 그대로 씁니다." },
        { id: "generalization", label: "새 자료 적용" },
        { id: "other", label: "기타" },
      ],
      recommended: "generalization",
      recommendedWhy: "목표가 다른 지역 적용입니다.",
    },
    {
      key: "code-path",
      text: "원본 코드를 포함할까요?",
      reason: "실행 가능 여부가 달라집니다.",
      affects: "스킬 파일",
      options: [
        { id: "include", label: "포함" },
        { id: "describe", label: "설명만" },
      ],
      recommended: "포함",
    },
  ],
};

export const draftReply = {
  slug: "pu-nested-cv-method",
  title: "PU nested CV 방법",
  tagline: "희소 양성 자료의 공간 평가",
  summary: "논문의 PU 학습과 공간 block nested CV를 새 자료에 적용합니다.",
  description: "Use when a researcher has sparse positive labels on a grid and needs spatially separated evaluation.",
  scope: "generalization",
  kind: "workflow",
  publisher: "KIGAM",
  taxonomy: {
    disciplines: ["mineral-exploration-mpm", "made-up"],
    tasks: ["modeling", "not-a-task"],
    formats: ["csv"],
  },
  inputs: [{ id: "grid", label: "격자 표", semanticType: "grid-table", formats: ["csv"], required: true }],
  procedure: [
    { id: "prepare", label: "자료 준비", type: "input", summary: "격자 표를 확인합니다." },
    { id: "evaluate", label: "nested CV", type: "analysis", summary: "공간 block으로 평가합니다." },
    { id: "report", label: "보고", type: "output", summary: "결과와 한계를 적습니다." },
  ],
  decisions: [
    {
      id: "block",
      cue: "자기상관 범위",
      alternatives: ["variogram 범위", "사용자 지정"],
      choiceBasis: "label variogram",
      verify: "fold별 양성 수",
    },
  ],
  userDecisions: [{ id: "label", question: "양성 정의는 무엇입니까?" }],
  outputs: [{ id: "scores", label: "점수 표", kind: "table", formats: ["csv"] }],
  limitations: [{ kind: "condition", text: "unlabeled 셀은 음성이 아닙니다." }],
  instructions: "# PU nested CV 방법\n\n논문(S1 1쪽)의 절차를 따릅니다.",
  workflow: {
    skills: [{ name: "pu-nested-cv-method", source: "bundled", role: "primary", purpose: "PU 평가를 실행합니다." }],
    steps: [
      { id: "prepare", title: "자료 준비", does: "격자 표를 확인합니다.", skill: "pu-nested-cv-method", read: "자료 준비", checks: ["양성 정의를 확인합니다."], choiceIds: ["label-def"], outputs: [] },
      { id: "evaluate", title: "nested CV", does: "공간 block으로 평가합니다.", skill: "pu-nested-cv-method", read: "nested CV", checks: [], choiceIds: ["block-size"], outputs: [] },
      { id: "report", title: "보고", does: "결과와 한계를 적습니다.", skill: "pu-nested-cv-method", read: "보고", checks: [], choiceIds: [], outputs: ["scores"] },
    ],
    title: "PU 평가",
    description: "격자 자료로 PU 모델을 공간 평가합니다.",
    inputRoles: [{ id: "grid", label: "격자 표", formats: ["csv"], required: true }],
    requiredScientificChoices: [
      { id: "block-size", label: "block 크기", why: "누출 정도가 달라집니다.", options: ["km25", "km50"] },
      { id: "label-def", label: "양성 정의", why: "대상이 달라집니다." },
    ],
    prompt: "격자 표로 PU 평가를 해 주세요.",
    environmentProfile: "geo-mpm",
    expectedArtifacts: [
      { id: "scores", label: "점수 표", output: "scores", files: ["outputs/scores.csv"], required: true },
    ],
    boundary: "자원량 추정이 아닙니다.",
  },
  recipe: { choices: { "block-size": { value: "km50", decision: "scope" } }, unresolvedChoices: [] },
  evidence: [{ field: "procedure", findingIds: ["F1", "F99"] }],
};
