import { API_BASE } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";

/**
 * Only relative, sandbox-contained file references are rewritten. `baseDir` is the sandbox folder of the Markdown
 * file the reference sits in (GeoAIDesk gaid-first-use-fixes: a report's `../../figures/x.pdf`); `..` may climb to
 * the sandbox root but never past it.
 */
export function sandboxMarkdownPath(value: unknown, baseDir = ""): string | undefined {
  if (typeof value !== "string" || !value || /^[#/?]|^[a-z][a-z\d+.-]*:/i.test(value)) return;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  } catch {
    return;
  }
  if (!decoded || /[\\\x00-\x1f:]/.test(decoded) || decoded.startsWith("/")) return;
  const parts: string[] = [];
  for (const part of [...baseDir.split("/"), ...decoded.split("/")]) {
    if (part === "." || part === "") continue;
    if (part !== "..") parts.push(part);
    else if (!parts.pop()) return;
  }
  if (!parts.length) return;
  return parts.join("/");
}

interface MarkdownNode {
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: MarkdownNode[];
}

/**
 * Rehype plugin; run after HTML sanitization and before Streamdown blocks relative URLs. Pass it as
 * `[sandboxMarkdownUrls, { projectId, baseDir }]`: Streamdown caches processors by plugin name plus options, so a
 * closure would reuse the first project's or folder's processor.
 */
export function sandboxMarkdownUrls({ projectId, baseDir = "" }: { projectId: string; baseDir?: string }) {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      const key = node.tagName === "a" ? "href" : node.tagName === "img" ? "src" : null;
      if (key && node.properties) {
        // Only this pass may mark a link as an in-app file action.
        delete node.properties["data-kady-file"];
        delete node.properties.dataKadyFile;
        const original = node.properties[key];
        const path = sandboxMarkdownPath(original, baseDir);
        if (path) {
          node.properties[key] = withApiToken(
            `${API_BASE}/sandbox/raw?path=${encodeURIComponent(path)}&project=${encodeURIComponent(projectId)}`,
          );
          if (key === "href") node.properties["data-kady-file"] = path;
        } else if (typeof original === "string" && original && !/^[#/?]|^[a-z][a-z\d+.-]*:/i.test(original)) {
          // Do not let malformed/traversing relative paths become app URLs.
          delete node.properties[key];
        }
        // A link left without a target (refused above, dropped by sanitization, or still being streamed: Streamdown's
        // `streamdown:incomplete-link` placeholder is not an allowed protocol) reads as its text, not "[blocked]".
        if (key === "href" && typeof node.properties.href !== "string") {
          node.tagName = "span";
          node.properties = {};
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
