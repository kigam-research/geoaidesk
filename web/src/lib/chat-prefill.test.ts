import { afterEach, expect, it, vi } from "vitest";
import { onChatPrefill, prefillChat } from "./chat-prefill";

const offs: (() => void)[] = [];
afterEach(() => { offs.splice(0).forEach((off) => off()); });

it("reports what a chat tab did with the text and passes the send target", () => {
  const view = vi.fn();
  offs.push(onChatPrefill(view));
  expect(prefillChat("plain")).toBeNull();
  expect(view).toHaveBeenCalledWith("plain", { send: false, sessionId: undefined });
  const tab = vi.fn((_text: string, options: { sessionId?: string }) => (options.sessionId === undefined || options.sessionId === "s1" ? "sent" as const : false));
  offs.push(onChatPrefill(tab));
  expect(prefillChat("answers", { send: true, sessionId: "s1" })).toBe("sent");
  expect(tab).toHaveBeenLastCalledWith("answers", { send: true, sessionId: "s1" });
  expect(prefillChat("answers", { send: true, sessionId: "s2" })).toBeNull();
});
