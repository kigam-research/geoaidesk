import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSession, disposeProjectSessions } from "../src/agent/session-registry.ts";
import { ensureProjectExists } from "../src/projects.ts";

const projectId = "process-stop";
const alive = (pid: number) => {
  try { return !/^.*\) Z /.test(fs.readFileSync(`/proc/${pid}/stat`, "utf8")); }
  catch { return false; }
};
afterEach(() => disposeProjectSessions(projectId));

describe.skipIf(process.platform !== "linux")("lead session shell lifecycle", () => {
  it("aborts detached jobs, escalates TERM-resistant jobs and leaves another chat alive", async () => {
    const paths = ensureProjectExists(projectId);
    const settingsFile = path.join(paths.sandbox, ".pi/settings.json");
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    const settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, "utf8")) : {};
    fs.writeFileSync(settingsFile, JSON.stringify({ ...settings, shellCommandPrefix: "export GAID_TEST_PREFIX=present" }));
    const first = await createSession(projectId, paths);
    await first.agent.state.tools.find((tool) => tool.name === "bash")!.execute("prefix", { command: 'test "$GAID_TEST_PREFIX" = present' });
    const second = await createSession(projectId, paths);
    const launch = async (session: typeof first, file: string, command: string) => {
      const bash = session.agent.state.tools.find((tool) => tool.name === "bash")!;
      await bash.execute("launch", { command: `${command} > /dev/null 2>&1 < /dev/null & echo $! > ${file}` });
      const pid = Number(fs.readFileSync(path.join(paths.sandbox, file), "utf8"));
      expect(alive(pid)).toBe(true);
      return pid;
    };
    const a = await launch(first, "one.pid", "nohup sleep 300");
    const b = await launch(first, "two.pid", "setsid bash -c 'trap \"\" TERM; exec sleep 300'");
    const other = await launch(second, "other.pid", "sleep 300");
    await first.abort();
    expect(alive(a)).toBe(false);
    expect(alive(b)).toBe(false);
    expect(alive(other)).toBe(true);
    await disposeProjectSessions(projectId);
    expect(alive(other)).toBe(false);
  }, 30_000);
});
