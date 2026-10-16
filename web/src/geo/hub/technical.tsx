"use client";
/** Raw error text only behind a collapsed "기술 정보" disclosure with a copy button (UI guide R2, F4). */
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { geoText } from "@/geo/i18n";

const text = geoText("hub");

export function TechnicalDetail({ detail }: { detail: string | null | undefined }) {
  if (!detail) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">{text("technical.label")}</summary>
      <div className="mt-2 flex items-start gap-2 rounded-md bg-muted p-2">
        <pre className="min-w-0 flex-1 font-mono text-xs break-all whitespace-pre-wrap">{detail}</pre>
        <button
          type="button"
          aria-label={text("technical.copy")}
          title={text("technical.copy")}
          className="shrink-0 rounded p-1 hover:bg-background"
          onClick={() => {
            void navigator.clipboard.writeText(detail).then(() => toast.success(text("technical.copied")));
          }}
        >
          <CopyIcon className="size-4" aria-hidden />
        </button>
      </div>
    </details>
  );
}
