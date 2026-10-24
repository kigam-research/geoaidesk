/**
 * Sample researcher data for the place mockups (/dev/places, gaid-ia-connect-workspace). These are the researcher's own
 * project, paper and Workflow names, so they stay out of the locale catalogue like the parts page's sample rows.
 */
import type { HubWorkflowStages } from "@/geo/contracts/hub-shared";

export interface ContinueRow {
  id: string;
  title: string;
  project: string;
  workflow?: string;
  stage?: string;
  state: "running" | "decisions" | "unreviewed" | "checked";
  count?: number;
  when: string;
}

export const CONTINUE: ContinueRow[] = [
  { id: "c1", title: "자철석 광체 3차원 추정", project: "포천 자철석 광체 추정", workflow: "포천 자철석 광체 추정", stage: "처리·모델링", state: "running", when: "지금" },
  { id: "c2", title: "PU 학습 존 분류 결과", project: "Yilgarn 니켈 광상 부존 가능성", workflow: "PU-컨포멀 탐사 우선순위 존 분류", stage: "해석·결과", state: "decisions", count: 2, when: "3시간 전" },
  { id: "c3", title: "PGI 2차 검증 비교", project: "포천 자철석 PGI 2차 검증", workflow: "항공자력·시추 코어 PGI 광체 추정", stage: "평가", state: "unreviewed", when: "어제" },
  { id: "c4", title: "시추 코어 대자율 정리", project: "포천 자철석 PGI 실전 검증", state: "checked", when: "어제" },
];

export interface ProjectRow {
  id: string;
  name: string;
  line: string;
  when: string;
  running?: boolean;
}

export const PROJECTS: ProjectRow[] = [
  { id: "p1", name: "포천 자철석 광체 추정", line: "Workflow 2 · 정리 노트 3", when: "오늘", running: true },
  { id: "p2", name: "Yilgarn 니켈 광상 부존 가능성", line: "Workflow 1 · 정리 노트 4", when: "어제" },
  { id: "p3", name: "포천 자철석 PGI 2차 검증", line: "Workflow 1 · 정리 노트 2", when: "어제" },
  { id: "p4", name: "포천 자철석 PGI 실전 검증", line: "Workflow 1 · 정리 노트 1", when: "어제" },
  { id: "p5", name: "경기육괴 지구화학 탐사", line: "Workflow 1", when: "2일 전" },
];

export interface InstalledWorkflow {
  id: string;
  title: string;
  line: string;
  source: "catalogue" | "shared";
  version?: string;
  ready: boolean;
  projects: number;
}

export const INSTALLED: InstalledWorkflow[] = [
  { id: "w1", title: "PU-컨포멀 탐사 우선순위 존 분류", line: "희소 광상 위치로 탐사 우선순위 존을 나눕니다", source: "shared", version: "0.1.1", ready: true, projects: 2 },
  { id: "w2", title: "포천 자철석 광체 추정", line: "항공자력과 시추 코어로 광체 경계를 추정합니다", source: "shared", version: "0.1.1", ready: true, projects: 1 },
  { id: "w3", title: "분석값 검열 점검과 조성 탐색 그림", line: "검출한계와 단위를 점검하고 조성 그림을 만듭니다", source: "catalogue", ready: true, projects: 3 },
  { id: "w4", title: "공개 지구과학 자료 찾기와 준비", line: "지역과 질문에 맞는 공개 자료를 고릅니다", source: "catalogue", ready: false, projects: 1 },
];

export interface FeaturedCard {
  id: string;
  title: string;
  line: string;
  source: "catalogue" | "shared";
  author?: string;
  stars: number;
  stages: HubWorkflowStages;
}

const ko = (value: string) => ({ ko: value });

export const FEATURED: FeaturedCard[] = [
  {
    id: "f1",
    title: "PU-컨포멀 탐사 우선순위 존 분류",
    line: "알려진 광상 위치가 희소한 격자 표에 Positive-Unlabeled 배깅, 부트스트랩 앙상블 불확실성, 크로스-컨포멀 보정을 결합해 탐사 우선순위 존을 나눕니다.",
    source: "shared",
    author: "seongin",
    stars: 1,
    stages: {
      titles: ["자료 준비", "PU 배깅 학습", "컨포멀 보정", "존 분류", "해석·결과"].map(ko),
      inputs: ["CSV", "GeoTIFF"],
      outputs: ["우선순위 존 지도", "보정 표"].map(ko),
    },
  },
  {
    id: "f2",
    title: "분석값 검열 점검과 조성 탐색 그림",
    line: "다원소 분석값의 단위·검출한계·한정자를 점검하고 조성 자료로 탐색 그림을 만듭니다.",
    source: "catalogue",
    stars: 0,
    stages: { titles: ["입력·단위·방법", "검열·폐쇄 점검", "원소·대체 방법 선택", "조성 그림"].map(ko), inputs: ["CSV", "XLSX"], outputs: ["검열 점검 표"].map(ko) },
  },
  {
    id: "f3",
    title: "공개 지구과학 자료 찾기와 준비",
    line: "지역과 질문에 맞는 공개 자료처를 고르고, 요청한 파일이나 격자 표를 준비합니다.",
    source: "catalogue",
    stars: 0,
    stages: { titles: ["요청 확인", "수집처 제안", "자료군 목록과 선택", "내려받기·정리"].map(ko), inputs: ["GeoJSON", "Shapefile"], outputs: ["자료처 후보와 범위"].map(ko) },
  },
];

