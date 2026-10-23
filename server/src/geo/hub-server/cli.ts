import { readFileSync } from "node:fs";
import { networkInterfaces, homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { HubAccounts } from "./accounts.ts";
import { backupHub, checkBackup } from "./backup.ts";
import { dataHome, HubDatabase, HubServerError } from "./core.ts";
import { readOrcidClient, removeOrcidClient, writeOrcidClient } from "./orcid.ts";
import { HubFeeds } from "./feeds/store.ts";
import { intervalHours } from "./feeds/schedule.ts";
import { importHub } from "./import.ts";
import { buildHubServer } from "./index.ts";
const HELP = `GAID hub server (Node >= 22.19)
  node geo/hub-server.mjs serve [--host 0.0.0.0] [--port 8700] [--tls-cert PEM --tls-key PEM] [--trust-proxy] [--feeds-interval-hours 6]
  node geo/hub-server.mjs feeds list
  node geo/hub-server.mjs feeds approve ID... | --all-proposed
  node geo/hub-server.mjs feeds stop ID
  node geo/hub-server.mjs feeds fetch [--source ID]
  node geo/hub-server.mjs invite --email EMAIL [--role admin|member]
  node geo/hub-server.mjs users
  node geo/hub-server.mjs orcid-client set --client-id APP-… [--sandbox] [--redirect-uri URL]   (secret from standard input)
  node geo/hub-server.mjs orcid-client show | clear
  node geo/hub-server.mjs backup --to DIR
  node geo/hub-server.mjs check-backup DIR
  node geo/hub-server.mjs import-hub --from DIR --authors MAP.json [--unmapped-to EMAIL] [--apply]
Every command: --home DIR, or GAID_HUB_SERVER_HOME (default ~/.geoaidesk-hub).
TLS files may also come from GAID_HUB_SERVER_TLS_CERT / GAID_HUB_SERVER_TLS_KEY (docs/geo/hub-server-https.md).
Import is a dry-run unless --apply is present. Run check-backup before restoring a backup.`;
async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    home: { type: "string" }, host: { type: "string" }, port: { type: "string" }, email: { type: "string" },
    role: { type: "string" }, to: { type: "string" }, from: { type: "string" }, authors: { type: "string" },
    "unmapped-to": { type: "string" }, apply: { type: "boolean" }, help: { type: "boolean" },
    "all-proposed": { type: "boolean" }, source: { type: "string" }, "feeds-interval-hours": { type: "string" },
    "tls-cert": { type: "string" }, "tls-key": { type: "string" }, "trust-proxy": { type: "boolean" },
    "client-id": { type: "string" }, sandbox: { type: "boolean" }, "redirect-uri": { type: "string" },
  } });
  const [command, ...args] = positionals;
  if (!command || values.help) { console.log(HELP); return; }
  const rawHome = values.home ?? process.env.GAID_HUB_SERVER_HOME ?? join(homedir(), ".geoaidesk-hub");
  const home = rawHome === "~" ? homedir() : rawHome.startsWith("~/") ? join(homedir(), rawHome.slice(2)) : rawHome;
  if (command === "check-backup") {
    if (args.length !== 1) throw new Error("Usage: check-backup DIR");
    console.log(JSON.stringify(checkBackup(args[0]), null, 2)); return;
  }
  if (args.length && command !== "feeds" && command !== "orcid-client") throw new Error("Unexpected positional arguments");
  if (command === "orcid-client") { await orcidClientCommand(home, args, values); return; }
  if (command === "serve") {
    const port = Number(values.port ?? 8700);
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error("Port must be 1–65535");
    const host = values.host ?? "0.0.0.0";
    const certFile = values["tls-cert"] ?? process.env.GAID_HUB_SERVER_TLS_CERT?.trim() ?? "";
    const keyFile = values["tls-key"] ?? process.env.GAID_HUB_SERVER_TLS_KEY?.trim() ?? "";
    if (Boolean(certFile) !== Boolean(keyFile)) throw new Error("Give both --tls-cert and --tls-key (or neither)");
    const https = certFile ? { cert: readFileSync(certFile), key: readFileSync(keyFile) } : undefined;
    const app = buildHubServer({ home, https, trustProxy: values["trust-proxy"], feedsIntervalHours: intervalHours(values["feeds-interval-hours"]) });
    const scheme = https ? "https" : "http";
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
      void app.close().then(() => { process.exitCode = 0; }).catch((e: Error) => { console.error(e.message); process.exitCode = 1; });
    });
    try { await app.listen({ host, port }); }
    catch (e) { await app.close(); throw e; }
    console.log(`GAID hub server ${app.hub.server.serverId}\nHome: ${app.hub.home}`);
    if (["0.0.0.0", "::"].includes(host)) {
      const ips = Object.values(networkInterfaces()).flatMap((entries) => entries ?? []).filter((e) => e.family === "IPv4" && !e.internal).map((e) => e.address);
      for (const ip of ips) console.log(`GAID Settings → hub server URL: ${scheme}://${ip}:${port}`);
      if (!ips.length) console.log(`Listening: ${scheme}://localhost:${port} (set a LAN hostname in researchers' GAIDs)`);
    } else console.log(`GAID Settings → hub server URL: ${scheme}://${host.includes(":") ? `[${host}]` : host}:${port}`);
    console.log(https ? "HTTPS only: researchers' GAIDs need the issuing CA unless it is publicly trusted (GAID_HUB_SERVER_CA)."
      : "Plain HTTP: credentials, tokens, Workflows and synced PDFs cross the LAN unencrypted (pilot setting).");
    return;
  }
  if (!["invite", "users", "backup", "import-hub", "feeds"].includes(command)) throw new Error(HELP);
  const hub = new HubDatabase({ home });
  try {
    if (command === "feeds") {
      const feeds = new HubFeeds(hub);
      const [operation, ...ids] = args;
      const actor = { id: "operator", name: "operator (CLI)", device: "CLI" };
      try {
        if (operation === "list" && !ids.length) console.log(JSON.stringify({ sources: feeds.sources() }, null, 2));
        else if (operation === "approve" && ((ids.length > 0 && !values["all-proposed"]) || (!ids.length && values["all-proposed"]))) {
          const targets = values["all-proposed"] ? feeds.sources().filter((s) => s.state === "proposed").map((s) => s.id) : ids;
          console.log(JSON.stringify({ sources: targets.map((id) => feeds.decide(id, { state: "approved" }, actor)) }, null, 2));
        } else if (operation === "stop" && ids.length === 1) console.log(JSON.stringify({ source: feeds.decide(ids[0], { state: "stopped" }, actor) }, null, 2));
        else if (operation === "fetch" && !ids.length) console.log(JSON.stringify(await feeds.fetch(values.source ? { sourceId: values.source } : {}), null, 2));
        else throw new Error("Usage: feeds list | approve ID...|--all-proposed | stop ID | fetch [--source ID]");
      } finally { await feeds.close(); }
      return;
    }
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
/** The secret is read from standard input (hidden at a terminal), never from arguments, files in Git or the environment. */
async function orcidClientCommand(home: string, args: string[], values: { "client-id"?: string; sandbox?: boolean; "redirect-uri"?: string }) {
  const [operation, ...rest] = args;
  if (rest.length) throw new Error("Usage: orcid-client set|show|clear");
  new HubDatabase({ home }).close(); // creates/validates the home like every other command
  if (operation === "show") {
    const c = readOrcidClient(dataHome(home));
    console.log(JSON.stringify(c ? { environment: c.environment, clientId: c.clientId, redirectUri: c.redirectUri, updatedAt: c.updatedAt, secret: "(stored)" } : { configured: false }, null, 2));
  } else if (operation === "clear") {
    console.log(JSON.stringify({ removed: removeOrcidClient(dataHome(home)) }));
  } else if (operation === "set") {
    if (!values["client-id"]) throw new Error("Usage: orcid-client set --client-id APP-… [--sandbox] [--redirect-uri URL]");
    const secret = await readSecret("ORCID Client secret: ");
    const view = writeOrcidClient(dataHome(home), { environment: values.sandbox ? "sandbox" : "production", clientId: values["client-id"],
      clientSecret: secret, ...(values["redirect-uri"] ? { redirectUri: values["redirect-uri"] } : {}) });
    console.log(JSON.stringify({ ...view, secret: "(stored)" }, null, 2));
    console.log("Restart is not needed; the hub reads this file on each ORCID request.");
  } else throw new Error("Usage: orcid-client set|show|clear");
}
async function readSecret(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) { let data = ""; for await (const chunk of input) data += chunk; return data.split(/\r?\n/)[0] ?? ""; }
  process.stderr.write(prompt);
  input.setRawMode(true); input.resume(); input.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const done = (out: string | Error) => { input.setRawMode(false); input.pause(); input.off("data", onData); process.stderr.write("\n"); out instanceof Error ? reject(out) : resolve(out); };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(value);
        if (ch === "\u0003") return done(new Error("Cancelled"));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1); else value += ch;
      }
    };
    input.on("data", onData);
  });
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
