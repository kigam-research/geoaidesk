"use client";

/**
 * 참고문헌 under a research note: the note's Pandoc citations (`[@key, p. 12]`) resolved against the researcher's
 * library. A key the library does not have is shown as 확인 안 됨, never dropped (ADR decision 6).
 */
import { useEffect, useMemo, useState } from "react";
import { t } from "@/geo/i18n";
import { parseCitations, type CitationResolution } from "@/geo/contracts/library";
import { resolveCitations } from "./api";

export function NoteReferences({ content }: { content: string }) {
  const keys = useMemo(() => [...new Set(parseCitations(content).map((c) => c.key))], [content]);
  const [rows, setRows] = useState<CitationResolution[] | null>(null);
  useEffect(() => {
    let live = true;
    if (!keys.length) { setRows(null); return; }
    resolveCitations(keys).then((r) => live && setRows(r)).catch(() => live && setRows(keys.map((key) => ({ key }))));
    return () => { live = false; };
  }, [keys]);
  if (!keys.length || !rows) return null;
  return (
    <section className="mt-8 border-t pt-4" aria-label={t("library.references.title")}>
      <h2 className="mb-2 text-base font-semibold">{t("library.references.title")}</h2>
      <ol className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.key} className="flex gap-2">
            <span className="shrink-0 font-mono text-xs text-muted-foreground">@{r.key}</span>
            {r.reference ? <span>{r.reference}</span> : <span className="text-amber-700 dark:text-amber-300">{t("library.references.unknown")}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
