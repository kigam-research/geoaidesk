/**
 * Caches that running or checking a skill's scripts regenerates (gaid-skill-cache-hash). They are not skill content:
 * skill tree hashes skip them, so a skill whose scripts were run still reads as unedited, and installs drop them.
 */
const REGENERABLE_CACHE_DIRS = new Set(["__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".ipynb_checkpoints"]);

export function isRegenerableCache(name: string): boolean {
  return REGENERABLE_CACHE_DIRS.has(name) || /\.py[co]$/.test(name);
}
