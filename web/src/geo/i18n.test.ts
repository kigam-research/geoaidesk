import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./locales", () => ({
  GEO_CATALOGUES: {
    demo: {
      ko: { "file.count": "{count, plural, other {파일 #개}}", "only.ko": "한국어만", "kind": "{kind, select, map {지도} other {파일}} 열기" },
      en: { "file.count": "{count, plural, one {# file} other {# files}}", "kind": "Open {kind, select, map {map} other {file}}" },
    },
  },
}));

import { GEO_LOCALE_STORAGE_KEY, geoLocale, setGeoLocaleSetting, t } from "./i18n";

afterEach(() => localStorage.clear());

describe("geo i18n", () => {
  it("formats ICU plural and select per locale", () => {
    expect(t("demo.file.count", { count: 1 }, "en")).toBe("1 file");
    expect(t("demo.file.count", { count: 3 }, "ko")).toBe("파일 3개");
    expect(t("demo.kind", { kind: "map" }, "ko")).toBe("지도 열기");
    expect(t("demo.kind", { kind: "x" }, "en")).toBe("Open file");
  });

  it("falls back to Korean, then to the id", () => {
    expect(t("demo.only.ko", {}, "en")).toBe("한국어만");
    expect(t("demo.missing", {}, "en")).toBe("demo.missing");
  });

  it("honours a saved language over the browser", () => {
    setGeoLocaleSetting("en");
    expect(localStorage.getItem(GEO_LOCALE_STORAGE_KEY)).toBe("en");
    expect(geoLocale()).toBe("en");
    setGeoLocaleSetting("auto");
    expect(localStorage.getItem(GEO_LOCALE_STORAGE_KEY)).toBeNull();
  });
});
