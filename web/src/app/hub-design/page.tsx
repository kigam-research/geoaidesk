"use client";
// TEMPORARY design-review page for task gaid-hub (fixture data and mock images under public/hub-design-mock, which is
// never committed). Remove both before finish.
import { useState } from "react";

import { DraftStep, TrialCard } from "@/geo/hub/draft-step";
import { FIXTURE_QUESTIONS, fixtureDraft, fixtureQuestions, fixtureReading } from "@/geo/hub/fixtures";
import { RegisterDialog } from "@/geo/hub/hub-dialogs";
import { HubHome } from "@/geo/hub/hub-home";
import { HubShell, ProjectBar, type HubStep } from "@/geo/hub/hub-shell";
import { MethodFlow } from "@/geo/hub/method-flow";
import { QuestionStep, type DraftAnswer, type QuestionFigure } from "@/geo/hub/question-step";
import { SharedMethod } from "@/geo/hub/shared-method";
import { ReadingView, SourceStep } from "@/geo/hub/source-step";
import { API_BASE } from "@/lib/projects";

const M = "/hub-design-mock";
const SMOKE_PDF = `${API_BASE}/geo/authoring/projects/ap-a135f290-1c4/sources/src-93486098-d56/original`;

const visuals = {
  n1: { src: `${M}/fig-6.png`, kind: "paper" as const, caption: "Fig. 1 지질 배경과 예측 변수 (6쪽)" },
  n2: { src: `${M}/concept/step-spatial-cv.png`, kind: "generated" as const, caption: "공간 의존성과 블록 나누기" },
  n4: { src: `${M}/fig-10.png`, kind: "paper" as const, caption: "Fig. 2 중첩 공간 블록 교차검증 (10쪽)" },
  n5: { src: `${M}/concept/step-uncertainty.png`, kind: "generated" as const, caption: "부트스트랩 불확실성과 컨포멀 집합" },
  n6: { src: `${M}/fig-15.png`, kind: "paper" as const, caption: "Fig. 3 구역 분류 절차 (15쪽)" },
  n7: { src: `${M}/concept/step-zones.png`, kind: "generated" as const, caption: "우선순위 구역 지도" },
};
const outputImages = {
  zones: { src: `${M}/fig-20.png`, kind: "paper" as const, caption: "Fig. 6 구역 지도 (20쪽)" },
};

const figures = (q: { key: string }): QuestionFigure[] =>
  q.key === "scope"
    ? [
        { src: `${M}/fig-6.png`, label: "Fig. 1", page: 6, caption: "Geological setting, variogram analysis, and representative predictor layers.", note: "논문의 예측 변수는 Yilgarn Ni 시스템에 맞춰져 있습니다. 다른 지역에서는 변수 구성이 달라집니다." },
        { src: `${M}/fig-20.png`, label: "Fig. 6", page: 20, caption: "Spatial practical zone classification maps under the lift-based framework." },
      ]
    : q.key === "zone-thresholds"
      ? [{ src: `${M}/fig-15.png`, label: "Fig. 3", page: 15, caption: "Practical zone classification workflow combining bootstrap mean probability, ρIQR uncertainty, conformal membership.", note: "구역 경계(lift 백분위, ρIQR)가 결과 지도의 구역 수와 면적을 정합니다." }]
      : [{ src: `${M}/fig-10.png`, label: "Fig. 2", page: 10, caption: "Nested spatial block cross-validation design." }];

