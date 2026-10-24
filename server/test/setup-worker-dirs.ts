// Test files run in parallel workers (vitest.config.ts). Files reset and repopulate the shared projects root,
// Pi agent dir and skills cache in beforeEach/afterAll, so each worker gets its own copy of those directories:
// files within one worker still run one after another, and no two workers touch the same directory.
// Runs before every test file's imports, so module-level constants in src/config.ts see the worker's paths.
// The configured base is kept on first use, so a file that changed one of these variables does not leak into
// the next file of the same worker.
const worker = process.env.VITEST_POOL_ID ?? "1";
for (const name of ["KADY_PROJECTS_ROOT", "PI_CODING_AGENT_DIR", "KADY_SKILLS_CACHE_DIR"]) {
  const baseKey = `GAID_VITEST_BASE_${name}`;
  if (process.env[baseKey] === undefined && process.env[name]) process.env[baseKey] = process.env[name];
  const base = process.env[baseKey];
  if (base) process.env[name] = `${base}-w${worker}`;
}
