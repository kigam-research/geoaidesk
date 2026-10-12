"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MapFeature, VectorPage } from "../../contracts/maps";
import { VECTOR_LIMIT } from "./model";
import { distinctValues, isActive, MISSING_KEY, nextSort, tableRows, valueKey, type ColumnFilter, type SortDirection, type TableFilters, type TableSort } from "./table";
import { mapText as t } from "./strings";

const button = "rounded border px-2 py-1 disabled:opacity-40";
export const textValue = (value: unknown) => value == null ? t("nodata") : typeof value === "object" ? JSON.stringify(value) : String(value);
interface Props {
  data: VectorPage; full: boolean; offset: number; loading?: boolean;
  selectedRow?: number; onSelect(row: number): void; onOffset(offset: number): void;
}
/**
 * Layer attribute table with per-column sort and filter in the header. A whole-layer table (`full`)
 * filters, sorts and pages every feature client-side; a viewport table applies them to the current
 * server page only. Row = feature index in `data`. Table state never changes the map or area analysis.
 */
export default function AttributeTable({ data, full, offset, loading, selectedRow, onSelect, onOffset }: Props) {
  const [sort, setSort] = useState<TableSort>();
  const [filters, setFilters] = useState<TableFilters>({});
  const [start, setStart] = useState(0);
  const [menu, setMenu] = useState<string>();
  const scroller = useRef<HTMLDivElement>(null);
  const features = data.features.features;
  const rows = useMemo(() => tableRows(features, sort, filters), [features, sort, filters]);
  const pageStart = full ? Math.min(start, Math.max(0, Math.floor((rows.length - 1) / VECTOR_LIMIT) * VECTOR_LIMIT)) : 0;
  const shown = full ? rows.slice(pageStart, pageStart + VECTOR_LIMIT) : rows;
  const filtered = Object.values(filters).some(isActive);
  const changeSort = (next?: TableSort) => { setSort(next); setStart(0); };
  const changeFilter = (field: string, filter?: ColumnFilter) => {
    setFilters(current => { const copy = { ...current }; if (filter && isActive(filter)) copy[field] = filter; else delete copy[field]; return copy; });
    setStart(0);
  };
  // A feature picked on the map brings its page (whole-layer tables) and row into view inside the table only.
  useEffect(() => {
    if (selectedRow === undefined) return;
    const position = rows.indexOf(selectedRow);
    if (full && position >= 0 && (position < pageStart || position >= pageStart + VECTOR_LIMIT)) setStart(Math.floor(position / VECTOR_LIMIT) * VECTOR_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow]);
  useEffect(() => {
    const box = scroller.current;
    const row = box?.querySelector<HTMLTableRowElement>('tr[aria-selected="true"]');
    if (!box || !row) return;
    const header = box.querySelector("thead")?.offsetHeight ?? 0;
    if (row.offsetTop < box.scrollTop + header || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, row.offsetTop - header - box.clientHeight / 3);
  }, [selectedRow, pageStart]);
  const title = t(full ? "attributesFull" : "attributes");
  return <section aria-label={title} className="space-y-2">
    <h3 className="font-semibold">{title}</h3>
    <p className="text-xs text-muted-foreground">{t(full ? "tableScopeFull" : "tableScopePage", { limit: VECTOR_LIMIT })}</p>
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span>{t("rowsSummary", { matched: rows.length, total: features.length })}</span>
      {full && rows.length > 0 && <span>{t("rowsRange", { from: pageStart + 1, to: pageStart + shown.length })}</span>}
      {!full && <span>{t("offset", { offset })}</span>}
      {(filtered || sort) && <button className={button} onClick={() => { setFilters({}); changeSort(undefined); }}>{t("clearFilters")}</button>}
    </div>
    <div ref={scroller} className="relative max-h-80 overflow-auto rounded border">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]"><tr>{data.fields.map(field => {
          const direction = sort?.field === field ? sort.direction : undefined;
          const SortIcon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
          return <th key={field} className="whitespace-nowrap border-r p-0 font-medium last:border-r-0" aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
            <div className="flex items-center">
              <button type="button" className="flex flex-1 items-center gap-1 px-1.5 py-1 text-left hover:bg-muted" title={t("sortCycle")} onClick={() => changeSort(nextSort(sort, field))}>
                <span>{field}</span><SortIcon aria-hidden className={`size-3 ${direction ? "" : "opacity-40"}`} />
              </button>
              <Popover open={menu === field} onOpenChange={open => setMenu(open ? field : undefined)}>
                <PopoverTrigger asChild><button type="button" aria-label={t("columnMenu", { field })} className={`px-1 py-1 hover:bg-muted ${isActive(filters[field]) ? "text-primary" : "text-muted-foreground"}`}><ListFilter aria-hidden className="size-3.5" /></button></PopoverTrigger>
                <PopoverContent align="start" collisionPadding={8} className="w-64 space-y-2 p-3 text-xs">
                  <ColumnMenu field={field} features={features} filter={filters[field]} direction={direction}
                    onSort={next => { changeSort(next ? { field, direction: next } : undefined); }} onFilter={f => changeFilter(field, f)} />
                </PopoverContent>
              </Popover>
            </div>
          </th>;
        })}</tr></thead>
        <tbody>{shown.map(row => <tr key={row} aria-selected={selectedRow === row} tabIndex={0} className="cursor-pointer border-t hover:bg-muted/50 aria-selected:bg-amber-200/40 dark:aria-selected:bg-amber-400/20"
          onClick={() => onSelect(row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row); } }}>
          {data.fields.map(field => { const value = textValue(features[row].properties[field]); return <td className="max-w-[16rem] truncate border-r px-1.5 py-1 last:border-r-0" title={value} key={field}>{value}</td>; })}
        </tr>)}</tbody>
      </table>
      {!features.length ? <p className="p-2">{t("empty")}</p> : !rows.length ? <p className="p-2">{t("noMatch")}</p> : null}
    </div>
    <div className="flex gap-2">{full
      ? <><button className={button} disabled={pageStart === 0} onClick={() => setStart(Math.max(0, pageStart - VECTOR_LIMIT))}>{t("previous")}</button><button className={button} disabled={pageStart + VECTOR_LIMIT >= rows.length} onClick={() => setStart(pageStart + VECTOR_LIMIT)}>{t("next")}</button></>
      : <><button className={button} disabled={offset === 0 || loading} onClick={() => onOffset(Math.max(0, offset - VECTOR_LIMIT))}>{t("previous")}</button><button className={button} disabled={data.nextOffset === null || loading} onClick={() => onOffset(data.nextOffset!)}>{t("next")}</button></>}
    </div>
  </section>;
}
function ColumnMenu({ field, features, filter, direction, onSort, onFilter }: { field: string; features: MapFeature[]; filter?: ColumnFilter; direction?: SortDirection; onSort(direction?: SortDirection): void; onFilter(filter?: ColumnFilter): void }) {
  const { values, more } = useMemo(() => distinctValues(features, field), [features, field]);
  const allKeys = useMemo(() => [...new Set(features.map(f => valueKey(f.properties[field])))], [features, field]);
  const checked = (key: string) => !filter?.values || filter.values.includes(key);
  const toggle = (key: string, on: boolean) => {
    const current = filter?.values ?? allKeys;
    const next = on ? [...new Set([...current, key])] : current.filter(k => k !== key);
    onFilter({ ...filter, values: next.length === allKeys.length ? undefined : next });
  };
  return <>
    <p className="font-semibold">{field}</p>
    <div className="flex flex-wrap gap-1">
      <button className={button} aria-pressed={direction === "asc"} onClick={() => onSort("asc")}>{t("sortAsc")}</button>
      <button className={button} aria-pressed={direction === "desc"} onClick={() => onSort("desc")}>{t("sortDesc")}</button>
      {direction && <button className={button} onClick={() => onSort(undefined)}>{t("sortClear")}</button>}
    </div>
    <label className="flex flex-col gap-1">{t("filterText")}<input className="rounded border bg-background p-1" value={filter?.text ?? ""} onChange={e => onFilter({ ...filter, text: e.target.value })} /></label>
    <fieldset className="space-y-1"><legend className="mb-1">{t("filterValues")}</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!filter?.values} onChange={e => onFilter({ ...filter, values: e.target.checked ? undefined : [] })} />{t("selectAll")}</label>
      <ul className="max-h-48 space-y-0.5 overflow-auto">{values.map(v => <li key={v.key}><label className="flex items-center gap-2"><input type="checkbox" checked={checked(v.key)} onChange={e => toggle(v.key, e.target.checked)} />
        <span className="min-w-0 flex-1 truncate" title={textValue(v.value)}>{v.key === MISSING_KEY ? t("nodata") : textValue(v.value)}</span><span className="text-muted-foreground">{v.count}</span></label></li>)}</ul>
      {more && <p className="text-muted-foreground">{t("moreValues", { limit: values.length })}</p>}
    </fieldset>
    <button className={button} disabled={!isActive(filter)} onClick={() => onFilter(undefined)}>{t("clearFilter")}</button>
  </>;
}
