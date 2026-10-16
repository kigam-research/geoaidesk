"use client";
/**
 * What an input or a result looks like: an example table with the declared columns, a small boundary sketch for
 * polygon inputs, or a picture (a paper figure or a concept image) for results. Example values are illustrative and
 * labelled as such; they are not data from the researcher.
 */
import type { InputPort, OutputPort } from "@/geo/contracts/authoring";
import { geoText } from "@/geo/i18n";

import { localText } from "./text";

const text = geoText("hub");

/** Columns to show for a table input: declared columns, else a generic grid-table layout. */
export function exampleColumns(port: InputPort): string[] {
  const declared = port.constraints?.columns ?? [];
  if (declared.length) return declared.slice(0, 6);
  return ["x", "y", "label", "feature_1", "feature_2", "…"];
}

function exampleValue(column: string, row: number): string {
  const c = column.toLowerCase().replace(/[<>]/g, "");
  if (c === "…" || c === "...") return "…";
  if (/^(x|tmx)$|east|lon|경도/.test(c)) return String(512_500 + row * 5000);
  if (/^(y|tmy)$|north|lat|위도/.test(c)) return String(6_702_500 - row * 5000);
  if (/label|deposit|positive|mine|라벨|광상|양성/.test(c)) return row === 1 ? "1" : "0";
  if (/id$|_id|번호/.test(c)) return `C-${10_412 + row * 37}`;
  return (0.12 + row * 0.31).toFixed(2);
}

export function TableExample({ port }: { port: InputPort }) {
  const columns = exampleColumns(port);
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((r) => (
              <tr key={r} className="border-t">
                {columns.map((c) => (
                  <td key={c} className="px-2.5 py-1 font-mono whitespace-nowrap text-muted-foreground">
                    {exampleValue(c, r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <span>{text("io.exampleOf", { formats: port.formats.join(", ") })}</span>
        {port.description && <span>{localText(port.description)}</span>}
      </figcaption>
    </figure>
  );
}

export function BoundaryExample({ port }: { port: InputPort }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox="0 0 240 150"
        className="w-full rounded-lg border bg-muted/30"
        role="img"
        aria-label={localText(port.label)}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 20}
            y1={0}
            x2={i * 20}
            y2={150}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * 20}
            x2={240}
            y2={i * 20}
            stroke="currentColor"
            className="text-border"
            strokeWidth={0.5}
          />
        ))}
        <path
          d="M30 110 L52 40 L110 22 L170 34 L208 78 L190 124 L120 136 L64 130 Z"
          fill="#1f5eff"
          fillOpacity={0.12}
          stroke="#1f5eff"
          strokeWidth={2}
        />
        <path d="M110 22 L120 136" stroke="#1f5eff" strokeDasharray="4 3" strokeWidth={1} />
      </svg>
      <figcaption className="text-xs text-muted-foreground">
        {text("io.shapeOf", { formats: port.formats.join(", ") })}
      </figcaption>
    </figure>
  );
}

export function InputExample({ port }: { port: InputPort }) {
  const polygon =
    port.formats.some((f) => /shp|shapefile|gpkg|geopackage|geojson|polygon|vector/i.test(f)) ||
    /boundary|polygon|region|vector|area/i.test(port.semanticType) ||
    /경계|도형|폴리곤|polygon|boundary/i.test(localText(port.label));
  return polygon ? <BoundaryExample port={port} /> : <TableExample port={port} />;
}

/** Example rows for a result table, from the output's label (illustrative values). */
function ResultTable({ port }: { port: OutputPort }) {
  const label = localText(port.label);
  const ranking = /순위|rank|목록|list/i.test(label);
  const columns = ranking ? ["cell_id", "zone", "p_mean", "ρIQR"] : ["fold", "PR-AUC", "ROC-AUC", "coverage"];
  const rows = ranking
    ? [
        ["C-10412", "0", "0.81", "0.18"],
        ["C-10977", "0", "0.77", "0.22"],
        ["C-20031", "1", "0.64", "0.27"],
      ]
    : [
        ["0", "0.19", "0.91", "0.86"],
        ["1", "0.21", "0.90", "0.84"],
        ["2", "0.18", "0.92", "0.87"],
      ];
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((v, j) => (
                <td key={j} className="px-2.5 py-1 font-mono whitespace-nowrap text-muted-foreground">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultExample({
  port,
  image,
  imageKind,
}: {
  port: OutputPort;
  image?: string | null;
  imageKind?: "paper" | "generated";
}) {
  const tabular = !image && (port.kind === "table" || port.kind === "report");
  return (
    <figure className="flex flex-col gap-1.5">
      {tabular ? (
        <ResultTable port={port} />
      ) : image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="w-full rounded-lg border object-contain" />
      ) : (
        <div className="flex aspect-[3/2] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          {text("io.noImage")}
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">
        {tabular
          ? text("io.exampleTable")
          : imageKind === "paper"
            ? text("io.paperFigure")
            : imageKind === "generated"
              ? text("io.generated")
              : text("io.noImage")}
      </figcaption>
    </figure>
  );
}
