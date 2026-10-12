import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GEO_INSTRUCTIONS, REPLY_LANGUAGE_RULE } from "../src/geo/instructions.ts";

// gaid-ui-locale: the agent's reply language follows the user's instructions or the
// request, independent of the UI language setting (web `gaid:locale`).
const SRC = path.resolve(__dirname, "../src");

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".venv" ? [] : sources(full);
    return /\.(ts|mts|md)$/.test(entry.name) ? [full] : [];
  });
}

describe("reply language", () => {
  it("the geo system prompt names the request/instruction rule", () => {
    expect(GEO_INSTRUCTIONS).toContain(REPLY_LANGUAGE_RULE);
    expect(REPLY_LANGUAGE_RULE).toMatch(/language the user asked for/);
    expect(REPLY_LANGUAGE_RULE).toMatch(/language of the user's latest request/);
  });

  it("no server prompt fixes a reply language or reads the UI locale", () => {
    const fixed = /\b(reply|respond|answer|write)\s+(only\s+)?in\s+(korean|english)\b|한국어로\s*(답|응답|작성)|gaid:locale/i;
    const offenders = sources(SRC).filter((file) => fixed.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
