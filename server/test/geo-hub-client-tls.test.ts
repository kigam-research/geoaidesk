/** HTTPS to a hub server whose certificate comes from an institute-internal CA (GAID_HUB_SERVER_CA). Needs openssl. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { HubClient, hubTransport } from "../src/geo/hub-client/client.ts";

let openssl = true;
try { execFileSync("openssl", ["version"], { stdio: "ignore" }); } catch { openssl = false; }

describe.skipIf(!openssl)("hub client over HTTPS with an internal CA", () => {
  let dir = "", server: Server, url = "";
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "hub-tls-"));
    const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
    run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=GAID test CA", "-keyout", "ca.key.txt", "-out", "ca.crt.txt",
      "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
    run("req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=127.0.0.1", "-keyout", "hub.key.txt", "-out", "hub.csr.txt");
    writeFileSync(join(dir, "ext.txt"), "subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n");
    run("x509", "-req", "-in", "hub.csr.txt", "-CA", "ca.crt.txt", "-CAkey", "ca.key.txt", "-CAcreateserial", "-days", "1", "-extfile", "ext.txt", "-out", "hub.crt.txt");
    server = createServer({ key: readFileSync(join(dir, "hub.key.txt")), cert: readFileSync(join(dir, "hub.crt.txt")) }, (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(req.url === "/hub/v1/health" ? { schema: "gaid-hub-server/v1", name: "gaid-hub-server", version: "0.1.0", serverId: "hub-tls-test" } : {}));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `https://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  const client = async (env: NodeJS.ProcessEnv) => {
    const connection = new ConnectionStore(join(dir, `agent-${Math.random()}`), () => url);
    await connection.load();
    return new HubClient(connection, hubTransport(env));
  };

  it("trusts the configured CA file", async () => {
    expect((await (await client({ GAID_HUB_SERVER_CA: join(dir, "ca.crt.txt") })).health()).serverId).toBe("hub-tls-test");
  });
  it("refuses the certificate without the CA, and names a missing CA file", async () => {
    await expect((await client({})).health()).rejects.toMatchObject({ status: 502 });
    await expect((await client({ GAID_HUB_SERVER_CA: join(dir, "missing.pem") })).health()).rejects.toThrow("GAID_HUB_SERVER_CA");
  });
});
