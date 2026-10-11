import { apiFetch } from "@/lib/projects";
import { mapText as t } from "./strings";

/** All requests use explicit project scope and are abortable on replacement/unmount. */
export async function mapPost<T>(endpoint: string, body: unknown, projectId: string | undefined, signal: AbortSignal): Promise<T> {
  const res = await apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }, projectId);
  const value = await res.json();
  if (!res.ok) throw new Error(value.detail ?? value.error ?? t("requestError"));
  return value as T;
}
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
