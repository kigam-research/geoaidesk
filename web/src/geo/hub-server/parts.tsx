"use client";
import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { geoText, geoLocale } from "@/geo/i18n";
import { HubServerError } from "./api";
export const text = geoText("hubServer");
export const fieldClass = "h-9 rounded-md border border-gaid-control-edge bg-gaid-face px-3 text-[15px] text-gaid-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-gaid-ink-2">{text(label)}<Input {...props} className={fieldClass} /></label>;
}
export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? text("unknownDate") : new Intl.DateTimeFormat(geoLocale() === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
export function ErrorNotice({ error, fallback = "failed" }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  const detail = error instanceof Error ? error.message : String(error);
  return <div className="flex flex-col gap-2 text-[13px]" role="alert">
    <p className="text-gaid-danger">{text(error instanceof HubServerError && error.status === 429 ? "rateLimited" : fallback)}</p>
    <details className="text-gaid-ink-2"><summary className="cursor-pointer">{text("technical")}</summary>
      <p className="my-2 break-words whitespace-pre-wrap">{detail}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(detail).catch(() => undefined)}>{text("copyTechnical.button")}</Button>
    </details>
  </div>;
}
