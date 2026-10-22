import type { ConnectionMapResponse } from "@/geo/contracts/connections";

export const fixture: ConnectionMapResponse = {
  focus: "note:n", truncated: false,
  nodes: [
    { id: "note:n", kind: "note", title: "분석 결과", detail: null, depth: 0, attention: null, open: { kind: "note", ref: "n" } },
    { id: "paper:p", kind: "paper", title: "근거 논문", detail: null, depth: 1, attention: null, open: { kind: "paper", ref: "p" } },
  ],
  edges: [{ from: "note:n", to: "paper:p", kind: "cites", confidence: "inferred" }],
};