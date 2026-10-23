import { ORCID_LIMITS, type OrcidWork } from "@/geo/contracts/orcid";

export const alreadyOwn = (work: OrcidWork) => work.match.kind === "in-library" && work.match.ownWork;
export function defaultSelection(works: OrcidWork[]): number[] {
  return works.filter((w) => !alreadyOwn(w) && w.match.kind !== "similar").slice(0, ORCID_LIMITS.confirm).map((w) => w.putCode);
}
export function selectNew(works: OrcidWork[]): number[] {
  return works.filter((w) => w.match.kind === "new").slice(0, ORCID_LIMITS.confirm).map((w) => w.putCode);
}
