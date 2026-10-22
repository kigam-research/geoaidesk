/** Synthetic UI test examples, never bundled as hub content. */
import type { HubSkillDetail, RegisterSkillPreview, InstallSkillPreview } from "@/geo/contracts/hub-skills";
export function detailFixture(): HubSkillDetail {
  return {
    revision: 2, content: "# 표 자료 확인\n\n분석 전에 ID와 단위를 확인합니다.\n\n## 절차\n\n1. 입력 열과 결측값을 읽습니다.\n2. ID가 겹치거나 단위가 다른 곳을 정리합니다.\n3. 결과를 연구노트에 남깁니다.", files: ["SKILL.md", "scripts/check.py", "references/columns.md"], comments: [{ id: "comment-1", entryId: "table-check", author: "김연구", body: "단위가 없는 열은 분석 전에 확인했습니다.", revision: 2, at: "2026-10-22T00:00:00Z" }],
    skill: {
      id: "table-check", name: "table-check", description: "표 자료의 ID와 단위를 확인하고 분석 전 볼 곳을 정리합니다.", tags: ["표 자료"], formats: ["csv"], folderId: "tables", author: "박연구", latestRevision: 2, state: "checked", visibility: "hub", stars: 4, starredByMe: false, comments: 1, updatedAt: "2026-10-22T00:00:00Z", usedBy: [{ entryId: "table-analysis", revision: 3, title: "시료 분석표 확인", skillRevision: 2 }],
      revisions: [1, 2].map((revision) => ({ revision, archiveSha256: "a".repeat(64), size: 2048, treeHash: "b".repeat(64), files: [{ path: "SKILL.md", sha256: "c".repeat(64), size: 300 }], description: "표 자료의 ID와 단위를 확인하고 분석 전 볼 곳을 정리합니다.", note: revision === 2 ? "단위를 확인하는 절차를 더했습니다." : "표 자료 확인 절차를 올렸습니다.", registeredAt: "2026-10-22T00:00:00Z", registeredBy: "박연구", origin: { kind: "own" }, licence: { state: "institute" }, findings: [{ kind: "shell", file: "SKILL.md", line: 8, excerpt: "Run scripts/check.py before analysis." }], reviews: revision === 2 ? [{ state: "checked", by: "이연구", verified: false, at: "2026-10-22T01:00:00Z", note: "ID 비교와 단위 확인 절차를 읽었습니다." }] : [] })),
    },
  };
}
export function previewFixture(overrides: Partial<RegisterSkillPreview> = {}): RegisterSkillPreview {
  const r = detailFixture().skill.revisions[1];
  return { name: "table-check", description: r.description, files: r.files, treeHash: r.treeHash, origin: r.origin, licence: r.licence, findings: r.findings, ...overrides };
}
export function installFixture(overrides: Partial<InstallSkillPreview> = {}): InstallSkillPreview {
  return { name: "table-check", revision: 2, files: detailFixture().files, hasCode: true, licence: { state: "institute" }, findings: [], state: "checked", project: "missing", ...overrides };
}
