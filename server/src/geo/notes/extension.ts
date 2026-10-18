import path from "node:path";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import type { ProjectPaths } from "../../projects.ts";
import { RESEARCH_NOTES_DIR, RESEARCH_NOTE_FILE, RESEARCH_NOTE_ID } from "../../../../web/src/geo/contracts/research-notes.ts";
import { getResearchNote, recordResearchNoteSession, safeNoteId } from "./store.ts";

/** Lead-only hook; never mutates an error result or creates a note itself. */
export function makeResearchNoteExtension(paths: ProjectPaths, sessionId: string): ExtensionFactory {
  return pi => {
    pi.on("tool_result", event => {
      if ((event.toolName !== "write" && event.toolName !== "edit") || event.isError) return;
      const target = (event.input as { path?: unknown } | null)?.path;
      if (typeof target !== "string") return;
      try {
        const relative = path.relative(path.resolve(paths.sandbox), path.resolve(paths.sandbox, target.replace(/^@/, "")))
          .split(path.sep).join("/").normalize("NFC");
        const [dir, id, file, extra] = relative.split("/");
        if (dir !== RESEARCH_NOTES_DIR || !id || !safeNoteId(id) || file !== RESEARCH_NOTE_FILE || extra !== undefined) return;
        recordResearchNoteSession(paths, id, sessionId);
        const { note } = getResearchNote(paths, id);
        const problems = note.problems.filter(p => p.code !== "image-missing").map(p => `${p.code}${p.target ? ` (${p.target})` : ""}`);
        if (!RESEARCH_NOTE_ID.test(id)) problems.push("folder name: use YYYY-MM-DD-<topic> (letters, digits, - or _)");
        if (!problems.length) return;
        return { content: [...event.content, { type: "text" as const, text: `Research note format check: fix ${relative}: ${problems.join("; ")}.` }] };
      } catch {
        return; // A failed check must not replace the successful tool result.
      }
    });
  };
}