export const SHARED = [
  { id: "s1", title: "PU-컨포멀 탐사 우선순위 존 분류", line: "격자 표에 PU 배깅·부트스트랩 앙상블·크로스-컨포멀 보정·존 분류를 적용합니다", folder: "광상 부존 가능성(MPM)", author: "seongin", version: "0.1.1", stars: 1, stages: 5 },
  { id: "s2", title: "포천 자철석 광체 추정", line: "항공자력과 시추 코어로 자철석 광체의 경계와 부피를 추정합니다", folder: "지구물리 역산", author: "seongin", version: "0.1.1", stars: 0, stages: 4 },
  { id: "s3", title: "항공자력·시추 코어 PGI 광체 추정", line: "항공자력과 시추 코어 자료로 자철석 광체의 3차원 분포를 추정합니다", folder: "지구물리 역산", author: "seongin", version: "0.2.0", stars: 0, stages: 5 },
];

export const FEEDS = [
  { id: "n1", title: "Machine learning for mineral prospectivity: a review of uncertainty quantification", source: "Ore Geology Reviews", when: "오늘" },
  { id: "n2", title: "Joint inversion of magnetic and gravity data with petrophysical constraints", source: "Geophysics", when: "어제" },
  { id: "n3", title: "pi-subagents 0.75.0", source: "GitHub releases", when: "2일 전" },
];

export interface PaperRow {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  source: "Zotero" | "GAID";
  projects: number;
  workflows: number;
  key: string;
  cited?: number;
  page?: number;
  inProject?: boolean;
  note?: boolean;
}

export const PAPERS: PaperRow[] = [
  { id: "a1", title: "Application of petrophysically and geologically guided inversion to aeromagnetic and drilling data for investigation of magnetite ore in Pocheon, Korea", authors: "Heo 외", journal: "Geosciences Journal", year: 2025, source: "Zotero", projects: 3, workflows: 2, key: "heo2025", cited: 3, page: 6, inProject: true },
  { id: "a2", title: "Petrophysically and geologically guided multi-physics inversion using a dynamic Gaussian mixture model", authors: "Astic 외", journal: "Geophysical Journal International", year: 2020, source: "GAID", projects: 3, workflows: 1, key: "astic2020", cited: 1, page: 4, inProject: true },
  { id: "a3", title: "Uncertainty-Aware Mineral Prospectivity Mapping with Positive-Unlabeled Learning and Conformal Calibration", authors: "Ahn 외", journal: "Natural Resources Research", year: 2026, source: "GAID", projects: 1, workflows: 1, key: "ahn2026" },
  { id: "a4", title: "Predicting into unknown space? Estimating the area of applicability of spatial prediction models", authors: "Meyer · Pebesma", journal: "Methods in Ecology and Evolution", year: 2021, source: "GAID", projects: 1, workflows: 0, key: "meyer2021", inProject: true },
  { id: "a5", title: "Geologically constrained inversion of magnetic data in the Gyeonggi Massif", authors: "Kim 외", journal: "Journal of Applied Geophysics", year: 2023, source: "Zotero", projects: 0, workflows: 0, key: "kim2023" },
];

export const NOTES = [
  { id: "r1", title: "포천 자철석 PGI 2차 검증 정리", project: "포천 자철석 PGI 2차 검증", when: "어제" },
  { id: "r2", title: "Yilgarn PU 학습 존 분류 정리", project: "Yilgarn 니켈 광상 부존 가능성", when: "2일 전" },
];

export const FOLDERS = [
  { id: "d1", name: "광상 부존 가능성", count: 1 },
  { id: "d2", name: "수용 시험 - 공간 검증", count: 3 },
  { id: "d3", name: "포천 자철석 PGI", count: 2 },
];

export const FILES = ["user_data", "연구노트", "results", "scripts"];
