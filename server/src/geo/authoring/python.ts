/**
 * Python import and installed-copy checks for authored packages (ported from skill_hub
 * web/shared/atlas/byok-export.ts at 54fe477; findings are plain records here).
 */
import { execFileSync } from "node:child_process";

export interface PackageFile {
  path: string;
  sha256: string;
  size: number;
  /** UTF-8 text of `.md` and `.py` files, for the portability and import checks. */
  text?: string;
}

export interface PortabilityFinding {
  level: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

/** Canonical listing hashed into `packageDigest`: sorted `path\0sha256\n` lines. */
export function treeListing(files: Pick<PackageFile, "path" | "sha256">[]): string {
  return [...files]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => `${f.path}\0${f.sha256}\n`)
    .join("");
}

/** Frozen upstream copies keep their source verbatim; they are references, not runtime code. */
const frozen = (path: string) => /^references\/upstream[^/]*\//.test(path);

/** Distribution names for import names that differ (lower-case comparison). */
const DISTRIBUTIONS: Record<string, string> = {
  sklearn: "scikit-learn",
  pil: "pillow",
  yaml: "pyyaml",
  skimage: "scikit-image",
  skgstat: "scikit-gstat",
  cv2: "opencv-python",
  bs4: "beautifulsoup4",
};
export const distributionOf = (module: string) =>
  DISTRIBUTIONS[module.toLowerCase()] ?? module.toLowerCase().replace(/_/g, "-");
export const normalizeDependency = (name: string) =>
  name
    .split(/[\s=<>!~[;]/)[0]
    .toLowerCase()
    .replace(/_/g, "-");

/**
 * Distributions that are always installed together with another one (declared requirements of that
 * distribution), so code importing them needs no separate declaration. Kept explicit and short: a pair is
 * added only when the dependency is a hard requirement of the provider's published metadata.
 */
export const BUNDLED_WITH: Record<string, readonly string[]> = {
  "scikit-learn": ["joblib", "threadpoolctl", "scipy", "numpy"],
  pandas: ["numpy", "python-dateutil", "pytz", "tzdata"],
  matplotlib: ["numpy", "pillow", "packaging", "pyparsing", "cycler", "kiwisolver", "fonttools", "contourpy", "python-dateutil"],
  scipy: ["numpy"],
  geopandas: ["pandas", "shapely", "pyproj", "pyogrio", "numpy", "packaging"],
  rasterio: ["numpy", "affine", "attrs", "click", "certifi"],
  xgboost: ["numpy", "scipy"],
};

/** Distribution names (normalized) available when the given ones are installed. */
export function withBundled(names: Iterable<string>): Set<string> {
  const out = new Set<string>();
  const add = (name: string) => {
    const n = normalizeDependency(name);
    if (out.has(n)) return;
    out.add(n);
    for (const dep of BUNDLED_WITH[n] ?? []) add(dep);
  };
  for (const name of names) add(name);
  return out;
}

/**
 * Third-party top-level imports of a package: `import x`/`from x import` lines in `.py` files, minus the
 * standard library and modules the package itself provides (any `.py` file or directory name in it).
 */
export function pythonImports(files: PackageFile[], stdlib: ReadonlySet<string>): string[] {
  const local = new Set<string>();
  for (const f of files) {
    const parts = f.path.split("/");
    for (const dir of parts.slice(0, -1)) local.add(dir);
    if (f.path.endsWith(".py")) local.add(parts.at(-1)!.slice(0, -3));
  }
  const found = new Set<string>();
  for (const f of files) {
    if (!f.path.endsWith(".py") || frozen(f.path) || f.text === undefined) continue;
    for (const m of f.text.matchAll(
      /^[ \t]*(?:import[ \t]+([A-Za-z_]\w*)(?=[ \t]*(?:$|,|\.|[ \t]as[ \t]|#))|from[ \t]+([A-Za-z_]\w*)[\w.]*[ \t]+import[ \t])/gm,
    )) {
      const module = m[1] ?? m[2];
      if (!stdlib.has(module) && !local.has(module) && module !== "__future__") found.add(module);
    }
  }
  return [...found].sort();
}

let stdlib: ReadonlySet<string> | undefined;
/** Standard-library module names of the local Python (uv), cached per process. */
export function pythonStdlib(): ReadonlySet<string> {
  stdlib ??= new Set(
    JSON.parse(
      execFileSync(
        "uv",
        ["run", "--no-project", "python", "-c", "import sys,json; print(json.dumps(sorted(sys.stdlib_module_names)))"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 },
      ),
    ) as string[],
  );
  return stdlib;
}

/** Tests: use a fixed standard-library list instead of asking Python. */
export function setPythonStdlibForTests(names: ReadonlySet<string> | undefined): void {
  stdlib = names;
}

/**
 * Installed-copy portability: instructions must address files through the installed skill folder, and every
 * package-relative file they name must ship.
 */
export function portabilityFindings(files: PackageFile[]): PortabilityFinding[] {
  const present = new Set<string>();
  for (const f of files) {
    present.add(f.path);
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) present.add(parts.slice(0, i).join("/"));
  }
  const resolveFrom = (dir: string, target: string): string | undefined => {
    const out: string[] = dir ? dir.split("/") : [];
    for (const part of target.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        if (!out.length) return undefined;
        out.pop();
      } else out.push(part);
    }
    return out.join("/");
  };
  const result: PortabilityFinding[] = [];
  const add = (code: string, path: string, message: string) => result.push({ level: "error", code, path, message });
  for (const f of files) {
    if (!f.path.endsWith(".md") || frozen(f.path) || f.path.startsWith("examples/") || !f.text) continue;
    const dir = f.path.split("/").slice(0, -1).join("/");
    for (const m of f.text.matchAll(/(?:^|[\s`'"(])skills\/[a-z0-9-]+\/[A-Za-z0-9_.-]+/gm))
      add("repo-relative-path", f.path, `저장소 기준 경로는 설치된 사본에서 열리지 않습니다: ${m[0].trim()}`);
    const prose = f.text.replace(/^```[\s\S]*?^```/gm, "").replace(/`[^`\n]*`/g, "");
    for (const m of prose.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || /^[/?]/.test(target)) continue;
      let decoded = target;
      try {
        decoded = decodeURI(target);
      } catch {
        // keep the raw target
      }
      const path = resolveFrom(dir, decoded);
      if (path === undefined || !present.has(path)) add("package-link", f.path, `패키지에 없는 링크입니다: ${target}`);
    }
    if (f.path !== "SKILL.md") continue;
    for (const m of f.text.matchAll(
      /(?:^|[\s`'"(])(?:<[^>\s]+>\/)?((?:scripts|assets|references|tools|engine)\/[A-Za-z0-9_./-]*[A-Za-z0-9_]\.[A-Za-z0-9]+)/gm,
    ))
      if (!present.has(m[1])) add("package-file", f.path, `패키지에 없는 파일입니다: ${m[1]}`);
  }
  const unique = new Map(result.map((r) => [`${r.code}\0${r.path}\0${r.message}`, r]));
  return [...unique.values()];
}
