import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";

/**
 * Notebook entries follow the reply language (gaid-first-use-fixes). The chat shows each `notebook` call's title as a
 * progress card; in the acceptance trial GPT-6.1 Sol sometimes wrote those titles in Japanese ("報告値から差と比率を
 * 計算します") for a Korean request although the instructions already ask for the request's language. Kana with no
 * Hangul while the latest request is Korean (and has no kana) is refused with a reason, so the model writes the entry
 * again; nothing is saved from the refused call. Lead only; other languages and mixed text pass.
 */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL = /\p{Script=Hangul}/u;

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((block: { type?: string; text?: unknown }) =>
    block?.type === "text" && typeof block.text === "string" ? [block.text] : []).join("\n");
}

/** Text of the latest user message on the session branch. */
export function latestRequestText(branch: ReadonlyArray<unknown>): string {
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index] as { type?: string; message?: { role?: string; content?: unknown } } | undefined;
    if (entry?.type === "message" && entry.message?.role === "user") return messageText(entry.message.content);
  }
  return "";
}

const japaneseOnly = (text: unknown): boolean => typeof text === "string" && KANA.test(text) && !HANGUL.test(text);

export function entryLanguageRefusal(input: Record<string, unknown>, request: string): string | undefined {
  if (!HANGUL.test(request) || KANA.test(request)) return undefined;
  if (!japaneseOnly(input.title) && !japaneseOnly(input.body)) return undefined;
  return "Notebook entry not saved: it is written in Japanese, but the user's request is in Korean. Write the title and body in Korean (합니다체 for sentences) and call notebook again.";
}

export const entryLanguageExtension: ExtensionFactory = (pi) => {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "notebook") return;
    try {
      const reason = entryLanguageRefusal(event.input as Record<string, unknown>, latestRequestText(ctx.sessionManager.getBranch()));
      return reason ? { block: true, reason } : undefined;
    } catch {
      return; // A failed check never blocks the entry.
    }
  });
};
