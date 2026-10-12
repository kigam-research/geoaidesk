"use client";
import { geoText } from "@/geo/i18n";

import { useEffect, useRef, useState } from "react";

import { type Author, colorForAuthor } from "@/lib/pdf-annotations";
import { cn } from "@/lib/utils";

const filesText = geoText("files");

export interface NotePopoverProps {
  screen: { x: number; y: number };
  initialBody: string;
  author: Author;
  showDelete?: boolean;
  isExpert?: boolean;
  onCancel: () => void;
  onSave: (body: string) => void;
  onDelete?: (force: boolean) => void;
}

export function NotePopover({
  screen,
  initialBody,
  author,
  showDelete,
  isExpert,
  onCancel,
  onSave,
  onDelete,
}: NotePopoverProps) {
  const [body, setBody] = useState(initialBody);
  const ref = useRef<HTMLDivElement>(null);
  const [altHeld, setAltHeld] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.altKey) setAltHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setAltHeld(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousedown", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [onCancel]);

  // Position the popover near the click; clamp to viewport.
  const top = Math.min(
    Math.max(screen.y + 8, 8),
    (typeof window !== "undefined" ? window.innerHeight : 800) - 220,
  );
  const left = Math.min(
    Math.max(screen.x + 8, 8),
    (typeof window !== "undefined" ? window.innerWidth : 1200) - 320,
  );

  const readOnly = Boolean(isExpert);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed z-50 w-[300px] rounded-md border bg-popover p-3 text-popover-foreground shadow-lg"
      style={{ top, left }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span
          className="inline-block size-2.5 rounded-full"
          style={{ backgroundColor: colorForAuthor(author) }}
        />
        <span className="font-medium">{author.kind === "user" && author.id === "local" && author.label === "You" ? filesText("note_popover.you") : author.label}</span>
        <span className="text-muted-foreground">
          {author.kind === "expert" ? filesText("note_popover.expert") : filesText("note_popover.you")}
        </span>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        readOnly={readOnly}
        placeholder={readOnly ? "" : filesText("note_popover.add_a_note")}
        className={cn(
          "h-24 w-full resize-none rounded border bg-background p-2 text-sm",
          readOnly && "cursor-default text-muted-foreground",
        )}
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {showDelete && onDelete && (
            <button
              type="button"
              disabled={isExpert && !altHeld}
              onClick={() => onDelete(altHeld || !isExpert)}
              title={
                isExpert
                  ? filesText("note_popover.hold_alt_and_click_to_delete_an_expert_annotation")
                  : filesText("note_popover.delete_annotation")
              }
              className={cn(
                "rounded px-2 py-1 text-xs",
                isExpert && !altHeld
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "text-destructive hover:bg-destructive/10",
              )}
            >
               {filesText("note_popover.delete")} </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-xs hover:bg-muted"
          >
             {filesText("note_popover.cancel")} </button>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onSave(body)}
              className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
            >
               {filesText("note_popover.save")} </button>
          )}
        </div>
      </div>
    </div>
  );
}
