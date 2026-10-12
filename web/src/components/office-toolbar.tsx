"use client";
import { geoText } from "@/geo/i18n";
import { useState } from "react";
import {
  BoldIcon, ItalicIcon, UnderlineIcon, Undo2Icon, Redo2Icon, AlignLeftIcon, AlignCenterIcon,
  AlignRightIcon, AlignJustifyIcon, ListIcon, ListOrderedIcon, LinkIcon, Table2Icon,
  PlusIcon, CopyIcon, TypeIcon, SquareIcon, Rows3Icon, Columns3Icon, ChartColumnIcon,
  SearchIcon, ScissorsIcon, PaintbrushIcon, PilcrowIcon, LayoutTemplateIcon, FilePlus2Icon,
  ZoomInIcon, ZoomOutIcon, PanelRightIcon, SpellCheckIcon, MessageSquarePlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const filesText = geoText("files");

export type OfficeCommandState = Record<string, { enabled: boolean; value?: string | number | boolean }>;
export type OfficeCommand = (command: string, args?: Record<string, string | number | boolean>) => void;
export function OfficeToolbar({ kind, enabled, state, onCommand }: {
  kind: string; enabled: boolean; state: OfficeCommandState; onCommand: OfficeCommand;
}) {
  const [tab, setTab] = useState("Home");
  const sheet = kind === "xlsx", slides = kind === "pptx";
  const selectClass = "h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  function tool(label: string, command: string, Icon: typeof BoldIcon, text = false, args?: Record<string, string | number | boolean>) {
    const active = state[command]?.value === true;
    return <Button key={label} type="button" variant="ghost" size={text ? "sm" : "icon-sm"} title={label} aria-label={label}
      aria-pressed={typeof state[command]?.value === "boolean" ? active : undefined}
      disabled={!enabled || state[command]?.enabled === false}
      className={cn("shrink-0 text-muted-foreground", active && "bg-accent text-foreground", text && "text-xs")}
      onMouseDown={e => e.preventDefault()} onClick={() => onCommand(command, args)}><Icon className="size-4" />{text && label}</Button>;
  }
  const divider = <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;
  return <div className="shrink-0 border-b bg-background" aria-label={filesText("office_toolbar.office_tools")}>
    <div className="flex h-9 items-end gap-5 px-5" role="tablist" aria-label={filesText("office_toolbar.office_ribbon")}>
      {["Home", "Insert", "Layout", "Review"].map(name => <button key={name} role="tab" aria-selected={tab === name} aria-controls="office-tool-panel"
        className={cn("h-9 border-b-2 px-1 text-xs transition-colors", tab === name ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
        onClick={() => setTab(name)}>{filesText("office_toolbar.tab_label", { tab: name })}</button>)}
    </div>
    <div id="office-tool-panel" role="tabpanel" aria-label={filesText("office_toolbar.tab_tools", { tab: filesText("office_toolbar.tab_label", { tab }) })} className="flex min-h-14 items-center gap-1 overflow-x-auto px-4 py-2">
      {tab === "Home" && <>
        {tool(filesText("office_toolbar.undo"), ".uno:Undo", Undo2Icon)}{tool(filesText("office_toolbar.redo"), ".uno:Redo", Redo2Icon)}{divider}
        <select aria-label={filesText("office_toolbar.font_family")} className={cn(selectClass, "w-36")} disabled={!enabled || state[".uno:CharFontName"]?.enabled === false}
          value={String(state[".uno:CharFontName"]?.value || "")} onChange={e => onCommand(".uno:CharFontName", { "CharFontName.FamilyName": e.target.value })}>
          <option value="">{filesText("office_toolbar.font")}</option>
          {[...new Set([String(state[".uno:CharFontName"]?.value || ""), "Arial", "Calibri", "Cambria", "Carlito", "Georgia", "Liberation Sans", "Liberation Serif", "Times New Roman", "Verdana"])].filter(Boolean).map(font => <option key={font}>{font}</option>)}
        </select>
        <select aria-label={filesText("office_toolbar.font_size")} className={cn(selectClass, "w-16")} disabled={!enabled || state[".uno:FontHeight"]?.enabled === false}
          value={String(state[".uno:FontHeight"]?.value || "")} onChange={e => onCommand(".uno:FontHeight", { "FontHeight.Height": Number(e.target.value) })}>
          <option value="">{filesText("office_toolbar.size")}</option>{[...new Set([Number(state[".uno:FontHeight"]?.value || 0), 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72])].filter(Boolean).sort((a, b) => a - b).map(size => <option key={size}>{size}</option>)}
        </select>{divider}
        {tool(filesText("office_toolbar.bold"), ".uno:Bold", BoldIcon)}{tool(filesText("office_toolbar.italic"), ".uno:Italic", ItalicIcon)}{tool(filesText("office_toolbar.underline"), ".uno:Underline", UnderlineIcon)}
        <label title={filesText("office_toolbar.text_color")} className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-accent", !enabled && "opacity-40")}>
          <TypeIcon className="size-4 text-muted-foreground" /><input type="color" aria-label={filesText("office_toolbar.text_color")} disabled={!enabled} className="absolute inset-0 cursor-pointer opacity-0"
            onChange={e => onCommand(".uno:Color", { Color: parseInt(e.target.value.slice(1), 16) })} />
        </label>{divider}
        {tool(filesText("office_toolbar.align_left"), sheet ? ".uno:AlignLeft" : ".uno:LeftPara", AlignLeftIcon)}{tool(filesText("office_toolbar.align_center"), sheet ? ".uno:AlignHorizontalCenter" : ".uno:CenterPara", AlignCenterIcon)}{tool(filesText("office_toolbar.align_right"), sheet ? ".uno:AlignRight" : ".uno:RightPara", AlignRightIcon)}
        {!sheet && tool(filesText("office_toolbar.justify"), ".uno:JustifyPara", AlignJustifyIcon)}{divider}
        {!sheet && <>{tool(filesText("office_toolbar.bulleted_list"), ".uno:DefaultBullet", ListIcon)}{tool(filesText("office_toolbar.numbered_list"), ".uno:DefaultNumbering", ListOrderedIcon)}{divider}</>}
        {tool(filesText("office_toolbar.find"), ".uno:SearchDialog", SearchIcon, true)}
      </>}
      {tab === "Insert" && <>
        {slides ? <>{tool(filesText("office_toolbar.new_slide"), ".uno:InsertPage", PlusIcon, true)}{tool(filesText("office_toolbar.duplicate_slide"), ".uno:DuplicatePage", CopyIcon, true)}{divider}{tool(filesText("office_toolbar.text_box"), ".uno:Text", TypeIcon, true)}{tool(filesText("office_toolbar.rectangle"), ".uno:Rect", SquareIcon, true)}</>
          : sheet ? <>{tool(filesText("office_toolbar.insert_rows"), ".uno:InsertRowsBefore", Rows3Icon, true)}{tool(filesText("office_toolbar.insert_columns"), ".uno:InsertColumnsBefore", Columns3Icon, true)}{tool(filesText("office_toolbar.new_sheet"), ".uno:Insert", FilePlus2Icon, true)}{divider}{tool(filesText("office_toolbar.chart"), ".uno:InsertObjectChart", ChartColumnIcon, true)}</>
          : <>{tool(filesText("office_toolbar.table"), ".uno:InsertTable", Table2Icon, true)}{tool(filesText("office_toolbar.page_break"), ".uno:InsertPagebreak", FilePlus2Icon, true)}{divider}</>}
        {tool(filesText("office_toolbar.link"), ".uno:HyperlinkDialog", LinkIcon, true)}{tool(filesText("office_toolbar.comment"), ".uno:InsertAnnotation", MessageSquarePlusIcon, true)}
      </>}
      {tab === "Layout" && <>
        {tool(sheet ? filesText("office_toolbar.format_cells") : slides ? filesText("office_toolbar.slide_properties") : filesText("office_toolbar.page_settings"), sheet ? ".uno:FormatCellDialog" : slides ? ".uno:PageSetup" : ".uno:PageDialog", LayoutTemplateIcon, true)}
        {!sheet && tool(filesText("office_toolbar.paragraph"), ".uno:ParagraphDialog", PilcrowIcon, true)}{tool(filesText("office_toolbar.character"), ".uno:FontDialog", TypeIcon, true)}{divider}
        {tool(filesText("office_toolbar.properties_panel"), ".uno:Sidebar", PanelRightIcon, true)}
      </>}
      {tab === "Review" && <>
        {tool(filesText("office_toolbar.spelling"), ".uno:SpellingAndGrammarDialog", SpellCheckIcon, true)}{tool(filesText("office_toolbar.find_replace"), ".uno:SearchDialog", SearchIcon, true)}{divider}
        {tool(filesText("office_toolbar.clear_formatting"), slides ? ".uno:SetDefault" : ".uno:ResetAttributes", PaintbrushIcon, true)}{tool(filesText("office_toolbar.cut_selection"), ".uno:Cut", ScissorsIcon, true)}
      </>}
    </div>
  </div>;
}

export function OfficeZoom({ enabled, onCommand }: { enabled: boolean; onCommand: OfficeCommand }) {
  return <div className="flex items-center gap-1">
    <Button size="icon-xs" variant="ghost" aria-label={filesText("office_toolbar.zoom_out")} title={filesText("office_toolbar.zoom_out")} disabled={!enabled} onClick={() => onCommand(".uno:ZoomMinus")}><ZoomOutIcon className="size-3.5" /></Button>
    <button aria-label={filesText("office_toolbar.reset_zoom_to_100")} title={filesText("office_toolbar.reset_zoom_to_100")} className="rounded px-1.5 py-1 text-[11px] hover:bg-accent disabled:opacity-40" disabled={!enabled} onClick={() => onCommand(".uno:Zoom", { "Zoom.Value": 100, "Zoom.Type": 0 })}>100%</button>
    <Button size="icon-xs" variant="ghost" aria-label={filesText("office_toolbar.zoom_in")} title={filesText("office_toolbar.zoom_in")} disabled={!enabled} onClick={() => onCommand(".uno:ZoomPlus")}><ZoomInIcon className="size-3.5" /></Button>
  </div>;
}
