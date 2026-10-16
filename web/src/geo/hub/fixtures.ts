/**
 * Example authoring records for the GAID hub screens (tests and screen design).
 * Content follows the pilot paper (Yilgarn Ni PU + nested spatial CV); the values are
 * illustrative records, not output of a model run.
 */
import {
  AUTHORING_PROJECT_SCHEMA,
  type AuthoringProject,
  type MethodDraft,
  type Question,
} from "@/geo/contracts/authoring";

const at = "2026-10-16T02:10:00.000Z";

const pdf = {
  id: "src-paper01",
  kind: "pdf" as const,
  name: "author-manuscript.pdf",
  mediaType: "application/pdf",
  sha256: "de611db0be9cda7caa5851b5f7e1593593c389c51a3ce02cd3cf249637ba5ff0",
  size: 2_431_120,
  addedAt: at,
  status: "extracted" as const,
  title: "Uncertainty-Aware Mineral Prospectivity Mapping with Positive-Unlabeled Learning",
  doi: "10.1007/s11053-026-10778-w",
};

const code = {
  id: "src-code0001",
  kind: "code" as const,
  name: "mpm-pu-conformal-yilgarn-c03c67d.tar.gz",
  mediaType: "application/gzip",
  sha256: "25ebe859c29fd7959b65821573a7b421ddb795b43bf72efbf478f7359cfc66d6",
  size: 812_004,
  addedAt: at,
  status: "extracted" as const,
};

function question(
  id: string,
  key: string,
  text: string,
  options: { id: string; label: string; hint?: string }[],
  recommendedOptionId?: string,
  recommendedWhy?: string,
): Question {
  return {
    id,
    key,
    revision: 1,
    text,
    reason: "답에 따라 만드는 방법의 범위가 달라집니다.",
    affects: "초안의 단계와 레시피",
    answerType: "choice-or-text",
    options,
    materiality: "required",
    ...(recommendedOptionId ? { recommendedOptionId, recommendedWhy } : {}),
    evidence: [
      {
        sourceId: pdf.id,
        page: 9,
        quote: "Block size is informed by an empirical variogram of the binary deposit label",
        verified: true,
      },
    ],
    status: "open",
    attemptId: "att-analyze01",
    draftRevision: 0,
    createdAt: at,
  };
}

export const FIXTURE_QUESTIONS: Question[] = [
  question(
    "q-scope0001",
    "scope",
    "논문 결과를 재현할까요, 다른 지역 자료에 쓸 방법을 만들까요?",
    [
      { id: "generalize", label: "다른 지역 자료에 적용", hint: "새 격자 자료로 같은 절차를 실행합니다." },
      { id: "reproduce", label: "논문 결과 재현", hint: "Yilgarn 자료와 논문 설정을 그대로 씁니다." },
      { id: "both", label: "둘 다", hint: "재현 단계와 적용 단계를 나눠 만듭니다." },
    ],
    "generalize",
    "올려 주신 목표가 다른 지역 적용입니다.",
  ),
  question(
    "q-code00001",
    "code-path",
    "원본 코드를 방법에 포함할까요?",
    [
      { id: "include", label: "원본 코드 포함", hint: "올린 코드 묶음에서 필요한 파일만 담습니다." },
      { id: "describe", label: "절차 설명만", hint: "코드 없이 단계만 적습니다." },
    ],
    "include",
    "올린 코드에 교차검증과 보정 구현이 있습니다.",
  ),
  question(
    "q-zones0001",
    "zone-thresholds",
    "탐사 우선순위 구역의 경계값은 누가 정할까요?",
    [
      { id: "user", label: "실행할 때 연구자가 정함" },
      { id: "paper", label: "논문 값 사용", hint: "lift 백분위 기준을 그대로 씁니다." },
    ],
    "user",
    "다른 지역에서는 논문 경계값의 근거가 없습니다.",
  ),
  question(
    "q-input0001",
    "input-format",
    "새 자료는 어떤 형식으로 받을까요?",
    [
      { id: "grid-csv", label: "격자 셀 표 (CSV)" },
      { id: "raster", label: "래스터 묶음 (GeoTIFF)" },
    ],
    "grid-csv",
    "원본 코드가 격자 셀 표를 읽습니다.",
  ),
  question(
    "q-output001",
    "outputs",
    "결과물은 어디에 쓸 예정인가요?",
    [
      { id: "targeting", label: "탐사 대상 선정 검토" },
      { id: "report", label: "보고서 그림과 표" },
    ],
  ),
];

