"use client";

/**
 * Tabs of the "내 연구" place: 프로젝트 (the upstream project list) and 서재 (the personal library). The library tab is
 * kept in the URL hash (`#library`), like the hub (`#hub`), so reload and browser back keep the view.
 */
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/geo/i18n";

export type ResearchTab = "projects" | "library";
const readTab = (): ResearchTab => (typeof window !== "undefined" && window.location.hash === "#library" ? "library" : "projects");

export function useResearchTab(): [ResearchTab, (tab: ResearchTab) => void] {
  const [tab, setTab] = useState<ResearchTab>("projects");
  useEffect(() => {
    const read = () => setTab(readTab());
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => { window.removeEventListener("hashchange", read); window.removeEventListener("popstate", read); };
  }, []);
  const change = useCallback((next: ResearchTab) => {
    const hash = next === "library" ? "#library" : "";
    if (window.location.hash !== hash) window.history.pushState(null, "", hash || window.location.pathname + window.location.search);
    setTab(next);
  }, []);
  return [tab, change];
}

export function ResearchTabs({ value, onChange }: { value: ResearchTab; onChange: (tab: ResearchTab) => void }) {
  const tabs: ResearchTab[] = ["projects", "library"];
  return (
    <div role="tablist" aria-label={t("library.tabs.label")} className="mx-auto flex w-full max-w-[1440px] gap-1 border-b px-4 sm:px-8">
      {tabs.map((id) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)}
          className={cn("-mb-px border-b-2 px-3.5 py-2 text-sm", value === id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t(`library.tabs.${id}`)}
        </button>
      ))}
    </div>
  );
}
