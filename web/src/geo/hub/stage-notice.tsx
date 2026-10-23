"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckResult } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";
import { TechnicalDetail } from "./technical";

const text = geoText("hub");

/** Package-check findings about analysis-flow stages (gaid-workflow-stages, server code `workflow-stages`). */
export const stageFindings = (check: CheckResult | null) => (check?.findings ?? []).filter((f) => f.code === "workflow-stages");

/**
 * Fixed request that revises a draft into analysis-flow stages (the upgrade path for drafts written before stages).
 * Model-facing text, like `issuesFeedback`; the researcher reviews the new revision as with any revise.
 */
export function stagesFeedback(findings: CheckResult["findings"]): string {
  return [
    "Workflow를 분석 흐름 단계로 다시 나눠 주세요. 자료 준비 → 처리·모델링 → 평가 → 해석·결과처럼 연구·자료 분석 흐름에 맞춰 3~5단계로 묶고, 입력 자료나 조건 하나마다 단계를 만들지 마세요.",
    "각 단계에는 처음 쓰는 입력 자료(inputIds)와 조건(choiceIds)을 적고, 같은 종류의 파일 여러 개는 입력 하나(multiple)로 받으세요.",
    "연구자가 시작할 때 꼭 정할 조건은 6개 이하로 두고, 나머지 조건에는 기본값(default)을 주세요. 기본값이 결과를 바꿀 수 있으면 why에 그렇게 적어 주세요.",
    "방법의 처리 단계, 자료 종류, 비교하는 변형, 해석·검증 기준은 하나도 빼지 말고 단계 안에 담아 주세요. SKILL.md 처리 절차의 절 제목은 새 단계 이름과 맞춰 주세요. 연구자의 결정과 그 밖의 내용은 바꾸지 마세요.",
    "검사에서 나온 점:",
    ...findings.map((f) => `- ${f.message}`),
  ].join("\n");
}

/** Shown on the draft and in the registration preview when the Workflow is not organised by analysis-flow stage. */
export function StageNotice({ check, onRevise }: { check: CheckResult | null; onRevise?: (feedback: string) => Promise<void> }) {
  const findings = stageFindings(check);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (!findings.length) return null;
  return (
    <section aria-label={text("stages.title")} className="flex flex-col gap-2 rounded-lg border border-[var(--gaid-warning)]/40 p-3 text-sm">
      <div className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-[var(--gaid-warning)]" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h4 className="font-semibold">{text("stages.title")}</h4>
          <p className="max-w-[640px] text-muted-foreground">{text("stages.body")}</p>
        </div>
      </div>
      <details className="pl-6">
        <summary className="cursor-pointer text-primary">{text("stages.detail", { count: findings.length })}</summary>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
          {findings.map((f, i) => (
            <li key={i}>{f.message}</li>
          ))}
        </ul>
      </details>
      {onRevise && (
        <div className="flex flex-wrap items-center gap-3 pl-6">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFailed(null);
              try {
                await onRevise(stagesFeedback(findings));
              } catch (e) {
                setFailed((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {text("stages.action")}
          </Button>
          <span className="text-xs text-muted-foreground">{text("stages.reviewNote")}</span>
        </div>
      )}
      {failed && (
        <div className="pl-6">
          <p className="text-destructive">{text("stages.failed")}</p>
          <TechnicalDetail detail={failed} />
        </div>
      )}
    </section>
  );
}
