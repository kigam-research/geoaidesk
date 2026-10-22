import type { ReviewBody } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { AuthoringError, now } from "../authoring/store.ts";
import { HubSkillStore } from "./store.ts";
import { revisionOf } from "./view.ts";
export async function reviewHubSkill(store: HubSkillStore, id: string, revision: number, body: ReviewBody, user: string) {
  if (!["checked", "deprecated", "suspended"].includes(body?.state)) throw new AuthoringError("검토 상태를 선택해 주세요.");
  if (typeof body.note !== "string" || !body.note.trim() || body.note.length > 4000) throw new AuthoringError("검토 내용은 1–4000자로 입력해 주세요.");
  if (body.replacement !== undefined && (body.state !== "deprecated" || typeof body.replacement !== "string" || body.replacement === id || !(await store.find(body.replacement))))
    throw new AuthoringError("대신 쓸 허브 스킬을 확인해 주세요.");
  return store.serial(id, async () => {
    const skill = await store.read(id);
    const r = revisionOf(skill, revision);
    if (body.state === "checked" && r.registeredBy === user) throw new AuthoringError("등록한 사람은 같은 판을 확인함으로 바꿀 수 없습니다. 다른 연구자의 검토가 필요합니다.", 403);
    r.reviews.push({ state: body.state, by: user, verified: false, at: now(), note: body.note.trim(), ...(body.replacement ? { replacement: body.replacement } : {}) });
    if (skill.latestRevision === revision) skill.state = body.state;
    skill.updatedAt = now();
    await store.write(skill);
    return r;
  });
}
