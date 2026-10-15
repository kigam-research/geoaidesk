import { describe, expect, it } from "vitest";
import { geoCatalogueUpstreams, skillUpstreamResolver, upstreamFor } from "../src/geo/skill-origin.ts";
import type { GeoCatalogueIndex } from "../src/geo/catalogue-types.ts";

const index = {
  schemaVersion: "geo-catalogue/v1",
  catalogueVersion: "0.0.1",
  generatedFrom: { repository: "kigam-research/skill_hub", sourceCommit: "abc", dirty: false },
  skills: [
    {
      id: "k-dense/geopandas",
      runtimeName: "geopandas",
      origin: "import",
      title: { ko: "geopandas" },
      packageRef: "runtime/skills/geopandas",
      packageDigest: "0",
      sourceRevision: {
        kind: "import",
        repository: "K-Dense-AI/scientific-agent-skills",
        commit: "92ace75ac21efe19a620434e0ca4e356081fe807",
        path: "skills/geopandas",
      },
    },
    {
      id: "kigam/geo-map-and-crs",
      runtimeName: "geo-map-and-crs",
      origin: "owned",
      title: { ko: "지도" },
      packageRef: "runtime/skills/geo-map-and-crs",
      packageDigest: "0",
      sourceRevision: { kind: "owned", version: "0.1.0" },
    },
  ],
} as GeoCatalogueIndex;

describe("skill sources (gaid-brand-copy)", () => {
  it("names imported catalogue skills by their source project and links the imported folder", () => {
    const map = geoCatalogueUpstreams({ index });
    expect(map.get("geopandas")).toEqual({
      name: "K-Dense",
      repository: "K-Dense-AI/scientific-agent-skills",
      url: "https://github.com/K-Dense-AI/scientific-agent-skills/tree/92ace75ac21efe19a620434e0ca4e356081fe807/skills/geopandas",
    });
    expect(map.has("geo-map-and-crs")).toBe(false);
  });

  it("attributes only catalogue-origin skills, and nothing when the catalogue cannot load", () => {
    const geo = skillUpstreamResolver({ geoMode: true, load: () => ({ index }) });
    expect(geo("geopandas", "catalogue")?.name).toBe("K-Dense");
    expect(geo("geopandas", "registry")).toBeUndefined();
    expect(geo("geo-map-and-crs", "catalogue")).toBeUndefined();
    const broken = skillUpstreamResolver({ geoMode: true, load: () => { throw new Error("missing"); } });
    expect(broken("geopandas", "catalogue")).toBeUndefined();
  });

  it("uses the configured or recorded repository in upstream catalogue mode", () => {
    const upstream = skillUpstreamResolver({ geoMode: false, skillsRepo: "K-Dense-AI/scientific-agent-skills" });
    expect(upstream("scanpy", "catalogue")).toEqual({
      name: "K-Dense",
      repository: "K-Dense-AI/scientific-agent-skills",
      url: "https://github.com/K-Dense-AI/scientific-agent-skills",
    });
    expect(upstream("docx", "catalogue", "anthropics/skills")?.name).toBe("anthropics/skills");
    expect(upstream("mine", "local")).toBeUndefined();
    expect(upstreamFor("not a repo")).toBeUndefined();
  });
});
