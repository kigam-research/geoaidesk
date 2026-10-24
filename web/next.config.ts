import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { readFileSync } from "fs";
import { resolve } from "path";

/** GeoAIDesk distribution manifest; absent in an upstream checkout. */
function readDistribution(): { version?: string; repository?: string } | null {
  try {
    return JSON.parse(readFileSync(resolve(__dirname, "..", "geo", "distribution.json"), "utf-8"));
  } catch {
    return null;
  }
}

const distribution = readDistribution();

function readAppVersion(): string {
  // A distribution versions itself (GeoAIDesk geo-v<version> releases); the
  // update check compares against its releases, not upstream's.
  if (distribution?.version) return distribution.version;
  // The server package is the source of truth for the app version (it's what
  // the README badge and release tags track). Reading it here keeps the
  // frontend's update check honest — a stale fallback makes every published
  // GitHub release look "newer" and shows a false "update available" banner.
  try {
    const pkg = readFileSync(resolve(__dirname, "..", "server", "package.json"), "utf-8");
    const version = (JSON.parse(pkg) as { version?: string }).version;
    if (version) return version;
  } catch {
    // fall through to default
  }
  return "0.0.0";
}

const config = (phase: string): NextConfig => ({
  // GAID development pages (`page.dev.tsx`, e.g. the parts page /dev/parts) exist only in `next dev` or in a build made
  // with GAID_DEV_PAGES=1; a production build has no such routes.
  pageExtensions: phase === PHASE_DEVELOPMENT_SERVER || process.env.GAID_DEV_PAGES === "1"
    ? ["dev.tsx", "tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js"],
  devIndicators: false,
  async headers() {
    return [{ source: "/office/:path*", headers: [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
    ] }];
  },
  // Next 16.3 otherwise writes AGENTS.md/CLAUDE.md into web/ on every dev start.
  agentRules: false,
  // The repo-root package.json (npm-start wrapper, no lockfile) makes Turbopack
  // infer the monorepo root as its workspace root, which breaks module
  // resolution (e.g. tailwindcss) against web/node_modules.
  turbopack: {
    root: __dirname,
  },
  env: {
    NEXT_PUBLIC_GAID_REMOTE_COMPUTE: process.env.NEXT_PUBLIC_GAID_REMOTE_COMPUTE ?? "true",
    NEXT_PUBLIC_APP_VERSION: readAppVersion(),
    NEXT_PUBLIC_RELEASES_URL: `https://github.com/${distribution?.repository ?? "K-Dense-AI/k-dense-byok"}${
      distribution?.repository ? "/releases" : ""
    }`,
  },
});

export default config;