const draft: MethodDraft = {
  revision: 1,
  baseRevision: 0,
  origin: "model",
  attemptId: "att-draft001",
  createdAt: at,
  sourceRevision: 2,
  decisionIds: [],
  slug: "pu-nested-cv-prospectivity",
  description: "희소한 광상 기록과 격자 자료로 탐사 우선순위 구역을 만들 때 씁니다.",
  scope: "generalization",
  profile: {
    title: "공간 PU 탐사 유망도 분석",
    tagline: "희소한 광상 기록으로 탐사 우선순위 구역을 만듭니다.",
    summary: "알려진 광상 셀과 미표지 셀로 PU 모델을 학습하고, 공간 블록 교차검증과 보정으로 우선순위 구역을 정합니다.",
    kind: "workflow",
    taxonomy: { disciplines: ["mineral-exploration"], tasks: ["prospectivity-mapping"] },
    inputs: [
      {
        id: "grid",
        label: "격자 셀 표",
        semanticType: "grid-cells",
        formats: ["csv"],
        required: true,
        description: "셀 좌표, 설명 변수, 광상 표시 열",
      },
    ],
    procedure: {
      nodes: [
        { id: "n1", label: "자료 확인", type: "input", summary: "셀 수, 양성 셀 수, 격자 간격과 좌표계를 확인합니다." },
        { id: "n2", label: "공간 의존성 확인", type: "analysis", summary: "축소한 표본으로 바리오그램을 계산해 블록 크기를 제안합니다.", checks: ["표본 약 18,000셀, 2–5분"] },
        { id: "n3", label: "블록 크기 확정", type: "human-gate", summary: "제안한 블록 크기를 연구자가 확인합니다.", decisionIds: ["block-size"] },
        { id: "n4", label: "중첩 공간 교차검증", type: "analysis", summary: "공간 블록으로 나눠 모델을 학습하고 평가합니다." },
        { id: "n5", label: "불확실성과 보정", type: "analysis", summary: "부트스트랩과 컨포멀 보정으로 예측 범위를 구합니다." },
        { id: "n6", label: "구역 경계 정하기", type: "human-gate", summary: "우선순위 구역 경계값을 연구자가 정합니다.", decisionIds: ["zone-thresholds"] },
        { id: "n7", label: "결과 정리", type: "output", summary: "구역 지도와 우선순위 목록, 적용 한계를 만듭니다." },
      ],
      edges: [
        { from: "n1", to: "n2", relation: "next" },
        { from: "n2", to: "n3", relation: "next" },
        { from: "n3", to: "n4", relation: "next" },
        { from: "n4", to: "n5", relation: "next" },
        { from: "n5", to: "n6", relation: "next" },
        { from: "n6", to: "n7", relation: "next" },
      ],
    },
    userDecisions: [
      { id: "block-size", question: "평가 블록 크기", at: "n3" },
      { id: "zone-thresholds", question: "우선순위 구역 경계값", at: "n6" },
    ],
    outputs: [
      { id: "zones", label: "우선순위 구역 지도", kind: "map-raster", formats: ["tif"] },
      { id: "ranking", label: "우선순위 목록", kind: "table", formats: ["csv"] },
      { id: "report", label: "평가 요약", kind: "report", formats: ["md"] },
    ],
    limitations: [
      { kind: "condition", text: "광상 존재를 보장하지 않습니다. 탐사 우선순위의 상대 비교입니다." },
      { kind: "condition", text: "양성 셀이 50개보다 적으면 평가가 불안정합니다." },
      { kind: "not-for", text: "자원량 추정에는 쓰지 않습니다." },
    ],
  },
  instructions: "# 공간 PU 탐사 유망도 분석\n",
  references: [{ path: "references/evidence.md", content: "" }],
  codeFiles: [{ path: "scripts/nested_cv.py", sourceId: code.id, sourcePath: "src/nested_cv.py" }],
  workflow: {
    schemaVersion: "geo-workflow/v1",
    id: "pu-prospectivity",
    title: { ko: "공간 PU 탐사 유망도 Workflow" },
    description: { ko: "격자 자료로 탐사 우선순위 구역을 만듭니다." },
    disciplines: ["mineral-exploration"],
    inputRoles: [{ id: "grid", label: { ko: "격자 셀 표" }, formats: ["csv"], required: true }],
    requiredScientificChoices: [
      { id: "block-size", label: { ko: "평가 블록 크기" }, why: { ko: "공간 누출을 막는 기준입니다." } },
      { id: "zone-thresholds", label: { ko: "구역 경계값" }, why: { ko: "구역 수와 면적이 달라집니다." } },
    ],
    prompt: { ko: "올린 격자 표로 탐사 우선순위 구역을 만들어 주세요." },
    skillIds: ["local:pu-nested-cv-prospectivity"],
    environmentProfile: "geo-mpm",
    expectedArtifacts: [
      { id: "zones", label: { ko: "우선순위 구역 지도" }, files: ["outputs/zones.tif"], required: true },
      { id: "ranking", label: { ko: "우선순위 목록" }, files: ["outputs/ranking.csv"], required: true },
    ],
    boundary: { ko: "탐사 우선순위의 상대 비교이며 광상 존재를 보장하지 않습니다." },
    exampleCaseIds: [],
  },
  recipe: { choices: {}, unresolvedChoices: ["block-size", "zone-thresholds"] },
  evidence: [],
  notes: [],
};

