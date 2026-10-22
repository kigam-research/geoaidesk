"use client";
import { Children, isValidElement, type ComponentProps, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Shared controls with the map toolbar's 28 px sizing. No style-specific branches. */
export function MapButton({ className = "", ...props }: ComponentProps<typeof Button>) {
  return <Button type="button" variant="outline" size="sm" className={`h-7 px-2 text-xs ${className}`} {...props} />;
}
const EMPTY = "__map_empty__";
export function MapSelect({ value, onChange, children, className = "", ...props }: Omit<ComponentProps<"select">, "onChange" | "size" | "multiple" | "defaultValue"> & { onChange(value: string): void }) {
  const options = Children.toArray(children).filter(isValidElement) as ReactElement<ComponentProps<"option">>[];
  return <Select value={String(value ?? "") || EMPTY} onValueChange={v => onChange(v === EMPTY ? "" : v)} disabled={props.disabled}>
    <SelectTrigger aria-label={props["aria-label"]} id={props.id} className={`h-7 min-w-0 max-w-full px-2 text-xs ${className}`}><SelectValue /></SelectTrigger>
    <SelectContent position="popper">{options.map((option, n) => {
      const key = String(option.props.value ?? option.props.children ?? "");
      return <SelectItem key={`${key}:${n}`} value={key || EMPTY} disabled={option.props.disabled} className="text-xs">{option.props.children}</SelectItem>;
    })}</SelectContent>
  </Select>;
}
export const mapInput = "h-7 rounded-md border border-input bg-gaid-face px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
