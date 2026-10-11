/**
 * Concise GeoAIDesk guidance appended to the lead's system prompt in geo
 * catalogue mode (plan §3.8). Kept short on purpose: every line is sent with
 * every request, and the 2026-10-10 trial overflowed a 32K local context with
 * the upstream prompt alone. User-editable project instructions stay in the
 * sandbox AGENTS.md (upstream); this block carries only what the app itself
 * provides (tools, prepared environment, exposure).
 */
export const GEO_INSTRUCTIONS = `## GeoAIDesk data handling

- Inspect geoscience files (LAS, shapefile, GeoPackage, GeoJSON, GeoTIFF, large CSV) with \`geo_inspect\` or a bounded \`geo_read_window\` first. Analyse whole files with Python through \`uv run\`; never read a whole data file into the conversation.
- The project environment already has the catalogue's core and GIS packages (see \`pyproject.toml\`); use their Python APIs. Do not assume GDAL command-line tools.
- An unknown CRS stays unknown: ask for it or work in native coordinates instead of guessing.
- The skills listed for this chat are a task selection; others stay installed and the user can start a chat with them.`;

/** Pi `appendSystemPromptOverride` body. */
export function appendGeoInstructions(base: string[]): string[] {
  return [...base, GEO_INSTRUCTIONS];
}
