/**
 * Sample researcher data for the 문헌 정리 mockups (/dev/library-prep, gaid-library-prep). These are the researcher's own
 * paper, folder, project and Workflow names, so they stay out of the locale catalogue like the parts page's sample rows.
 */

export interface PaperRow {
  id: string;
  title: string;
  authors: string;
  year: number;
  key: string;
  pdf: boolean;
  /** Added to the folder after the GAID 문헌 정리 was made. */
  late?: boolean;
}

export const FOLDER = { id: "d3", name: "포천 자철석 PGI", project: "포천 자철석 광체 추정" };

export const PAPERS: PaperRow[] = [
  { id: "a1", title: "Application of petrophysically and geologically guided inversion to aeromagnetic and drilling data for investigation of magnetite ore in Pocheon, Korea", authors: "Heo 외", year: 2025, key: "heo2025", pdf: true },
  { id: "a2", title: "Petrophysically and geologically guided multi-physics inversion using a dynamic Gaussian mixture model", authors: "Astic 외", year: 2020, key: "astic2020", pdf: true },
  { id: "a3", title: "Petrophysically guided geophysical inversion using a dynamic Gaussian mixture model prior", authors: "Astic · Oldenburg", year: 2019, key: "astic2019", pdf: true },
  { id: "a4", title: "3D inversion of magnetic data", authors: "Li · Oldenburg", year: 1996, key: "li1996", pdf: true },
  { id: "a5", title: "Geologically constrained inversion of magnetic data in the Gyeonggi Massif", authors: "Kim 외", year: 2023, key: "kim2023", pdf: false },
  { id: "a6", title: "Magnetic susceptibility of drill cores from the Pocheon iron deposit", authors: "Park 외", year: 2022, key: "park2022", pdf: true, late: true },
];

export const FOLDERS = [
  { id: "d1", name: "광상 부존 가능성", count: 4 },
  { id: "d2", name: "공간 검증", count: 3 },
  { id: "d3", name: "포천 자철석 PGI", count: PAPERS.length },
];

export interface DigestRow {
  id: string;
  title: string;
  origin: "gaid" | "gemini";
  /** The general Workflow that made a GAID 문헌 정리, or the imported file name. */
  made: string;
  date: string;
  covers: number;
  unmatched?: number;
  state: "unreviewed" | "checked";
}

export const DIGESTS: DigestRow[] = [
  { id: "g1", title: "포천 자철석 PGI 문헌 정리", origin: "gaid", made: "논문 비교", date: "2026-10-24", covers: 5, state: "unreviewed" },
  { id: "g2", title: "Pocheon magnetite briefing", origin: "gemini", made: "Pocheon_magnetite_briefing.docx", date: "2026-10-22", covers: 4, unmatched: 1, state: "unreviewed" },
  { id: "g3", title: "광상 부존 가능성 PU 학습 문헌 정리", origin: "gaid", made: "논문 요약", date: "2026-10-18", covers: 4, state: "checked" },
];

/** Section outline of the GAID 문헌 정리 (what the general Workflow wrote, mirrored as the item's text snapshot). */
export const DIGEST_OUTLINE = [
  { heading: "연구 질문", body: "항공자력과 시추 코어 대자율로 포천 자철석 광체의 3차원 경계를 추정할 때, 암석물리·지질 제약 역산이 무엇을 더하는가" },
  { heading: "핵심 주장", body: "암석물리 제약(PGI)을 넣은 역산은 대자율 분포를 시추 자료와 더 잘 맞추고, 광체 경계를 더 좁게 그린다 [@heo2025, p. 6; @astic2020, p. 4]." },
  { heading: "방법 비교", body: "논문 5편 · 역산 방식, 제약, 자료, 검증 방법을 한 표로 비교" },
  { heading: "자료와 한계", body: "공개 자료 없음 2편, 시추공 밀도 차이, 대자율 임계값 가정" },
  { heading: "인용 목록", body: "인용 31건 · 모두 서재 논문의 쪽 인용" },
];

export const NOTEBOOK_URL = "https://notebooklm.google.com/notebook/7c1e…";

export const WORKFLOW = { title: "포천 자철석 광체 추정", version: "0.1.1", purpose: "항공자력과 시추 코어 대자율로 자철석 광체의 3차원 경계와 부피를 추정합니다." };

/** Sample of the model-facing start-message section (shown behind "AI agent가 받는 지침"; wording is phase 2 work). */
export const INSTRUCTIONS_SAMPLE = "## 먼저 읽을 문헌 정리\n<library-digest key=\"digest:pocheon-pgi-2026-10-24\" status=\"검토 전\" covers=\"heo2025 astic2020 astic2019 li1996 kim2023\">\n포천 자철석 PGI 문헌 정리\n</library-digest>\n분석을 시작하기 전에 library_digest로 정리를 읽으세요. 결과에 쓰는 주장은 library_read로 원래 논문의 쪽을 확인하고 [@key, p. N]으로 인용하세요. 정리 자체는 인용하지 마세요.";
