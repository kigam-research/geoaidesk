import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The header of a GAID 허브 or 내 연구 page (UI guide v2 L4, N4, T1 page title, W6): the page title top-leading on the
 * content face, one line of context under it, and at most three actions (B4) or a status readout at the trailing end.
 * Every hub page uses it, so moving between pages keeps the title in the same place and size.
 */
export function PageHeader({ title, context, actions, titleId, className }: {
  title: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="flex min-w-0 max-w-[680px] flex-col gap-1.5">
        <h1 id={titleId} className="text-2xl font-bold">{title}</h1>
        {context && <p className="text-sm text-gaid-ink-2">{context}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </header>
  );
}

/** The scrolling content column of a hub page: same width, insets and rhythm as the hub home (L5, L6). */
export function PageBody({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto text-gaid-ink" aria-labelledby={labelledBy}>
      <div className={cn("mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-8 pb-12 pt-7", className)}>{children}</div>
    </main>
  );
}