function base(): AuthoringProject {
  return {
    schemaVersion: AUTHORING_PROJECT_SCHEMA,
    id: "ap-fixture0001",
    owner: "local",
    title: "PU 탐사 유망도 논문",
    goal: "다른 지역 격자 자료에 쓸 탐사 방법 만들기",
    target: "auto",
    createdAt: at,
    updatedAt: at,
    sourceRevision: 2,
    sources: [pdf, code],
    extractions: {
      [pdf.id]: {
        sourceId: pdf.id,
        sourceSha256: pdf.sha256,
        tool: "pdftotext",
        pages: 36,
        coveredPages: Array.from({ length: 36 }, (_, i) => i + 1),
        emptyPages: [],
        figures: [],
        characters: 98_000,
        at,
      },
      [code.id]: {
        sourceId: code.id,
        sourceSha256: code.sha256,
        tool: "tar",
        coveredPages: [],
        emptyPages: [],
        figures: [],
        files: [],
        characters: 0,
        at,
      },
    },
    findings: [],
    questions: [],
    decisions: [],
    drafts: [],
    attempts: [],
    packages: [],
    installs: [],
    ops: {},
  };
}

/** Sources received, analysis running. */
export function fixtureReading(): AuthoringProject {
  const p = base();
  p.attempts = [
    {
      id: "att-analyze01",
      op: "analyze",
      opId: "op-1",
      model: "kigam-qwen/qwen3.8-flash-next",
      promptVersion: "analyze/1",
      sourceRevision: 2,
      baseDraftRevision: 0,
      startedAt: new Date(Date.now() - 192_000).toISOString(),
      outcome: "running",
      validationErrors: [],
    },
  ];
  return p;
}

/** Analysis done, five open questions. */
export function fixtureQuestions(): AuthoringProject {
  const p = base();
  p.findings = Array.from({ length: 12 }, (_, i) => ({
    id: `fd-${i}`,
    kind: "method" as const,
    statement: "중첩 공간 블록 교차검증으로 모델 선택과 최종 평가를 분리합니다.",
    anchors: [{ sourceId: pdf.id, page: 9, quote: "nested", verified: true }],
    attemptId: "att-analyze01",
    sourceRevision: 2,
  }));
  p.questions = FIXTURE_QUESTIONS.map((q) => ({ ...q }));
  return p;
}

/** All questions answered, draft revision 1 checked. */
export function fixtureDraft(): AuthoringProject {
  const p = fixtureQuestions();
  p.questions = p.questions.map((q) => ({ ...q, status: "answered" }));
  p.decisions = p.questions.map((q, i) => ({
    id: `dec-${i}`,
    questionId: q.id,
    questionRevision: 1,
    key: q.key,
    response: q.options[0]?.label ?? "",
    optionId: q.options[0]?.id,
    status: "answered",
    by: "local",
    at,
  }));
  p.drafts = [draft];
  return p;
}
