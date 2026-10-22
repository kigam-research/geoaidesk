"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { MapFeature, VectorPage } from "../../contracts/maps";
import { VECTOR_LIMIT } from "./model";
import { distinctValues, isActive, MISSING_KEY, nextSort, tableRows, valueKey, type ColumnFilter, type SortDirection, type TableFilters, type TableSort } from "./table";
import { MapButton, mapInput } from "./controls";
import { mapText as t } from "./strings";

const button = "";
export const textValue = (value: unknown) => value == null ? t("nodata") : typeof value === "object" ? JSON.stringify(value) : String(value);
interface Props {
  data: VectorPage; full: boolean; offset: number; loading?: boolean;
  focusVersion?: number; selectedRow?: number; onSelect(row: number): void; onOffset(offset: number): void;
}
/**
 * Layer attribute table with per-column sort and filter in the header. A whole-layer table (`full`)
 * filters, sorts and pages every feature client-side; a viewport table applies them to the current
 * server page only. Row = feature index in `data`. Table state never changes the map or area analysis.
 */
export default function AttributeTable({ data, full, offset, loading, selectedRow, onSelect, onOffset, focusVersion }: Props) {
  const [sort, setSort] = useState<TableSort>();
  const [filters, setFilters] = useState<TableFilters>({});
  const [start, setStart] = useState(0);
  const [visibleFields, setVisibleFields] = useState(data.fields.slice(0, 8));
  const fields = data.fields.filter(f => visibleFields.includes(f));
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
  useEffect(() => {
    if (!focusVersion || selectedRow === undefined) return;
    // The popup's link must reveal the complete record even when filters hide it.
    setFilters({}); setVisibleFields(data.fields);
    const position = rows.indexOf(selectedRow);
    if (full && position >= 0) setStart(Math.floor(selectedRow / VECTOR_LIMIT) * VECTOR_LIMIT);
    scroller.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVersion]);
  const title = t(full ? "attributesFull" : "attributes");
  return <section aria-label={title} className="flex h-full min-h-0 flex-col gap-1 p-2">
    <div className="flex shrink-0 items-center gap-2"><h3 className="mr-auto text-xs font-semibold" title={t(full ? "tableScopeFull" : "tableScopePage", { limit: VECTOR_LIMIT })}>{title}</h3>
      <Popover><PopoverTrigger asChild><MapButton variant="ghost">{t("columns")}</MapButton></PopoverTrigger><PopoverContent className="max-h-80 w-64 space-y-2 overflow-auto p-3 text-xs"><p>{t(full ? "tableScopeFull" : "tableScopePage", { limit: VECTOR_LIMIT })}</p>{data.fields.map(field => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={visibleFields.includes(field)} disabled={fields.length === 1 && visibleFields.includes(field)} onChange={e => setVisibleFields(current => e.target.checked ? [...current, field] : current.filter(f => f !== field))} />{field}</label>)}</PopoverContent></Popover>
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs" title={t(full ? "tableScopeFull" : "tableScopePage", { limit: VECTOR_LIMIT })}>
      <span>{t("rowsSummary", { matched: rows.length, total: features.length })}</span>
      {full && rows.length > 0 && <span>{t("rowsRange", { from: pageStart + 1, to: pageStart + shown.length })}</span>}
      {!full && <span>{t("offset", { offset })}</span>}
      {(filtered || sort) && <MapButton className={button} onClick={() => { setFilters({}); changeSort(undefined); }}>{t("clearFilters")}</MapButton>}
    </div>
    <div ref={scroller} data-map-table-scroller tabIndex={0} aria-label={title} className="relative min-h-0 flex-1 overflow-auto border border-gaid-edge outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]"><tr>{fields.map(field => {
          const direction = sort?.field === field ? sort.direction : undefined;
          const SortIcon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
          return <th key={field} className="resize-x overflow-auto whitespace-nowrap border-r p-0 font-medium last:border-r-0" style={{ minWidth: 96, maxWidth: 480 }} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
            <div className="flex items-center">
              <MapButton type="button" variant="ghost" className="flex flex-1 items-center gap-1 px-1.5 py-1 text-left hover:bg-muted" title={t("sortCycle")} onClick={() => changeSort(nextSort(sort, field))}>
                <span>{field}</span><SortIcon aria-hidden className={`size-3 ${direction ? "" : "opacity-40"}`} />
              </MapButton>
              <Popover open={menu === field} onOpenChange={open => setMenu(open ? field : undefined)}>
                <PopoverTrigger asChild><MapButton type="button" variant="ghost" aria-label={t("columnMenu", { field })} className={`px-1 py-1 hover:bg-muted ${isActive(filters[field]) ? "text-primary" : "text-muted-foreground"}`}><ListFilter aria-hidden className="size-3.5" /></MapButton></PopoverTrigger>
                <PopoverContent align="start" collisionPadding={8} className="w-64 space-y-2 p-3 text-xs">
                  <ColumnMenu field={field} features={features} filter={filters[field]} direction={direction}
                    onSort={next => { changeSort(next ? { field, direction: next } : undefined); }} onFilter={f => changeFilter(field, f)} />
                </PopoverContent>
              </Popover>
            </div>
          </th>;
        })}</tr></thead>
        <tbody>{shown.map(row => <tr key={row} aria-selected={selectedRow === row} tabIndex={0} className="h-9 cursor-pointer border-t border-gaid-edge hover:bg-gaid-hover aria-selected:bg-gaid-signal-tint"
          onClick={() => onSelect(row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(row); } }}>
          {fields.map(field => { const raw = features[row].properties[field]; const value = raw == null ? t("missing") : textValue(raw); return <td className={`max-w-[16rem] truncate border-r px-2 py-1 tabular-nums last:border-r-0 ${raw == null ? "text-gaid-nodata" : typeof raw === "number" ? "text-right" : ""}`} title={value} key={field}>{value}</td>; })}
        </tr>)}</tbody>
      </table>
      {!features.length ? <p className="p-2">{t("empty")}</p> : !rows.length ? <p className="p-2">{t("noMatch")}</p> : null}
    </div>
    <div className="flex shrink-0 gap-2">{full
      ? <><MapButton className={button} disabled={pageStart === 0} onClick={() => setStart(Math.max(0, pageStart - VECTOR_LIMIT))}>{t("previous")}</MapButton><MapButton className={button} disabled={pageStart + VECTOR_LIMIT >= rows.length} onClick={() => setStart(pageStart + VECTOR_LIMIT)}>{t("next")}</MapButton></>
      : <><MapButton className={button} disabled={offset === 0 || loading} onClick={() => onOffset(Math.max(0, offset - VECTOR_LIMIT))}>{t("previous")}</MapButton><MapButton className={button} disabled={data.nextOffset === null || loading} onClick={() => onOffset(data.nextOffset!)}>{t("next")}</MapButton></>}
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
      <MapButton className={button} aria-pressed={direction === "asc"} onClick={() => onSort("asc")}>{t("sortAsc")}</MapButton>
      <MapButton className={button} aria-pressed={direction === "desc"} onClick={() => onSort("desc")}>{t("sortDesc")}</MapButton>
      {direction && <MapButton className={button} onClick={() => onSort(undefined)}>{t("sortClear")}</MapButton>}
    </div>
    <label className="flex flex-col gap-1">{t("filterText")}<input className={mapInput} value={filter?.text ?? ""} onChange={e => onFilter({ ...filter, text: e.target.value })} /></label>
    <fieldset className="space-y-1"><legend className="mb-1">{t("filterValues")}</legend>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!filter?.values} onChange={e => onFilter({ ...filter, values: e.target.checked ? undefined : [] })} />{t("selectAll")}</label>
      <ul className="max-h-48 space-y-0.5 overflow-auto">{values.map(v => <li key={v.key}><label className="flex items-center gap-2"><input type="checkbox" checked={checked(v.key)} onChange={e => toggle(v.key, e.target.checked)} />
        <span className="min-w-0 flex-1 truncate" title={textValue(v.value)}>{v.key === MISSING_KEY ? t("nodata") : textValue(v.value)}</span><span className="text-muted-foreground">{v.count}</span></label></li>)}</ul>
      {more && <p className="text-muted-foreground">{t("moreValues", { limit: values.length })}</p>}
    </fieldset>
    <MapButton className={button} disabled={!isActive(filter)} onClick={() => onFilter(undefined)}>{t("clearFilter")}</MapButton>
  </>;
}
