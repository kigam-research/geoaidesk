/**
 * Raw-data guard: pure classification of file-tool paths and shell commands.
 *
 * Three questions, answered without touching the filesystem:
 *
 *   1. Does this call MUTATE a protected path (default `user_data/**`)?
 *      → hard block, for the lead agent and background specialists alike.
 *   2. Does a recognized mutation target lie outside the sandbox (apart from
 *      temporary folders and /dev/null)? → the lead asks; a child is blocked.
 *   3. Is this shell command DESTRUCTIVE elsewhere (`rm -rf`, `git clean -f`,
 *      `find … -delete`, …)? → the lead asks the user; a child is blocked.
 *
 * This is a heuristic tokenizer, not a shell parser, and deliberately biased
 * toward flagging: a false positive costs the model one retry with a clearer
 * command, a false negative deletes someone's raw data. It is defense in
 * depth, not a security boundary (see docs/limitations.md).
 *
 * `server/pi-packages/kady-guard/classifier.ts` is a byte-identical copy
 * (packages are loaded standalone by child pi processes); a parity test keeps
 * them in step.
 */

import path from "node:path";

export type BashVerdict =
  | { kind: "allow" }
  | { kind: "protected"; path: string; glob: string; detail: string }
  | { kind: "destructive"; detail: string }
  | { kind: "outside-project"; path: string; detail: string };

export interface ClassifyOptions {
  /** Sandbox-relative globs (`user_data/**`, `raw/*.csv`). */
  protectedGlobs: readonly string[];
  /** Absolute sandbox root, to relativize absolute paths in commands. */
  sandboxRoot?: string;
  /** Runtime-supplied allowances; classification itself has no host state. */
  tempDirs?: readonly string[];
  homeDir?: string;
}

function escapeSegment(seg: string): string {
  let out = "";
  for (const ch of seg) {
    if (ch === "*") out += "[^/]*";
    else if (ch === "?") out += "[^/]";
    else if (/[.+^${}()|[\]\\]/.test(ch)) out += `\\${ch}`;
    else out += ch;
  }
  return out;
}

/**
 * Minimal glob → RegExp over sandbox-relative paths: `**` spans segments,
 * `*` stays within one, `?` is one char. `a/**` also matches `a` itself
 * (deleting the directory is a mutation), and a glob with no wildcard at all
 * protects its whole subtree (`user_data` ≡ `user_data/**`).
 */
export function globToRegExp(glob: string): RegExp {
  let normalized = normalizeRel(glob) ?? "";
  if (normalized && !/[*?]/.test(normalized)) normalized += "/**";
  const segs = normalized.split("/").filter(Boolean);
  let re = "";
  let joinWithoutSlash = false;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    if (seg === "**") {
      if (last) re += re ? "(?:/.*)?" : ".*";
      else {
        re += re ? "/(?:[^/]+/)*" : "(?:[^/]+/)*";
        joinWithoutSlash = true;
      }
      continue;
    }
    if (re && !joinWithoutSlash) re += "/";
    joinWithoutSlash = false;
    re += escapeSegment(seg);
  }
  return new RegExp(`^${re}$`);
}

/**
 * Strip `./`, leading and trailing `/`; collapse `.` and `..`. Returns null
 * when `..` climbs above the root (outside the sandbox).
 */
export function normalizeRel(p: string): string | null {
  const parts: string[] = [];
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  return parts.join("/");
}

/** Resolve a command token against a sandbox-relative cwd; absolute paths are
 *  relativized against `sandboxRoot`. Outside the sandbox → null. */
