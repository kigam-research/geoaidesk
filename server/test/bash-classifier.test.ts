/**
 * Table-driven checks for the raw-data guard classifier, run against BOTH the
 * server module and the byte-identical copy in the kady-guard package.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as server from "../src/agent/bash-classifier.ts";
import * as pkg from "../pi-packages/kady-guard/classifier.ts";

const SANDBOX = "/proj/sandbox";
const globs = ["user_data/**", "raw/*.csv", "reference"];

const protectedCases: Array<[string, string]> = [
  ["rm user_data/a.csv", "user_data/a.csv"],
  ["rm -rf user_data", "user_data"],
  ["rm -rf ./user_data/", "user_data"],
  ["rm -rf user_data/*", "user_data/*"],
  ["mv user_data/a.csv derived/", "user_data/a.csv"],
  ["cp derived/x.csv user_data/x.csv", "user_data/x.csv"],
  ["cd user_data && rm a.csv", "user_data/a.csv"],
  ["cd user_data; cd sub; rm b.csv", "user_data/sub/b.csv"],
  ["echo x > user_data/a.csv", "user_data/a.csv"],
  ["cat a >> user_data/log.txt", "user_data/log.txt"],
  ["sed -i 's/a/b/' user_data/a.csv", "user_data/a.csv"],
  ["perl -pi -e 's/a/b/' user_data/a.csv", "user_data/a.csv"],
  ["sudo rm -rf user_data", "user_data"],
  ["FOO=1 rm user_data/a.csv", "user_data/a.csv"],
  ["tee user_data/out.txt", "user_data/out.txt"],
  ["dd if=/dev/zero of=user_data/a.bin", "user_data/a.bin"],
  ["find user_data -name '*.tmp' -delete", "user_data"],
  ["rm raw/a.csv", "raw/a.csv"],
  ["rm reference/genome.fa", "reference/genome.fa"],
  [`rm -rf ${SANDBOX}/user_data/a.csv`, "user_data/a.csv"],
  ["touch user_data/.keep", "user_data/.keep"],
  ["chmod 600 user_data/a.csv", "user_data/a.csv"],
  ['rm "user_data/with space.csv"', "user_data/with space.csv"],
  ["git rm user_data/a.csv", "user_data/a.csv"],
  ["rsync -a derived/ user_data/", "user_data"],
  ["perl -pi -e's/a/b/' user_data/a.csv", "user_data/a.csv"],
  ["find . -exec rm user_data/a.csv \\;", "user_data/a.csv"],
];

const destructiveCases: string[] = [
  "rm -rf results",
  "rm -r derived",
  "rm -fr .",
  "rm *.csv",
  "git clean -fdx",
  "git reset --hard HEAD~1",
  "git checkout -- .",
  "find . -name '*.png' -delete",
  "ls | xargs rm",
  "shred secrets.txt",
  "dd if=a of=b",
];

const outsideCases: Array<[string, string]> = [
  ["echo x > /opt/gaid/geo/distribution.json", "/opt/gaid/geo/distribution.json"],
  ["echo x >> ../outside.txt", "/proj/outside.txt"],
  ["tee /opt/gaid/file", "/opt/gaid/file"],
  ["cp derived/a /opt/gaid/a", "/opt/gaid/a"],
  ["cp -t /opt/gaid derived/a", "/opt/gaid"],
  ["cp --target-directory=/opt/gaid derived/a", "/opt/gaid"],
  ["mv /opt/gaid/a derived/a", "/opt/gaid/a"],
  ["mv derived/a /opt/gaid/a", "/opt/gaid/a"],
  ["rsync -a derived/ /opt/gaid/", "/opt/gaid"],
  ["install derived/a /opt/gaid/a", "/opt/gaid/a"],
  ["ln -s derived/a /opt/gaid/link", "/opt/gaid/link"],
  ["rm /opt/gaid/a", "/opt/gaid/a"],
  ["rm -rf ../elsewhere", "/proj/elsewhere"],
  ["mkdir -p ~/assets/geo-catalogue/0.2.2", "/home/test/assets/geo-catalogue/0.2.2"],
  ['mkdir -p "$HOME/.geoaidesk/catalogue"', "/home/test/.geoaidesk/catalogue"],
  ["touch /opt/gaid/file", "/opt/gaid/file"],
  ["chmod 600 /opt/gaid/file", "/opt/gaid/file"],
  ["cd /opt/gaid; chmod 600 file", "/opt/gaid/file"],
  ["install -d /opt/gaid derived/dir", "/opt/gaid"],
  ["sed -i 's/a/b/' /opt/gaid/file", "/opt/gaid/file"],
  ["sed --in-place=.bak -e 's/a/b/' /opt/gaid/file", "/opt/gaid/file"],
  ["perl -pi -e 's/a/b/' /opt/gaid/file", "/opt/gaid/file"],
  ["perl -pi -e's/a/b/' /opt/gaid/file", "/opt/gaid/file"],
  ["dd if=derived/a of=/opt/gaid/file", "/opt/gaid/file"],
  ["find /opt/gaid -name '*.tmp' -delete", "/opt/gaid"],
  ["cd /opt/gaid && touch file", "/opt/gaid/file"],
  ["cd ..; mkdir sibling", "/proj/sibling"],
  ["cd /opt/gaid; git reset --hard", "/opt/gaid"],
  ["echo x > /proj/sandbox/../outside.txt", "/proj/outside.txt"],
  ["touch /tmp/../outside", "/outside"],
  ["touch /tmp-other/file", "/tmp-other/file"],
  ["touch /var/tmp/custom-other/file", "/var/tmp/custom-other/file"],
];

const allowedCases: string[] = [
  "head user_data/a.csv",
  "cat /opt/gaid/geo/distribution.json",
  "cp /opt/gaid/a derived/a",
  "ln -s /opt/gaid/a derived/link",
  "sed -i 's/a/b/' derived/a",
  "perl -pi -e 's/a/b/' derived/a",
  "mkdir -p derived/a",
  "echo x > /dev/null",
  "echo x > /tmp/outside.txt",
  "touch /var/tmp/custom/file",
  "cd /opt/gaid && cat file",
  "cd /opt/gaid && cd /proj/sandbox && touch derived/file",
  "echo x 2>&1",
  "cat user_data/a.csv | wc -l",
  "uv run python analyze.py --input user_data/a.csv --out derived/a.parquet",
  "cp user_data/a.csv derived/a.csv",
  "ls -la user_data",
  "grep -r foo user_data",
  "rm derived/tmp.txt",
  "rm -rf node_modules",
  "rm -rf .venv && uv sync",
  "rm -rf /tmp/scratch",
  "rm -rf __pycache__ .pytest_cache",
  "mv derived/a.csv derived/b.csv",
  "echo done > derived/log.txt",
  "git checkout -b feature",
  "cd user_data && head a.csv",
  "cd user_data && cd .. && rm derived/x",
  "find results -name '*.png'",
  "python -c \"print('rm -rf user_data')\"",
];

for (const [name, mod] of [
  ["server module", server],
  ["kady-guard package copy", pkg],
] as const) {
  describe(`classifyBashCommand (${name})`, () => {
    const opts = { protectedGlobs: globs, sandboxRoot: SANDBOX, homeDir: "/home/test", tempDirs: ["/var/tmp/custom"] };
    it.each(protectedCases)("blocks protected mutation: %s", (command, expectedPath) => {
      const verdict = mod.classifyBashCommand(command, opts);
      expect(verdict.kind).toBe("protected");
      if (verdict.kind === "protected") expect(verdict.path).toBe(expectedPath);
    });
    it.each(outsideCases)("flags outside-project mutation: %s", (command, target) => {
      expect(mod.classifyBashCommand(command, opts)).toMatchObject({ kind: "outside-project", path: target });
    });
    it("keeps protected paths higher priority across command segments", () => {
      expect(mod.classifyBashCommand("touch /opt/file; rm user_data/a", opts).kind).toBe("protected");
      expect(mod.classifyBashCommand("rm -rf results; touch /opt/file", opts).kind).toBe("outside-project");
    });
    it.each(destructiveCases)("flags destructive: %s", (command) => {
      expect(mod.classifyBashCommand(command, opts).kind).toBe("destructive");
    });
    it.each(allowedCases)("allows: %s", (command) => {
      expect(mod.classifyBashCommand(command, opts)).toEqual({ kind: "allow" });
    });
    it("classifies write/edit paths", () => {
      expect(mod.classifyFilePath("user_data/a.csv", opts)).toMatchObject({ kind: "protected", path: "user_data/a.csv" });
      expect(mod.classifyFilePath(`${SANDBOX}/user_data/deep/a.csv`, opts)).toMatchObject({ kind: "protected" });
      expect(mod.classifyFilePath("derived/a.csv", opts)).toEqual({ kind: "allow" });
      expect(mod.classifyFilePath("/etc/hosts", opts)).toEqual({ kind: "outside-project", path: "/etc/hosts" });
      expect(mod.classifyFilePath("../escape/user_data/a.csv", opts)).toEqual({ kind: "outside-project", path: "/proj/escape/user_data/a.csv" });
      for (const target of ["/tmp/a", "/var/tmp/custom/a", "/dev/null"]) expect(mod.classifyFilePath(target, opts).kind).toBe("allow");
      expect(mod.classifyFilePath("/proj/sandbox/../other", opts).kind).toBe("outside-project");
    });
    it("matches globs as documented", () => {
      expect(mod.globToRegExp("user_data/**").test("user_data")).toBe(true);
      expect(mod.globToRegExp("user_data/**").test("user_data/a/b.csv")).toBe(true);
      expect(mod.globToRegExp("user_data/**").test("user_data_backup/a")).toBe(false);
      expect(mod.globToRegExp("**/*.csv").test("a/b/c.csv")).toBe(true);
      expect(mod.globToRegExp("**/*.csv").test("c.csv")).toBe(true);
      expect(mod.globToRegExp("raw/*.csv").test("raw/a.csv")).toBe(true);
      expect(mod.globToRegExp("raw/*.csv").test("raw/sub/a.csv")).toBe(false);
      expect(mod.globToRegExp("a/**/b").test("a/x/y/b")).toBe(true);
      expect(mod.globToRegExp("a/**/b").test("a/b")).toBe(true);
      expect(mod.globToRegExp("reference").test("reference/genome.fa")).toBe(true);
      expect(mod.globToRegExp("data.??").test("data.gz")).toBe(true);
    });
    it("protects Windows drive, UNC and Git Bash paths with case-insensitive matching", () => {
      for (const sandboxRoot of ["C:\\Study Folder\\sandbox", "\\\\host\\share\\sandbox"]) {
        const windows = { protectedGlobs: globs, sandboxRoot };
        for (const target of [`${sandboxRoot}\\user_data\\a.csv`, `${sandboxRoot.toLowerCase()}/USER_DATA/a.csv`]) {
          expect(mod.classifyFilePath(target, windows).kind).toBe("protected");
          expect(mod.classifyBashCommand(`rm "${target}"`, windows).kind).toBe("protected");
        }
        expect(mod.classifyFilePath(`${sandboxRoot}-other/user_data/a.csv`, windows).kind).toBe("outside-project");
      }
      const windows = { protectedGlobs: globs, sandboxRoot: "C:\\Study Folder\\sandbox" };
      expect(mod.classifyBashCommand('rm "/c/Study Folder/sandbox/user_data/a.csv"', windows).kind).toBe("protected");
      expect(mod.classifyFilePath("D:/Study Folder/sandbox/user_data/a.csv", windows).kind).toBe("outside-project");
    });
    it("treats a leading shell escape as relative, not as a root", () => {
      // bash runs `rm \user_data/a.csv` as `rm user_data/a.csv`.
      for (const sandboxRoot of ["/home/u/proj/sandbox", "C:\\Study Folder\\sandbox"]) {
        const options = { protectedGlobs: globs, sandboxRoot };
        expect(mod.classifyBashCommand("rm \\user_data/a.csv", options).kind).toBe("protected");
        expect(mod.classifyBashCommand("rm \\user_data\\a.csv", options).kind).toBe("protected");
      }
    });
  });
}

it("keeps the package copy byte-identical to the server module (after its header line)", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "agent", "bash-classifier.ts"), "utf-8");
  const copy = fs.readFileSync(path.join(import.meta.dirname, "..", "pi-packages", "kady-guard", "classifier.ts"), "utf-8");
  expect(copy.split("\n").slice(1).join("\n")).toBe(src);
});
