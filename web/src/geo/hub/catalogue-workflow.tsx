"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowDoc } from "@/geo/contracts/workflow-doc";
import { geoText } from "@/geo/i18n";
import { WorkflowView } from "@/geo/workflow/workflow-view";
import { sharedHub } from "./shared-api";
import { localText } from "./text";
const text = geoText("workflowView");

/** A built-in recommendation opens the same final Workflow form as its project detail. */
export function CatalogueWorkflowScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const [doc, setDoc] = useState<WorkflowDoc | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    void sharedHub.catalogue(id).then((r) => { if (alive) setDoc(r.doc); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [id]);
  return <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-6xl space-y-4 px-6 py-4">
    <Button variant="ghost" size="sm" onClick={onBack}>{text("back.button")}</Button>
    {doc ? <><h1 className="text-xl font-semibold">{localText(doc.title)}</h1>{doc.purpose && <p className="max-w-[640px] text-sm text-muted-foreground">{localText(doc.purpose)}</p>}<WorkflowView doc={doc} /></> : <p role={failed ? "alert" : "status"} className="text-sm">{text(failed ? "error" : "loading")}</p>}
  </div></main>;
}
