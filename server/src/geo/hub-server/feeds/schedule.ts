import { FEED_LIMITS } from "../../../../../web/src/geo/contracts/hub-feeds.ts";
import { HubServerError } from "../core.ts";
import type { HubFeeds } from "./store.ts";
export function intervalHours(value: unknown = process.env.GAID_HUB_FEEDS_INTERVAL_HOURS ?? FEED_LIMITS.intervalHours): number {
  const hours = Number(value);
  if ((typeof value !== "string" && typeof value !== "number") || (typeof value === "string" && !value.trim()) || !Number.isFinite(hours) || hours < 0 || hours > 24 * 365)
    throw new HubServerError("소식 수집 간격은 0~8760시간 사이여야 합니다.");
  return hours;
}
/** Re-arm after a batch, so a slow batch never overlaps another scheduled batch. */
export function scheduleFeeds(feeds: HubFeeds, hours: number, initialMs = 30_000): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const arm = (ms: number) => {
    const deadline = Date.now() + ms;
    const wait = () => {
      const remaining = deadline - Date.now();
      if (remaining > 0) { timer = setTimeout(wait, Math.min(remaining, 2_147_483_647)); timer.unref(); }
      else void run();
    };
    wait();
  };
  const run = async () => {
    try { await feeds.fetch(); } catch { /* Per-source errors are recorded by HubFeeds; closing is harmless. */ }
    if (!stopped) arm(hours * 3600_000);
  };
  if (hours > 0) arm(initialMs);
  return () => { stopped = true; clearTimeout(timer); };
}
