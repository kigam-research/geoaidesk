/**
 * HTTPS to a hub server whose certificate comes from an institute-internal CA: the hub server's own TLS (`serve --tls-cert
 * --tls-key`) and GAID_HUB_SERVER_CA on the GAID side. Also: behind a loopback reverse proxy (`--trust-proxy`) failed-login
 * limits count per forwarded client address. Needs openssl for the TLS part.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConnectionStore } from "../src/geo/hub-client/connection.ts";
import { HubClient, hubTransport } from "../src/geo/hub-client/client.ts";
import { buildHubServer, type HubServerApp } from "../src/geo/hub-server/index.ts";

let openssl = true;
try { execFileSync("openssl", ["version"], { stdio: "ignore" }); } catch { openssl = false; }

describe.skipIf(!openssl)("hub client over HTTPS with an internal CA", () => {
  let dir = "", server: HubServerApp, url = "";
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "hub-tls-"));
    const run = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
    run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=GAID test CA", "-keyout", "ca.key.txt", "-out", "ca.crt.txt",
      "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
    run("req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=127.0.0.1", "-keyout", "hub.key.txt", "-out", "hub.csr.txt");
    writeFileSync(join(dir, "ext.txt"), "subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n");
    run("x509", "-req", "-in", "hub.csr.txt", "-CA", "ca.crt.txt", "-CAkey", "ca.key.txt", "-CAcreateserial", "-days", "1", "-extfile", "ext.txt", "-out", "hub.crt.txt");
    server = buildHubServer({ home: join(dir, "hub-home"), https: { key: readFileSync(join(dir, "hub.key.txt")), cert: readFileSync(join(dir, "hub.crt.txt")) } });
    await server.listen({ host: "127.0.0.1", port: 0 });
    url = `https://127.0.0.1:${(server.server.address() as { port: number }).port}`;
  });
  afterAll(async () => {
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const client = async (env: NodeJS.ProcessEnv) => {
    const connection = new ConnectionStore(join(dir, `agent-${Math.random()}`), () => url);
    await connection.load();
    return new HubClient(connection, hubTransport(env));
  };

  it("trusts the configured CA file and logs in over HTTPS", async () => {
    const c = await client({ GAID_HUB_SERVER_CA: join(dir, "ca.crt.txt") });
    expect((await c.health()).serverId).toBe(server.hub.server.serverId);
    const invite = server.accounts.invite({ email: "tls@example.org", role: "admin" });
    const status = await c.login("/auth/invites/accept", { code: invite.code, displayName: "TLS", password: "correct horse 1" });
    expect(status).toMatchObject({ url, account: { email: "tls@example.org" } });
  });
  it("serves HTTPS only on the TLS port", async () => {
    await expect(fetch(`${url.replace("https:", "http:")}/hub/v1/health`)).rejects.toThrow();
  });
  it("refuses the certificate without the CA, and names a missing CA file", async () => {
    await expect((await client({})).health()).rejects.toMatchObject({ status: 502 });
    await expect((await client({ GAID_HUB_SERVER_CA: join(dir, "missing.pem") })).health()).rejects.toThrow("GAID_HUB_SERVER_CA");
  });
});

describe("hub server behind a loopback reverse proxy", () => {
  it("counts failed logins per forwarded client address only with --trust-proxy", async () => {
    for (const trustProxy of [true, false]) {
      const home = mkdtempSync(join(tmpdir(), "hub-proxy-"));
      const app = buildHubServer({ home, trustProxy });
      try {
        const login = (ip: string, n: number) => app.inject({ method: "POST", url: "/hub/v1/auth/login", remoteAddress: "127.0.0.1",
          headers: { "x-forwarded-for": ip }, payload: { email: `nobody${n}@example.org`, password: "wrong password 1" } });
        for (let n = 0; n < 10; n++) expect((await login("10.0.0.1", n)).statusCode).toBe(401);
        expect((await login("10.0.0.1", 99)).statusCode).toBe(429);
        expect((await login("10.0.0.2", 100)).statusCode).toBe(trustProxy ? 401 : 429);
      } finally {
        await app.close();
        rmSync(home, { recursive: true, force: true });
      }
    }
  });
});
