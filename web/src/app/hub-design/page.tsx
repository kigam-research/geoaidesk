"use client";
// TEMPORARY design-review page for task gaid-hub (fixture data, no backend calls). Remove before finish.
import { useState } from "react";

import { DraftStep, TrialCard } from "@/geo/hub/draft-step";
import { FIXTURE_QUESTIONS, fixtureDraft, fixtureQuestions, fixtureReading } from "@/geo/hub/fixtures";
import { HubHome } from "@/geo/hub/hub-home";
import { HubShell, ProjectBar, type HubStep } from "@/geo/hub/hub-shell";
import { QuestionStep, type DraftAnswer } from "@/geo/hub/question-step";
import { SourceStep, WorkingPanel } from "@/geo/hub/source-step";

export default function HubDesign() {
  const view = typeof window === "undefined" ? "home" : new URLSearchParams(window.location.search).get("view") ?? "home";
  const [answers, setAnswers] = useState<Record<string, DraftAnswer>>(() =>
    view === "review"
      ? Object.fromEntries(FIXTURE_QUESTIONS.map((q, i) => [q.id, i === 4 ? { response: "탐사 대상 선정 회의 자료" } : { optionId: q.recommendedOptionId ?? q.options[0].id }]))
      : view === "questions"
        ? { [FIXTURE_QUESTIONS[0].id]: { optionId: "generalize" } }
        : {},
  );
  const [consent, setConsent] = useState(false);
  const nav = () => undefined;
  const bar = (step: HubStep, reached: HubStep[]) => (
    <ProjectBar title="PU 탐사 유망도 논문" step={step} reached={reached} onStep={nav} onBack={nav} />
  );
  if (view === "home")
    return (
      <HubShell onNavigate={nav}>
        <HubHome
          projects={[
            { id: "a", title: "PU 탐사 유망도 논문", owner: "local", updatedAt: "2026-10-16T02:10:00Z", stage: "draft", busy: null, sources: 2, openQuestions: 0, latestDraft: 1, methodTitle: "공간 PU 탐사 유망도 분석" },
            { id: "b", title: "양수시험 해석 논문", owner: "local", updatedAt: "2026-10-15T08:00:00Z", stage: "questions", busy: null, sources: 1, openQuestions: 4 },
            { id: "c", title: "검층 QC 메모", owner: "local", updatedAt: "2026-10-14T08:00:00Z", stage: "sources", busy: "analyze", sources: 1, openQuestions: 0 },
          ]}
          onCreate={nav}
          onOpen={nav}
        />
      </HubShell>
    );
  if (view === "sources") {
    const p = fixtureReading();
    p.attempts = [];
    return (
      <HubShell onNavigate={nav}>
        {bar("sources", ["sources"])}
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <SourceStep project={p} goal="다른 지역 격자 자료에 쓸 탐사 방법 만들기" onGoal={nav} target="auto" onTarget={nav} onFiles={nav} onRemove={nav} onStart={nav} />
        </main>
      </HubShell>
    );
  }
  if (view === "reading") {
    const p = fixtureReading();
    return (
      <HubShell onNavigate={nav}>
        {bar("sources", ["sources"])}
        <main className="min-h-0 flex-1 overflow-y-auto px-6">
          <WorkingPanel project={p} attempt={p.attempts[0]} title="자료를 읽고 있습니다" note="보통 몇 분 걸립니다. 화면을 닫아도 계속 진행됩니다." />
        </main>
      </HubShell>
    );
  }
  if (view === "questions" || view === "review") {
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
          />
        </main>
      </HubShell>
    );
  }
  const p = fixtureDraft();
  return (
    <HubShell onNavigate={nav}>
      {bar("draft", ["sources", "questions", "draft", "trial"])}
      <main className="min-h-0 flex-1 px-6 py-5">
        <DraftStep
          draft={p.drafts[0]}
          trialCount={0}
          checkIssues={0}
          rail={
            <TrialCard
              projects={[{ id: "default", name: "Default" }, { id: "p2", name: "Yilgarn 시험" }]}
              projectId="p2"
              onProject={nav}
              consent={consent}
              onConsent={setConsent}
              onInstall={nav}
            />
          }
        />
      </main>
    </HubShell>
  );
}