export function resolveSandboxPath(
  token: string,
  cwd: string,
  sandboxRoot?: string,
): string | null {
  let value = resolveTargetPath(token, cwd, { sandboxRoot });
  if (!value || value.startsWith("~") || value.startsWith("$")) return null;
  const windows = isWindowsRoot(sandboxRoot);
  // Backslashes are separators only beside a Windows sandbox, and a lone
  // leading one is never a root: bash runs `\user_data/a.csv` as
  // `user_data/a.csv`, so it stays relative (normalizeRel drops it).
  if (windows && !/^\\(?!\\)/.test(value)) {
    value = value.replace(/\\/g, "/");
    // Git Bash can spell the same drive as /c/... while file tools use C:\\...
    value = value.replace(/^\/([a-z])\//i, "$1:/");
  }
  if (value.startsWith("/") || (windows && /^[a-z]:\//i.test(value))) {
    if (!sandboxRoot) return null;
    const root = sandboxRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    const comparable = windows ? value.toLowerCase() : value;
    const comparableRoot = windows ? root.toLowerCase() : root;
    if (comparable.replace(/\/+$/, "") === comparableRoot) return "";
    if (!comparable.startsWith(comparableRoot + "/")) return null;
    value = value.slice(root.length + 1);
    return normalizeRel(value);
  }
  return normalizeRel(value);
}

/** Lexical resolution only: symlinks and shell expansion are not evaluated. */
function resolveTargetPath(token: string, cwd: string, opts: Pick<ClassifyOptions, "sandboxRoot" | "homeDir">): string {
  let value = stripQuotes(token);
  if (opts.homeDir && /^(~|\$HOME|\$\{HOME\})(\/|$)/.test(value)) {
    value = value.replace(/^(~|\$HOME|\$\{HOME\})/, opts.homeDir);
  }
  if (/^[~$]/.test(value)) return value;
  if (/^[~$]/.test(cwd) && !path.posix.isAbsolute(value) && !/^[a-z]:[\\/]/i.test(value)) return `${cwd}/${value}`;
  const windows = isWindowsRoot(opts.sandboxRoot);
  if (windows) value = value.replace(/^\\(?!\\)/, "").replace(/\\/g, "/").replace(/^\/([a-z])\//i, "$1:/");
  const api = windows ? path.win32 : path.posix;
  const base = cwd || opts.sandboxRoot;
  // With no absolute root, keep relative resolution relative. path.resolve
  // would otherwise read the host cwd, making the classifier stateful.
  if (!base || !api.isAbsolute(base)) {
    return api.normalize(api.isAbsolute(value) ? value : api.join(base || ".", value)).replace(/\\/g, "/");
  }
  return api.resolve(opts.sandboxRoot ?? base, cwd || ".", value).replace(/\\/g, "/");
}

function outsideTarget(token: string, cwd: string, opts: ClassifyOptions): string | null {
  const target = resolveTargetPath(token, cwd, opts);
  if (resolveSandboxPath(target, "", opts.sandboxRoot) !== null) return null;
  if (stripQuotes(token) === "/dev/null" || target === "/dev/null") return null;
  for (const dir of ["/tmp", ...(opts.tempDirs ?? [])]) {
    if (resolveSandboxPath(target, "", resolveTargetPath(dir, "", opts)) !== null) return null;
  }
  return target;
}

function isWindowsRoot(root?: string): boolean {
  return !!root && /^(?:[a-z]:[\\/]|[\\/]{2})/i.test(root);
}

export function matchProtected(rel: string, globs: readonly string[], caseInsensitive = false): string | null {
  const normalized = normalizeRel(rel);
  if (normalized === null) return null;
  for (const glob of globs) {
    if (!glob.trim()) continue;
    const pattern = globToRegExp(glob);
    if ((caseInsensitive ? new RegExp(pattern.source, "i") : pattern).test(normalized)) return glob;
  }
  return null;
}

function stripQuotes(token: string): string {
  if (token.length >= 2 && ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'")))) {
    return token.slice(1, -1);
  }
  return token;
}

/** Shell-ish tokenizer: honours quotes, splits on whitespace, keeps operators. */
export function tokenize(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: string | null = null;
  const push = () => {
    if (current) tokens.push(current);
    current = "";
  };
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    if (ch === ">" ) {
      push();
      if (segment[i + 1] === ">") {
        tokens.push(">>");
        i++;
      } else tokens.push(">");
      continue;
    }
    current += ch;
  }
  push();
  return tokens;
}

/** Split on `;`, `&&`, `||`, `|` and newlines, outside quotes. */
export function splitSegments(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "\n" || ch === ";") {
      segments.push(current);
      current = "";
      continue;
    }
    if ((ch === "&" && command[i + 1] === "&") || (ch === "|" && command[i + 1] === "|")) {
      segments.push(current);
      current = "";
      i++;
      continue;
    }
    if (ch === "|" || ch === "&") {
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

/** Commands whose path arguments are mutated in place. */
const MUTATING = new Set([
  "rm", "rmdir", "mv", "shred", "truncate", "unlink", "chmod", "chown", "chgrp",
  "tee", "mkfifo", "touch", "mkdir",
]);
const ENV_WRAPPERS = new Set(["sudo", "env", "nice", "nohup", "time", "command", "exec"]);
/** Targets whose recursive removal is routine, not destructive. */
const BENIGN_RM_TARGETS = [
  /^(\/tmp|tmp|\.tmp|\.cache|\.venv|venv|node_modules|__pycache__|\.pytest_cache|\.mypy_cache|\.ipynb_checkpoints|dist|build|\.ruff_cache)(\/|$)/,
];

function isFlag(token: string): boolean {
  return token.startsWith("-") && token !== "-";
}

function unwrap(tokens: string[]): string[] {
  let i = 0;
  while (i < tokens.length && (ENV_WRAPPERS.has(tokens[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))) {
    i++;
    // `sudo -u x`, `env -i`: skip flags following a wrapper
    while (i < tokens.length && isFlag(tokens[i])) i++;
  }
  return tokens.slice(i);
}

/**
 * Classify one shell command. Returns the first protected-path mutation, else
 * the first outside-project mutation, else the first destructive command,
 * else allow. Protected-path blocks take precedence across all segments.
 */
export function classifyBashCommand(command: string, opts: ClassifyOptions): BashVerdict {
  const globs = opts.protectedGlobs;
  let cwd = "";
  let destructive: BashVerdict | null = null;
  let outside: BashVerdict | null = null;
  const protectedHit = (token: string): { rel: string; glob: string } | null => {
    const rel = resolveSandboxPath(token, cwd, opts.sandboxRoot);
    if (rel === null) return null;
    const glob = matchProtected(rel, globs, isWindowsRoot(opts.sandboxRoot));
    return glob ? { rel, glob } : null;
  };
  const mutationHit = (token: string, label: string): BashVerdict | null => {
    const resolved = resolveTargetPath(token, cwd, opts);
    const hit = protectedHit(resolved);
    if (hit) return { kind: "protected", path: hit.rel, glob: hit.glob, detail: `${label} ${hit.rel}` };
    const target = outsideTarget(token, cwd, opts);
    if (target && !outside) outside = { kind: "outside-project", path: target, detail: `${label} ${target}` };
    return null;
  };

  for (const segment of splitSegments(command)) {
    const raw = tokenize(segment);
    if (raw.length === 0) continue;

    // Redirections into a protected path.
    for (let i = 0; i < raw.length - 1; i++) {
      if (raw[i] === ">" || raw[i] === ">>") {
        // `2>&1` duplicates a descriptor, rather than writing a file.
        if (/^&(?:\d+|-)$/.test(raw[i + 1])) continue;
        const hit = mutationHit(raw[i + 1], `redirect ${raw[i]}`);
        if (hit) return hit;
      }
    }

    const tokens = unwrap(raw.filter((t, i) => t !== ">" && t !== ">>" && raw[i - 1] !== ">" && raw[i - 1] !== ">>"));
    if (tokens.length === 0) continue;
    const cmd = stripQuotes(tokens[0]).split("/").pop() ?? tokens[0];
    const args = tokens.slice(1);
    const pathArgs = args.filter((a) => !isFlag(a));

    if (cmd === "cd") {
      const target = pathArgs[0];
      cwd = resolveTargetPath(target ?? opts.homeDir ?? "~", cwd, opts);
      continue;
    }

    const checkAll = (label: string, targets = pathArgs): BashVerdict | null => {
      for (const a of targets) {
        const hit = mutationHit(a, label);
        if (hit) return hit;
      }
      return null;
    };

    if (MUTATING.has(cmd)) {
      // Modes/owners and the truncate size are option values, not targets.
      let targets = pathArgs;
      if (["chmod", "chown", "chgrp"].includes(cmd) && !args.some((a) => a.startsWith("--reference"))) targets = pathArgs.slice(1);
      if (cmd === "truncate") targets = args.filter((a, i) => !isFlag(a) && !["-s", "--size", "-r", "--reference"].includes(args[i - 1]));
      const hit = checkAll(cmd, targets);
      if (hit) return hit;
    }
    if (cmd === "install" && args.includes("-d")) {
      const hit = checkAll("install -d");
      if (hit) return hit;
    }
    if (cmd === "cp" || cmd === "rsync" || cmd === "mv" || cmd === "install" || cmd === "ln") {
      // Destination (last path arg) is written; `mv` also removes its sources.
      const targetDir = args.findIndex((a) => a === "-t" || a === "--target-directory");
      const dest = targetDir >= 0 ? args[targetDir + 1] : args.find((a) => a.startsWith("--target-directory="))?.slice(19) ?? pathArgs[pathArgs.length - 1];
      if (dest) {
        const hit = mutationHit(dest, `${cmd} into`);
        if (hit) return hit;
      }
    }
    if ((cmd === "sed" || cmd === "perl") && args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"))) {
      // Expressions are not file operands (`sed -i 's/a/b/' file`, perl -e).
      const operands = args.filter((a, i) => !isFlag(a) && !["-e", "--expression", "-f", "--file"].includes(args[i - 1]));
      if (!args.some((a) => /^-[ef]/.test(a) || a.startsWith("--expression") || a.startsWith("--file"))) operands.shift();
      const hit = checkAll(`${cmd} -i`, operands);
      if (hit) return hit;
    }
    if (cmd === "dd") {
      const of = args.find((a) => a.startsWith("of="));
      if (of) {
        const hit = mutationHit(of.slice(3), "dd of=");
        if (hit) return hit;
      }
      if (!destructive) destructive = { kind: "destructive", detail: "dd writes raw blocks" };
    }
    if (cmd === "find" && (args.includes("-delete") || (args.includes("-exec") && args.some((a) => a === "rm")))) {
      const hit = checkAll("find -delete under", pathArgs.length ? pathArgs : ["."]);
      if (hit) return hit;
      if (!destructive) destructive = { kind: "destructive", detail: `${segment.trim()}` };
    }
    if (cmd === "xargs" && args.some((a) => stripQuotes(a) === "rm" || stripQuotes(a) === "shred")) {
      const verbIndex = args.findIndex((a) => a === "rm" || a === "shred");
      const hit = checkAll("xargs rm", args.slice(verbIndex + 1).filter((a) => !isFlag(a)));
      if (hit) return hit;
      if (!destructive) destructive = { kind: "destructive", detail: `${segment.trim()}` };
    }
    if (cmd === "git") {
      const sub = args.find((a) => !isFlag(a));
      const flags = args.filter(isFlag);
      const cwdRel = resolveSandboxPath(cwd || ".", "", opts.sandboxRoot);
      const cwdProtected = cwdRel ? matchProtected(cwdRel, globs, isWindowsRoot(opts.sandboxRoot)) : null;
      if (sub === "clean" && flags.some((f) => /^-[a-zA-Z]*f/.test(f) || f === "--force")) {
        if (cwdProtected) return { kind: "protected", path: cwdRel!, glob: cwdProtected, detail: "git clean inside protected path" };
        if (!destructive) destructive = { kind: "destructive", detail: segment.trim() };
      }
      if (sub === "reset" && flags.includes("--hard")) {
        if (!destructive) destructive = { kind: "destructive", detail: segment.trim() };
      }
      if (sub === "checkout" && (args.includes("--") || pathArgs.includes(".")) && !args.includes("-b")) {
        if (!destructive) destructive = { kind: "destructive", detail: segment.trim() };
      }
      if (sub === "rm") {
        const hit = checkAll("git rm", pathArgs.slice(1));
        if (hit) return hit;
      }
      if (["clean", "reset", "checkout", "rm"].includes(sub ?? "")) {
        const hit = mutationHit(".", `git ${sub}`);
        if (hit) return hit;
      }
    }
    if (cmd === "rm" || cmd === "rmdir" || cmd === "shred" || cmd === "unlink") {
      const recursive = cmd === "rm" && args.some((a) => /^-[a-zA-Z]*[rR]/.test(a) || a === "--recursive");
      const forced = cmd === "rm" && args.some((a) => /^-[a-zA-Z]*f/.test(a) || a === "--force");
      const targets = pathArgs.map((a) => resolveSandboxPath(a, cwd, opts.sandboxRoot) ?? stripQuotes(a));
      const benign = targets.length > 0 && targets.every((t) => BENIGN_RM_TARGETS.some((re) => re.test(t)));
      if (cmd === "shred" || (recursive && (forced || pathArgs.length > 0) && !benign) || (cmd === "rm" && pathArgs.some((a) => /[*?]/.test(a) && !benign))) {
        if (!destructive) destructive = { kind: "destructive", detail: segment.trim() };
      }
    }
    if (cmd === "truncate" && args.some((a) => a === "-s" || a.startsWith("--size"))) {
      if (!destructive) destructive = { kind: "destructive", detail: segment.trim() };
    }
  }
  return outside ?? destructive ?? { kind: "allow" };
}

/** `write`/`edit`: is the target under a protected glob? */
export function classifyFilePath(
  filePath: string,
  opts: ClassifyOptions,
): { kind: "allow" } | { kind: "protected"; path: string; glob: string } | { kind: "outside-project"; path: string } {
  const target = resolveTargetPath(filePath, "", opts);
  const rel = resolveSandboxPath(target, "", opts.sandboxRoot);
  if (rel === null) {
    const outside = outsideTarget(filePath, "", opts);
    return outside ? { kind: "outside-project", path: outside } : { kind: "allow" };
  }
  const glob = matchProtected(rel, opts.protectedGlobs, isWindowsRoot(opts.sandboxRoot));
  return glob ? { kind: "protected", path: rel, glob } : { kind: "allow" };
}

export function protectedBlockReason(path: string, glob: string, detail?: string): string {
  return (
    `Blocked by Kady's data guard: "${path}" is protected raw data (policy: ${glob})` +
    (detail ? ` — ${detail}` : "") +
    ". Raw uploads are read-only. Copy what you need into a working folder " +
    "(for example derived/) and operate on the copy. The user can change the " +
    "protected paths in the project settings."
  );
}
