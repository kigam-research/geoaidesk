import { describe, expect, it } from "vitest";

import type { InputPort } from "@/geo/contracts/authoring";
import { exampleColumns } from "./io-examples";

const port = (columns: string[]) => ({ id: "grid", label: "grid", formats: ["csv"], constraints: { columns } }) as unknown as InputPort;

describe("exampleColumns", () => {
  it("keeps a trailing label column of a long column list", () => {
    expect(exampleColumns(port(["x", "y", "pred1", "pred2", "...", "predK", "label"]))).toEqual([
      "x", "y", "pred1", "…", "predK", "label",
    ]);
  });
  it("shows short lists unchanged and falls back to a generic layout", () => {
    expect(exampleColumns(port(["x", "y", "label"]))).toEqual(["x", "y", "label"]);
    expect(exampleColumns(port([]))).toContain("label");
  });
});
