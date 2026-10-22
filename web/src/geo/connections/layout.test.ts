import { describe, expect, it } from "vitest";
import { layoutConnections } from "./layout";

import { fixture } from "./fixture";

describe("connection layout", () => {
  it("places directed cards left to right without changing source, marks centre and dashes inference", () => {
    const source = structuredClone(fixture), select = () => {};
    const map = layoutConnections(fixture, select);
    expect(map.nodes[0].position.x).toBeLessThan(map.nodes[1].position.x);
    expect(map.nodes[0].data.focus).toBe(true);
    expect(map.edges[0]).toMatchObject({ source: "note:n", target: "paper:p", style: { strokeDasharray: "6 4" } });
    expect(fixture).toEqual(source);
    expect(layoutConnections(fixture, select).nodes.map(n => n.position)).toEqual(map.nodes.map(n => n.position));
  });
});