export default function HubDesign() {
  const view = typeof window === "undefined" ? "home" : (new URLSearchParams(window.location.search).get("view") ?? "home");
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>(() =>
    view === "questions" ? { [FIXTURE_QUESTIONS[0].id]: { optionId: "generalize" } } : {},
  );
  const [folder, setFolder] = useState("pu");
  const [register, setRegister] = useState(view === "register");
  const nav = () => undefined;
  const bar = (step: HubStep, reached: HubStep[]) => (
    <ProjectBar title="PU 탐사 유망도 논문" step={step} reached={reached} onStep={nav} onBack={nav} />
  );
  const draft = fixtureDraft().drafts[0];

  if (view === "home")
    return (
      <HubShell onNavigate={nav}>
        <HubHome
          recommended={[
            { id: "r1", title: "공간 PU 탐사 유망도 분석", line: "희소한 광상 기록과 격자 자료로 탐사 우선순위 구역을 만듭니다.", image: `${M}/concept/step-zones.png`, source: "shared", stars: 24, author: "연구자 A" },
            { id: "r2", title: "검층 QC와 다중 트랙 보기", line: "심도·단위·결측·이상 후보를 원자료를 보존하며 표시합니다.", image: `${M}/concept/wf-well-log-qc.png`, source: "catalogue", stars: 18 },
            { id: "r3", title: "양수시험 진단과 후보 모델 비교", line: "시간-수위강하 자료로 진단 그림을 만들고 후보 모델을 비교합니다.", image: `${M}/concept/wf-pumping-test.png`, source: "catalogue", stars: 11 },
            { id: "r4", title: "분석값 조성 탐색 그림", line: "분석값의 검출한계·단위를 점검하고 조성 그림을 만듭니다.", image: `${M}/concept/wf-assay-composition.png`, source: "catalogue", stars: 9 },
          ]}
          folders={[
            { id: "all", name: "전체", count: 5 },
            { id: "pu", name: "광물 탐사", count: 2 },
            { id: "gw", name: "지하수", count: 2 },
            { id: "log", name: "검층", count: 1 },
          ]}
          folderId={folder}
          onFolder={setFolder}
          onNewFolder={nav}
          projects={[
            { id: "a", title: "PU 탐사 유망도 논문", owner: "local", updatedAt: "2026-10-16T02:10:00Z", stage: "draft", busy: null, sources: 2, openQuestions: 0, latestDraft: 4, methodTitle: "공간 PU 탐사 유망도 분석" },
            { id: "b", title: "구리 반암 탐사 메모", owner: "local", updatedAt: "2026-10-15T08:00:00Z", stage: "questions", busy: null, sources: 1, openQuestions: 3 },
          ]}
          onCreate={nav}
          onOpen={nav}
        />
      </HubShell>
    );
  if (view === "shared")
    return (
      <HubShell onNavigate={nav}>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <SharedMethod
            method={{
              id: "r1",
              title: "공간 PU 탐사 유망도 분석",
              summary: "알려진 광상 셀과 미표지 셀로 PU 모델을 학습하고, 공간 블록 교차검증과 보정으로 탐사 우선순위 구역을 정합니다.",
              author: "연구자 A",
              folder: "광물 탐사",
              revision: 4,
              registeredAt: "2026. 10. 16.",
              kind: "workflow",
              tags: ["광물 탐사", "PU 학습", "공간 교차검증", "격자 표"],
              stars: 24,
              starred: false,
              trials: 3,
              image: `${M}/concept/step-zones.png`,
              comments: [
                { id: "c1", author: "연구자 B", at: "2026. 10. 16. 14:20", revision: 4, body: "Gawler 격자(10 km)로 빠른 시험을 돌렸습니다. 바리오그램 표본 상한 덕분에 6분에 끝났습니다. 구역 경계는 우리 자료에서 다시 정해야 했습니다." },
                { id: "c2", author: "연구자 C", at: "2026. 10. 16. 15:02", revision: 4, body: "입력 표의 좌표 열 이름이 x, y로 고정되어 있어 easting/northing 자료는 이름을 바꿔야 했습니다. 열 이름을 고를 수 있으면 좋겠습니다." },
              ],
            }}
            flow={<MethodFlow profile={draft.profile} visuals={visuals} outputImages={outputImages} />}
            onStar={nav}
            onComment={nav}
            onTry={nav}
          />
        </main>
      </HubShell>
    );
  if (view === "sources") {
    const p = fixtureReading();
    p.attempts = [];
    return (
      <HubShell onNavigate={nav}>
        {bar("sources", ["sources"])}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <SourceStep
            project={p}
            goal="다른 지역 격자 자료에 쓸 탐사 방법 만들기"
            onGoal={nav}
            target="auto"
            onTarget={nav}
            onFiles={nav}
            onRemove={nav}
            onStart={nav}
            onUrl={nav}
            urls={[
              { url: "https://doi.org/10.1007/s11053-026-10778-w", kind: "paper", status: "fetched", title: "Uncertainty-Aware Mineral Prospectivity Mapping … (Natural Resources Research)" },
              { url: "https://www.ga.gov.au/scientific-topics/minerals/mineral-potential", kind: "search", status: "fetching" },
            ]}
          />
        </main>
      </HubShell>
    );
  }
  if (view === "reading") {
    const p = fixtureReading();
    return (
      <HubShell onNavigate={nav}>
        {bar("sources", ["sources"])}
        <main className="min-h-0 flex-1 px-6 py-5">
          <ReadingView
            project={p}
            attempt={p.attempts[0]}
            title="자료를 읽고 있습니다"
            note="화면을 닫아도 계속 진행됩니다."
            pdf={{ name: "author-manuscript.pdf", url: SMOKE_PDF }}
          />
        </main>
      </HubShell>
    );
  }
  if (view === "questions") {
    const p = fixtureQuestions();
    return (
      <HubShell onNavigate={nav}>
        {bar("questions", ["sources", "questions"])}
        <main className="min-h-0 flex-1 px-6 py-5">
          <QuestionStep
            questions={p.questions}
            answers={answers}
            onAnswer={(id, a) => setAnswers((cur) => ({ ...cur, [id]: a }))}
            onApply={nav}
            figures={figures}
          />
        </main>
      </HubShell>
    );
  }
  return (
    <HubShell onNavigate={nav}>
      {bar("draft", ["sources", "questions", "draft", "trial"])}
      <main className="min-h-0 flex-1 px-6 py-5">
        <DraftStep
          draft={draft}
          trialCount={0}
          checkIssues={0}
          visuals={visuals}
          outputImages={outputImages}
          onRegister={() => setRegister(true)}
          rail={
            <TrialCard
              projects={[{ id: "y", name: "Yilgarn 시험" }]}
              projectId="y"
              onProject={nav}
              consent={false}
              onConsent={nav}
              onInstall={nav}
            />
          }
        />
      </main>
      <RegisterDialog
        open={register}
        onOpenChange={setRegister}
        folders={[
          { id: "pu", name: "광물 탐사" },
          { id: "gw", name: "지하수" },
        ]}
        onRegister={async () => undefined}
      />
    </HubShell>
  );
}
