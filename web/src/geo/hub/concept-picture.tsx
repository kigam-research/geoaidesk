"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** The picture's URL for the current theme: a themed picture's dark-mode file is served with `theme=dark`. */
export function themedSrc(src: string, themed: boolean | undefined, dark: boolean): string {
  return themed && dark ? `${src}${src.includes("?") ? "&" : "?"}theme=dark` : src;
}

/**
 * A concept picture in its frame. Themed pictures were generated on the well colour (light) and edited for dark mode,
 * so the frame takes that colour and the picture reads as part of the card. Older white pictures sit on a white mat.
 * Pixels are never filtered or recoloured.
 */
export function ConceptPicture({
  src,
  themed,
  fit = "contain",
  className,
  imageClassName,
}: {
  src: string;
  themed?: boolean;
  fit?: "contain" | "cover";
  className?: string;
  imageClassName?: string;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <span
      data-themed={themed ? "true" : "false"}
      className={cn(
        "block overflow-hidden rounded-lg border",
        themed ? "bg-[var(--gaid-pic-well)]" : "bg-[var(--gaid-pic-mat)]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={themedSrc(src, themed, resolvedTheme === "dark")}
        alt=""
        className={cn("block w-full", fit === "cover" ? "object-cover" : "object-contain", imageClassName)}
      />
    </span>
  );
}
