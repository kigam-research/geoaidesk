# HTTPS for the institute GAID hub server

The pilot runs the hub server over plain HTTP on the institute LAN (ADR `docs/adr/2026-10-22-gaid-hub-server.md`, user
decision 4 나). Passwords, session tokens, Workflows, skills and synchronized library PDFs then cross the LAN unencrypted.
User decision 2026-10-22 (gaid-backend#2 가): switch to HTTPS before the hub is used beyond the test group. This guide is the
prepared switch. It changes configuration only; stored hub data, accounts, sessions and library versions stay as they are.

Two ways are supported. Both end with researchers' GAIDs using an `https://` hub address.

| Way | Who terminates TLS | Extra software | Use when |
| --- | --- | --- | --- |
| A. Hub server TLS (recommended on PC74) | `node geo/hub-server.mjs serve --tls-cert … --tls-key …` | none | One hub PC, no administrator rights, certificate from an internal CA or from institute IT |
| B. Reverse proxy | nginx, Caddy or the institute's proxy | the proxy | Institute IT already runs a proxy or wants port 443 |

## What has to exist before the switch

1. A server certificate whose subject alternative name matches the address researchers type: the IP address
   (`IP:10.13.15.74` on PC74) or a DNS name issued by institute IT. An IP-address certificate stops matching if the PC's
   address changes; ask IT for a fixed address or a DNS name before widening the trial.
2. Its private key, readable only by the account that runs the service.
3. For a certificate that is not issued by a public CA: the issuing CA certificate (public, no key) for every researcher.
4. Researchers know the new address and that they have to log in once more after changing it.

## A. Hub server TLS

### Certificate from an internal CA (no institute IT involvement)

On the hub PC, outside every Git checkout. The CA key signs certificates; keep it in its own directory with mode 700 and
copy it to offline storage. Replace the IP address with the hub PC's address.

```bash
D=~/data/geoaidesk/hub-server/tls
mkdir -p "$D/ca" && chmod 700 "$D" "$D/ca"
openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=GAID hub CA (PC74)" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -keyout "$D/ca/ca.key" -out "$D/gaid-hub-ca.crt"
openssl req -newkey rsa:3072 -nodes -subj "/CN=10.13.15.74" -keyout "$D/hub.key" -out "$D/hub.csr"
printf 'subjectAltName=IP:10.13.15.74\nextendedKeyUsage=serverAuth\n' > "$D/hub.ext"
openssl x509 -req -in "$D/hub.csr" -CA "$D/gaid-hub-ca.crt" -CAkey "$D/ca/ca.key" -CAcreateserial \
  -days 825 -extfile "$D/hub.ext" -out "$D/hub.crt"
chmod 600 "$D/hub.key" "$D/ca/ca.key"
openssl verify -CAfile "$D/gaid-hub-ca.crt" "$D/hub.crt"
```

`gaid-hub-ca.crt` is the file researchers receive. `hub.crt` and `hub.key` stay on the hub PC. Renew `hub.crt` before it
expires (825 days) with the last two `openssl` commands and restart the service.

### Certificate from institute IT

Ask for a server certificate (PEM, with the full chain if there are intermediate CAs) for the hub's DNS name or fixed IP
address, and its key. If the chain ends in a publicly trusted CA, researchers need no CA file. Otherwise ask IT for the
root CA certificate and hand it out like `gaid-hub-ca.crt` above.

### Turn it on

1. Make and check a backup (`backup --to`, `check-backup`; see `docs/geo/hub-server.md`).
2. Add the certificate options to the service and restart it. On PC74 edit `~/.config/systemd/user/gaid-hub-server.service`:

   ```ini
   ExecStart=%h/.local/bin/node geo/hub-server.mjs serve --host 0.0.0.0 --port 8700 \
     --tls-cert %h/data/geoaidesk/hub-server/tls/hub.crt --tls-key %h/data/geoaidesk/hub-server/tls/hub.key
   ```

   then `systemctl --user daemon-reload && systemctl --user restart gaid-hub-server`. The same options can come from
   `GAID_HUB_SERVER_TLS_CERT` and `GAID_HUB_SERVER_TLS_KEY`. With TLS on, the port serves HTTPS only; plain HTTP requests to
   it fail, so there is no unencrypted fallback.
3. Check from the hub PC: `curl --cacert ~/data/geoaidesk/hub-server/tls/gaid-hub-ca.crt https://10.13.15.74:8700/hub/v1/health`
   returns the same `serverId` as before.
4. Every researcher, on each PC that runs GAID:
   1. Saves `gaid-hub-ca.crt` somewhere outside the GAID program folder, for example `~/.geoaidesk/gaid-hub-ca.crt`
      (Windows: `%USERPROFILE%\.geoaidesk\gaid-hub-ca.crt`). Skip this for a publicly trusted certificate.
   2. Adds one line to `<GAID_HOME>/config.env` (default `~/.geoaidesk/config.env`):
      `GAID_HUB_SERVER_CA=/home/<user>/.geoaidesk/gaid-hub-ca.crt` (Windows: the full path with backslashes).
   3. Restarts GAID (the setting is read at start).
   4. Settings → 서비스 → 기관 GAID 허브: changes the address to `https://10.13.15.74:8700` and logs in again. The card then
      says the connection uses HTTPS.

   A deployment that fixes the address with `GAID_HUB_SERVER_URL` changes that variable instead of step 4.4's address field.

`GAID_HUB_SERVER_CA` applies to hub requests only. Those requests trust exactly that CA and connect directly, without the
`HTTP_PROXY`/`HTTPS_PROXY` dispatcher; model providers and other traffic are unchanged. Without the variable, GAID uses
Node's built-in public roots, so an internal-CA certificate is refused ("허브 서버에 연결하지 못했습니다").

Library sync state, accounts and Workflow/skill records are keyed by the hub's `serverId`, which does not change, so nothing
is synchronized again from scratch. Researchers who have not switched simply cannot reach the hub until they do.

### Roll back

Remove the two options from `ExecStart`, reload and restart. Researchers change the address back to `http://…` and log in.

## B. Reverse proxy

Run the hub on loopback only and let the proxy terminate TLS:

```bash
node geo/hub-server.mjs serve --host 127.0.0.1 --port 8700 --trust-proxy
```

`--trust-proxy` makes the hub take the client address from `X-Forwarded-For` set by a proxy on the same PC (loopback
only). Without it every researcher appears as `127.0.0.1` and shares one failed-login limit. The proxy must not add
`Origin` or `Sec-Fetch-Site` headers (the hub refuses browser requests), must allow request bodies of 64 MiB (library PDFs)
and long uploads, and must not cache responses. A minimal nginx server block:

```nginx
server {
  listen 443 ssl;
  server_name gaid-hub.example.kigam.re.kr;
  ssl_certificate     /etc/ssl/gaid-hub/fullchain.pem;
  ssl_certificate_key /etc/ssl/gaid-hub/privkey.pem;
  client_max_body_size 70m;
  proxy_read_timeout 180s;
  location /hub/v1/ {
    proxy_pass http://127.0.0.1:8700;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_request_buffering off;
  }
}
```

Researchers then follow step 4 of way A with the proxy's address (`https://gaid-hub.example.kigam.re.kr`).

## Not covered

- Mutual TLS or client certificates.
- Automatic certificate renewal (ACME) for an internal address.
- Encryption of the hub's data at rest; protect `~/data/geoaidesk/hub-server/` and its backups as private research data.
