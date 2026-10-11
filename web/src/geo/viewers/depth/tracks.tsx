"use client";
import type { DepthFlag, DepthFlagKind, DepthSample, DepthWindow } from "../../contracts/depth";
import { depthText as t } from "./strings";
export const FLAG_STYLE: Record<DepthFlagKind, { color: string; mark: string }> = {
  missing: { color: "#64748b", mark: "○" }, "depth-gap": { color: "#a16207", mark: "═" },
  "depth-duplicate": { color: "#7c3aed", mark: "□" }, "depth-reversal": { color: "#7c3aed", mark: "↶" },
  range: { color: "#dc2626", mark: "●" }, spike: { color: "#b45309", mark: "▲" }, enlargement: { color: "#0369a1", mark: "◆" },
};
/** Never join through missing values or a discontinuous/reversed depth pass. */
export function curvePath(rows: DepthSample[], columnIndex: number, x: (n: number) => number, y: (n: number) => number): string {
  let pen = false, path = "";
  for (const row of rows) {
    const value = row.values[columnIndex];
    if (value == null || row.depth == null) { pen = false; continue; }
    path += `${!pen || row.breakBefore ? "M" : "L"}${x(value).toFixed(2)},${y(row.depth).toFixed(2)} `;
    pen = true;
  }
  return path;
}
/** A move-only SVG path has no visible stroke: keep isolated valid observations visible. */
export function singletonSamples(rows: DepthSample[], columnIndex: number): DepthSample[] {
  const valid = (row?: DepthSample) => row != null && row.depth !== null && row.values[columnIndex] != null;
  return rows.filter((row, i) => valid(row)
    && !(valid(rows[i - 1]) && !row.breakBefore)
    && !(valid(rows[i + 1]) && !rows[i + 1].breakBefore));
}
export function DepthTracks({ data, flags, onRow }: { data: DepthWindow; flags: DepthFlag[]; onRow: (row: number) => void }) {
  const depths = data.rows.map(r => r.depth).filter((d): d is number => d !== null);
  if (!depths.length) return <p>{t("noDepth")}</p>;
  const low = Math.min(...depths), high = Math.max(...depths);
  const y = (v: number) => 56 + (v - low) / (high - low || 1) * 500;
  return <div className="overflow-x-auto"><svg role="img" aria-label={t("tracks")} viewBox={`0 0 ${85 + data.selectedColumns.length * 200} 600`} style={{ minWidth: 85 + data.selectedColumns.length * 200, width: "100%", height: 600 }}>
    <title>{t("tracks")} · {data.depth.mnemonic} [{data.depth.unit || t("unknown")}]</title>
    {Array.from({ length: 6 }, (_, n) => { const value = low + (high - low) * n / 5; return <g key={n}><text x={2} y={y(value) + 4} fontSize={11} fill="currentColor">{Number(value.toPrecision(7))}</text><line x1={72} x2={85 + data.selectedColumns.length * 200} y1={y(value)} y2={y(value)} stroke="currentColor" opacity={0.15} /></g>; })}
    <text x={2} y={25} fontSize={11} fill="currentColor">{data.depth.unit || t("unknown")}</text>
    {data.selectedColumns.map((col, j) => {
      const curve = data.curves[col];
      const values = data.rows.map(r => r.values[j]).filter((v): v is number => v !== null);
      const min = values.length ? Math.min(...values) : 0, max = values.length ? Math.max(...values) : 1;
      const left = 85 + j * 200, x = (v: number) => left + 8 + (v - min) / (max - min || 1) * 164;
      return <g key={col}>
        <text x={left + 90} y={18} textAnchor="middle" fontSize={12} fill="currentColor">{curve.mnemonic} [{curve.unit || t("unknown")}]</text>
        <text x={left + 8} y={38} fontSize={10} fill="currentColor">{values.length ? Number(min.toPrecision(5)) : t("unknown")}</text><text x={left + 172} y={38} textAnchor="end" fontSize={10} fill="currentColor">{values.length ? Number(max.toPrecision(5)) : t("unknown")}</text>
        <rect x={left} y={50} width={185} height={512} fill="none" stroke="currentColor" opacity={0.3} />
        <path data-testid={`curve-${col}`} d={curvePath(data.rows, j, x, y)} fill="none" stroke="#2563eb" strokeWidth={1.3} />
        {singletonSamples(data.rows, j).map(row => <circle key={row.row} data-testid={`singleton-${col}-${row.row}`} cx={x(row.values[j]!)} cy={y(row.depth!)} r={2.5} fill="#2563eb" role="button" tabIndex={0} aria-label={`${curve.mnemonic}: ${row.values[j]} ${curve.unit} · ${t("row")} ${row.row}`} onClick={() => onRow(row.row)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onRow(row.row); }}><title>{curve.mnemonic}: {row.values[j]} {curve.unit} · {t("row")} {row.row}</title></circle>)}
        {!values.length && <text x={left + 8} y={85} fontSize={11} fill="currentColor">{t("allNull")}</text>}
        {flags.filter(f => f.column === undefined || f.column === col).map((f, k) => {
          const row = data.rows.find(r => r.row >= f.fromRow && r.row <= f.toRow && r.depth !== null);
          if (!row || row.depth === null) return null;
          return <text key={k} x={left + 180} y={y(row.depth)} fill={FLAG_STYLE[f.kind].color} fontSize={16} role="button" tabIndex={0} aria-label={`${t(f.kind)} ${f.fromRow}–${f.toRow}`} onClick={() => onRow(f.fromRow)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onRow(f.fromRow); }} style={{ cursor: "pointer" }}>{FLAG_STYLE[f.kind].mark}<title>{t(f.kind)} · {f.fromRow}–{f.toRow}</title></text>;
        })}
      </g>;
    })}
  </svg></div>;
}
