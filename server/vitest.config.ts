import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Multiple test files reset/repopulate the projects root, Pi agent dir and
    // skills cache in beforeEach/afterAll; running files concurrently on one
    // directory races (ENOTEMPTY, files vanishing mid-assertion). Files run in
    // parallel workers, and the setup file gives each worker its own copy of
    // those directories (suffix -w<VITEST_POOL_ID>). Workers: TASK_CHECK_JOBS
    // (free CPUs, set by the task CLI) or 8, never all CPUs; scripts/check
    // passes the same value as --maxWorkers.
    setupFiles: ["./test/setup-worker-dirs.ts"],
    maxWorkers: Number(process.env.TASK_CHECK_JOBS) || 8,
    // Each run gets an isolated projects root under the OS temp dir.
    env: {
      KADY_PROJECTS_ROOT:
        process.env.VITEST_PROJECTS_ROOT ??
        path.join(os.tmpdir(), `kady-vitest-projects-${process.pid}`),
      PI_CODING_AGENT_DIR:
        process.env.VITEST_PI_AGENT_DIR ??
        path.join(os.tmpdir(), `kady-vitest-pi-agent-${process.pid}`),
      KADY_SKILLS_CACHE_DIR:
        process.env.VITEST_SKILLS_CACHE_DIR ??
        path.join(os.tmpdir(), `kady-vitest-skills-cache-${process.pid}`),
      // GeoAIDesk: the pinned geo catalogue would replace the upstream
      // catalogue sources the upstream tests exercise; geo tests opt in
      // through explicit options (server/src/geo/catalogue.ts).
      GAID_CATALOGUE: process.env.VITEST_GAID_CATALOGUE ?? "off",
    },
  },
});
