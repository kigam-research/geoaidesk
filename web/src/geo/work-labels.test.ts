import { afterEach, describe, expect, it } from "vitest";
import databases from "@/data/databases.json";
import { formatModalDuration, formatModalResource, parseModalJobResource } from "@/lib/modal-jobs";
import { setGeoLocaleSetting } from "./i18n";
import {
  formatWorkModalDuration, formatWorkModalResource, formatWorkModalTimestamp,
  workDatabaseCategory, workDatabaseDescription, workJobOwner, workLabel, workResourceName,
} from "./work-labels";

afterEach(() => localStorage.clear());

describe("work UI display adapters", () => {
  it("follows saved language while preserving unknown values and owner names", () => {
    setGeoLocaleSetting("ko");
    expect(workLabel("status", "running")).toBe("실행 중");
    expect(workLabel("outcome", "technical-failure")).toBe("기술적 실패");
    expect(workJobOwner(null, "lead")).toBe("주 agent");
    expect(workJobOwner("subagent run-42", null)).toBe("하위 agent run-42");
    expect(workJobOwner("researcher", "subagent")).toBe("researcher");
    expect(workJobOwner("subagent", "subagent", { agent: "subagent" })).toBe("subagent");
    expect(workLabel("status", "user-defined-status")).toBe("user-defined-status");
    expect(workResourceName("NVIDIA A100 80GB")).toBe("NVIDIA A100 80GB");
    setGeoLocaleSetting("en");
    expect(workLabel("status", "running")).toBe("running");
    expect(workJobOwner(null, "lead")).toBe("lead");
  });

  it("keeps upstream English timing/resource output for real and missing values", () => {
    setGeoLocaleSetting("en");
    const start = "2026-10-12T00:00:00Z";
    for (const seconds of [0, 12, 60, 93, 3600, 3661]) {
      const end = new Date(Date.parse(start) + seconds * 1000).toISOString();
      expect(formatWorkModalDuration(start, end)).toBe(formatModalDuration(start, end));
    }
    for (const [start, end] of [[null, null], ["invalid", null], ["2026-10-12T00:00:00Z", "invalid"]]) {
      expect(formatWorkModalDuration(start, end)).toBe(formatModalDuration(start, end));
    }
    for (const value of [null, { cpu: 4, label: "Custom CPU", id: "custom" }, { gpu: "H100", gpuCount: 4 }, { label: "CPU · 2 cores", id: "cpu-2", cpu: 2 }]) {
      const resource = parseModalJobResource(value);
      expect(formatWorkModalResource(resource)).toBe(formatModalResource(resource));
    }
    setGeoLocaleSetting("ko");
    expect(formatWorkModalDuration(start, "2026-10-12T01:01:01Z")).toBe("1시간 1분 1초");
    expect(workResourceName("CPU · 2 cores")).toBe("CPU · 2 코어");
    expect(formatWorkModalTimestamp(start)).toBe(new Intl.DateTimeFormat("ko", { dateStyle: "medium", timeStyle: "short" }).format(Date.parse(start)));
    expect(formatWorkModalTimestamp("invalid")).toBe("—");
  });

  it("translates every database entry only for display, retaining the agent payload", () => {
    const before = JSON.stringify(databases);
    setGeoLocaleSetting("ko");
    for (const db of databases) {
      expect(workDatabaseDescription(db)).toMatch(/[가-힣]/);
      expect(workDatabaseCategory(db.category)).toMatch(/[가-힣]/);
    }
    setGeoLocaleSetting("en");
    for (const db of databases) {
      expect(workDatabaseDescription(db)).toBe(db.id === "plaid"
        ? "Bank account connectivity, transaction data, and financial analytics" : db.description);
      expect(workDatabaseCategory(db.category)).toBe(db.category);
    }
    expect(JSON.stringify(databases)).toBe(before);
    const custom = { id: "custom-db", description: "User metadata" };
    setGeoLocaleSetting("ko");
    expect(workDatabaseDescription(custom)).toBe(custom.description);
  });
});
