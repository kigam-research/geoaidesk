import { cn } from "@/lib/utils";

/**
 * The one segmented control look (UI guide v2 N3, I14): a chrome-tone track whose selected segment is a raised face in
 * 계측 and an inverted ink segment in 도폭 (`.gaid-seg` in globals.css). Selection is never drawn in the signal blue,
 * so the same control reads the same on every screen.
 */
export const SEG_TRACK = "gaid-seg flex w-fit flex-wrap items-center gap-0.5 rounded-lg border border-gaid-edge bg-gaid-hover p-0.5";

export function segItem(selected: boolean, className?: string): string {
  return cn(
    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium",
    selected ? "bg-gaid-face text-gaid-ink shadow-[0_0_0_1px_var(--gaid-edge)] hover:bg-gaid-face" : "text-gaid-ink-2 hover:text-gaid-ink",
    className,
  );
}
