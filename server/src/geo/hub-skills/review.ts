import type { ReviewBody } from "../../../../web/src/geo/contracts/hub-skills.ts";
import { AuthoringError } from "../authoring/store.ts";
import { displayNameActor, type Actor } from "../hub-shared/records.ts";
import type { HubSkillRecordStore } from "./records.ts";

/** Validates the request; the store appends it and enforces who may review (records.ts `review`). */
export async function reviewHubSkill(store: HubSkillRecordStore, id: string, revision: number, body: ReviewBody, user: Actor | string) {
  if (!["checked", "deprecated", "suspended"].includes(body?.state)) throw new AuthoringError("검토 상태를 선택해 주세요.");
  if (typeof body.note !== "string" || !body.note.trim() || body.note.length > 4000) throw new AuthoringError("검토 내용은 1–4000자로 입력해 주세요.");
  if (body.replacement !== undefined && (body.state !== "deprecated" || typeof body.replacement !== "string" || body.replacement === id || !(await store.find(body.replacement))))
    throw new AuthoringError("대신 쓸 허브 스킬을 확인해 주세요.");
  const actor = typeof user === "string" ? displayNameActor(user) : user;
  return store.review(id, revision, { state: body.state, note: body.note.trim(), ...(body.replacement ? { replacement: body.replacement } : {}) }, actor);
}
