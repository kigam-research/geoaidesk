import { readFileSync } from "node:fs";
import { networkInterfaces, homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { HubAccounts } from "./accounts.ts";
import { backupHub, checkBackup } from "./backup.ts";
import { HubDatabase, HubServerError } from "./core.ts";
import { importHub } from "./import.ts";
import { buildHubServer } from "./index.ts";
const HELP = `GAID hub server (Node >= 22.19)
  node geo/hub-server.mjs serve [--host 0.0.0.0] [--port 8700]
  node geo/hub-server.mjs invite --email EMAIL [--role admin|member]
  node geo/hub-server.mjs users
  node geo/hub-server.mjs backup --to DIR
  node geo/hub-server.mjs check-backup DIR
  node geo/hub-server.mjs import-hub --from DIR --authors MAP.json [--unmapped-to EMAIL] [--apply]
Every command: --home DIR, or GAID_HUB_SERVER_HOME (default ~/.geoaidesk-hub).
Import is a dry-run unless --apply is present. Run check-backup before restoring a backup.`;
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    home: { type: "string" }, host: { type: "string" }, port: { type: "string" }, email: { type: "string" },
    role: { type: "string" }, to: { type: "string" }, from: { type: "string" }, authors: { type: "string" },
    "unmapped-to": { type: "string" }, apply: { type: "boolean" }, help: { type: "boolean" },
  } });
  const [command, ...args] = positionals;
  if (!command || values.help) { console.log(HELP); return; }
  const rawHome = values.home ?? process.env.GAID_HUB_SERVER_HOME ?? join(homedir(), ".geoaidesk-hub");
  const home = rawHome === "~" ? homedir() : rawHome.startsWith("~/") ? join(homedir(), rawHome.slice(2)) : rawHome;
  if (command === "check-backup") {
    if (args.length !== 1) throw new Error("Usage: check-backup DIR");
    console.log(JSON.stringify(checkBackup(args[0]), null, 2)); return;
  }
  if (args.length) throw new Error("Unexpected positional arguments");
  if (command === "serve") {
    const port = Number(values.port ?? 8700);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Port must be 1–65535");
    const host = values.host ?? "0.0.0.0";
    const app = buildHubServer({ home });
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
      void app.close().then(() => { process.exitCode = 0; }).catch((e: Error) => { console.error(e.message); process.exitCode = 1; });
    });
    try { await app.listen({ host, port }); }
    catch (e) { await app.close(); throw e; }
    console.log(`GAID hub server ${app.hub.server.serverId}\nHome: ${app.hub.home}`);
    if (["0.0.0.0", "::"].includes(host)) {
      const ips = Object.values(networkInterfaces()).flatMap((entries) => entries ?? []).filter((e) => e.family === "IPv4" && !e.internal).map((e) => e.address);
      for (const ip of ips) console.log(`GAID Settings → hub server URL: http://${ip}:${port}`);
      if (!ips.length) console.log(`Listening: http://localhost:${port} (set a LAN hostname in researchers' GAIDs)`);
    } else console.log(`GAID Settings → hub server URL: http://${host.includes(":") ? `[${host}]` : host}:${port}`);
    console.log("Plain HTTP: credentials, tokens, Workflows and synced PDFs cross the LAN unencrypted (pilot setting).");
    return;
  }
  if (!["invite", "users", "backup", "import-hub"].includes(command)) throw new Error(HELP);
  const hub = new HubDatabase({ home });
  try {
    const accounts = new HubAccounts(hub);
    if (command === "invite") {
      if (!values.email) throw new Error("Usage: invite --email EMAIL [--role admin|member]");
      const role = values.role ?? "member";
      if (role !== "admin" && role !== "member") throw new Error("Role must be admin or member");
      if (!accounts.users().some((a) => a.role === "admin" && !a.disabledAt) && role !== "admin")
        throw new HubServerError("첫 초대는 관리자 역할로 만들어야 합니다.");
      console.log(JSON.stringify(accounts.invite({ email: values.email, role }), null, 2));
    } else if (command === "users") console.log(JSON.stringify({ users: accounts.users() }, null, 2));
    else if (command === "backup") {
      if (!values.to) throw new Error("Usage: backup --to DIR");
      const manifest = backupHub(hub, values.to);
      console.log(JSON.stringify({ directory: values.to, serverId: manifest.serverId, files: manifest.files.length, rows: manifest.rows }, null, 2));
    } else {
      if (!values.from || !values.authors) throw new Error("Usage: import-hub --from DIR --authors MAP.json [--apply]");
      console.log(JSON.stringify(await importHub(hub, { from: values.from, authors: JSON.parse(readFileSync(values.authors, "utf8")),
        unmappedTo: values["unmapped-to"], apply: values.apply }), null, 2));
    }
  } finally { hub.close(); }
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
