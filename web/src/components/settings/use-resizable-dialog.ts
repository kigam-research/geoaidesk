"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS_DIALOG_SIZE,
  SETTINGS_DIALOG_SIZE_KEY,
  clampDialogSize,
  fitsViewport,
  readStoredDialogSize,
  resizeFromCorner,
  writeStoredDialogSize,
  type DialogSize,
} from "@/lib/dialog-size";

/**
 * Persisted size for the Settings dialog plus a drag handle for its corner.
 * The dialog is centered by Radix, so the handle grows the box on both sides.
 */
export function useResizableDialog(open: boolean): {
  size: DialogSize | null;
  handleProps: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onDoubleClick: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  };
} {
  const [size, setSize] = useState<DialogSize | null>(null);
  // Latest committed size for event handlers: persisting from inside a state
  // updater runs at flush time and can overwrite a reset that happened later.
  const sizeRef = useRef<DialogSize | null>(null);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; start: DialogSize } | null>(null);
  const requested = useRef<DialogSize>(DEFAULT_SETTINGS_DIALOG_SIZE);
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    let stored: DialogSize | null = null;
    try {
      stored = readStoredDialogSize(window.localStorage, SETTINGS_DIALOG_SIZE_KEY);
    } catch {
      stored = null;
    }
    // Clamp the size the user asked for, not the last clamped one: a narrow window
    // must not shrink the dialog for good (gaid-qwen-authoring-trial). Below the
    // minimum width the dialog takes the CSS width of a small screen instead.
    requested.current = stored ?? DEFAULT_SETTINGS_DIALOG_SIZE;
    const fit = () => (fitsViewport(viewport()) ? clampDialogSize(requested.current, viewport()) : null);
    setSize(fit());
    const onResize = () => setSize(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const persist = (next: DialogSize) => {
    requested.current = next;
    try {
      writeStoredDialogSize(window.localStorage, SETTINGS_DIALOG_SIZE_KEY, next);
    } catch {
      /* not remembered */
    }
  };

  return {
    size,
    handleProps: {
      onPointerDown: (event) => {
        if (!size) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, start: size };
      },
      onPointerMove: (event) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId) return;
        setSize(resizeFromCorner(state.start, event.clientX - state.startX, event.clientY - state.startY, viewport()));
      },
      onPointerUp: (event) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (sizeRef.current) persist(sizeRef.current);
      },
      onDoubleClick: () => {
        drag.current = null;
        const next = clampDialogSize(DEFAULT_SETTINGS_DIALOG_SIZE, viewport());
        sizeRef.current = next;
        setSize(next);
        persist(next);
      },
      onKeyDown: (event) => {
        if (!size) return;
        const step = event.shiftKey ? 64 : 16;
        const delta: Record<string, [number, number]> = {
          ArrowRight: [step, 0],
          ArrowLeft: [-step, 0],
          ArrowDown: [0, step],
          ArrowUp: [0, -step],
        };
        const move = delta[event.key];
        if (!move) return;
        event.preventDefault();
        const next = clampDialogSize({ width: size.width + move[0], height: size.height + move[1] }, viewport());
        setSize(next);
        persist(next);
      },
    },
  };
}
