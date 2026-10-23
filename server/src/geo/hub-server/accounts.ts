import { scrypt, timingSafeEqual } from "node:crypto";
import { HUB_ACCOUNT_RULES as RULES } from "../../../../web/src/geo/contracts/hub-server.ts";
import type { HubAccount, HubInvite, HubInviteBody, HubUpdateMeBody, HubUpdateUserBody } from "./protocol.ts";
import { HubDatabase, HubServerError, object, sha256, text, type AuditActor } from "./core.ts";
import { linkView, type OrcidRow } from "./orcid.ts";

interface AccountRow {
  id: string; email: string; display_name: string; role: "member" | "admin";
  password: string; created_at: string; disabled_at: string | null;
}
interface InviteRow {
  id: string; email: string; role: "member" | "admin"; created_by: string; created_at: string;
  expires_at: string; used_at: string | null; code_sha256: string;
}
interface PasswordHash { N: number; r: number; p: number; salt: string; hash: string }
export interface Authenticated extends AuditActor { account: HubAccount; tokenHash: string }
const baseView = (r: AccountRow, orcid?: OrcidRow): HubAccount => ({ id: r.id, email: r.email, displayName: r.display_name,
  role: r.role, createdAt: r.created_at, ...(r.disabled_at ? { disabledAt: r.disabled_at } : {}), ...(orcid ? { orcid: linkView(orcid) } : {}) });
const inviteView = (r: InviteRow): HubInvite => ({ id: r.id, email: r.email, role: r.role, createdBy: r.created_by,
  createdAt: r.created_at, expiresAt: r.expires_at, ...(r.used_at ? { usedAt: r.used_at } : {}) });
const afterDays = (at: string, days: number) => new Date(Date.parse(at) + days * 86_400_000).toISOString();
function emailValue(value: unknown): string {
  const email = text(value, "이메일", RULES.email.max).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HubServerError("이메일 주소를 확인해 주세요.");
  return email;
}
function displayName(value: unknown): string {
  const name = text(value, "표시 이름", RULES.displayName.max);
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new HubServerError("표시 이름을 확인해 주세요.");
  return name;
}
function passwordValue(value: unknown): string {
  if (typeof value !== "string" || [...value].length < RULES.password.min || [...value].length > RULES.password.max)
    throw new HubServerError(`비밀번호는 ${RULES.password.min}~${RULES.password.max}자로 입력하세요.`);
  return value;
}
function roleValue(value: unknown): "member" | "admin" {
  if (value !== "member" && value !== "admin") throw new HubServerError("계정 역할을 확인해 주세요.");
  return value;
}
async function derive(password: string, params: Omit<PasswordHash, "hash">): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, Buffer.from(params.salt, "hex"), 64,
    { N: params.N, r: params.r, p: params.p, maxmem: 64 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}
async function hashPassword(password: string, db: HubDatabase): Promise<string> {
  const params = { N: 16384, r: 8, p: 1, salt: db.random(16).toString("hex") };
  return JSON.stringify({ ...params, hash: (await derive(password, params)).toString("hex") });
}
const DUMMY: PasswordHash = { N: 16384, r: 8, p: 1, salt: "00".repeat(16), hash: "00".repeat(64) };
async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const params = stored ? JSON.parse(stored) as PasswordHash : DUMMY;
  const result = await derive(password, params);
  const expected = Buffer.from(params.hash, "hex");
  return expected.length === result.length && timingSafeEqual(expected, result) && stored !== undefined;
}

export class HubAccounts {
  constructor(readonly hub: HubDatabase) {}
  private readonly accountView = (r: AccountRow): HubAccount =>
    baseView(r, this.hub.get<OrcidRow>("SELECT * FROM account_orcid WHERE account_id=?", r.id));
  users(): HubAccount[] { return this.hub.all<AccountRow>("SELECT * FROM accounts ORDER BY created_at,id").map(this.accountView); }
  invites(): HubInvite[] { return this.hub.all<InviteRow>("SELECT * FROM invites ORDER BY created_at DESC,id").map(inviteView); }
  account(id: string): AccountRow {
    const row = this.hub.get<AccountRow>("SELECT * FROM accounts WHERE id=?", id);
    if (!row) throw new HubServerError("계정을 찾을 수 없습니다.", 404);
    return row;
  }
  byEmail(email: string): HubAccount | null {
    const row = this.hub.get<AccountRow>("SELECT * FROM accounts WHERE email=?", emailValue(email));
    return row ? this.accountView(row) : null;
  }
  invite(body: HubInviteBody, actor: AuditActor = { id: "operator", device: "CLI" }): HubInvite {
    const email = emailValue(body?.email);
    const role = roleValue(body?.role);
    return this.hub.tx(() => {
      if (this.hub.get("SELECT id FROM accounts WHERE email=?", email)) throw new HubServerError("이미 등록된 이메일입니다.", 409);
      const code = this.hub.random(32).toString("base64url");
      const row: InviteRow = { id: this.hub.id("inv"), email, role, created_by: actor.id, created_at: this.hub.now(),
        expires_at: afterDays(this.hub.now(), RULES.inviteDays), used_at: null, code_sha256: sha256(code) };
      this.hub.run("INSERT INTO invites (id,code_sha256,email,role,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
        row.id, row.code_sha256, email, role, row.created_by, row.created_at, row.expires_at);
      this.hub.audit(actor, "invite.create", row.id, { email, role });
      return { ...inviteView(row), code };
    });
  }
  revokeInvite(id: string, actor: AuditActor) {
    this.hub.tx(() => {
      const row = this.hub.get<InviteRow>("SELECT * FROM invites WHERE id=?", id);
      if (!row) throw new HubServerError("초대를 찾을 수 없습니다.", 404);
      if (row.used_at) throw new HubServerError("이미 사용한 초대는 취소할 수 없습니다.", 409);
      this.hub.run("DELETE FROM invites WHERE id=?", id);
      this.hub.audit(actor, "invite.revoke", id);
    });
  }
  async accept(body: { code: string; displayName: string; password: string; device?: string }) {
    const code = text(body?.code, "초대 코드", 128);
    const name = displayName(body?.displayName);
    const password = passwordValue(body?.password);
    const device = text(body?.device ?? "", "기기 이름", 120, true);
    const codeHash = sha256(code);
    const check = () => {
      const invite = this.hub.get<InviteRow>("SELECT * FROM invites WHERE code_sha256=?", codeHash);
      if (!invite) throw new HubServerError("초대 코드를 찾을 수 없습니다.", 404);
      if (invite.used_at || invite.expires_at <= this.hub.now()) throw new HubServerError("이미 사용했거나 만료된 초대입니다.", 410);
      if (this.hub.get("SELECT id FROM accounts WHERE email=?", invite.email)) throw new HubServerError("이미 등록된 이메일입니다.", 409);
      return invite;
    };
    check();
    const encoded = await hashPassword(password, this.hub);
    return this.hub.tx(() => {
      const invite = check(); // Recheck after scrypt: the code is single-use even on concurrent requests.
      const id = this.hub.id("acc");
      const at = this.hub.now();
      this.hub.run("INSERT INTO accounts VALUES (?,?,?,?,?,?,NULL)", id, invite.email, name, invite.role, encoded, at);
      this.hub.run("UPDATE invites SET used_at=?,account_id=? WHERE id=?", at, id, invite.id);
      this.hub.audit({ id, device }, "invite.accept", invite.id);
      return this.newSession(this.account(id), device);
    });
  }
  private newSession(row: AccountRow, device: string) {
    const token = this.hub.random(32).toString("base64url");
    const at = this.hub.now();
    const expiresAt = afterDays(at, RULES.sessionDays);
    this.hub.run("INSERT INTO sessions VALUES (?,?,?,?,?,?)", sha256(token), row.id, device, at, at, expiresAt);
    this.hub.audit({ id: row.id, device }, "session.create", row.id);
    return { token, expiresAt, account: this.accountView(row) };
  }
  async login(body: { email: string; password: string; device?: string }, ip: string) {
    const email = emailValue(body?.email);
    // Do not apply the new-password minimum to login (invalid credentials still receive 401).
    if (typeof body?.password !== "string" || body.password.length > 800) throw new HubServerError("이메일 또는 비밀번호가 맞지 않습니다.", 401);
    const device = text(body.device ?? "", "기기 이름", 120, true);
    const limit = () => {
      const since = new Date(Date.parse(this.hub.now()) - 15 * 60_000).toISOString();
      this.hub.run("DELETE FROM login_failures WHERE at<?", since);
      const emailCount = this.hub.get<{ n: number }>("SELECT COUNT(*) AS n FROM login_failures WHERE email=?", email)!.n;
      const ipCount = this.hub.get<{ n: number }>("SELECT COUNT(*) AS n FROM login_failures WHERE ip=?", ip)!.n;
      if (emailCount >= 10 || ipCount >= 10) throw new HubServerError("로그인 시도가 많습니다. 15분 뒤 다시 시도하세요.", 429);
    };
    limit();
    const row = this.hub.get<AccountRow>("SELECT * FROM accounts WHERE email=?", email);
    const matches = await verifyPassword(body.password, row?.password);
    return this.hub.tx(() => {
      limit();
      const current = row ? this.account(row.id) : undefined;
      if (!matches || !current || current.password !== row!.password) {
        this.hub.run("INSERT INTO login_failures VALUES (?,?,?)", email, ip, this.hub.now());
        this.hub.audit({ id: row?.id ?? "anonymous", device }, "session.denied", email);
        // Return an error value so the failed-attempt counter commits.
        return new HubServerError("이메일 또는 비밀번호가 맞지 않습니다.", 401);
      }
      if (current.disabled_at) return new HubServerError("사용 중지된 계정입니다. 관리자에게 문의하세요.", 403);
      this.hub.run("DELETE FROM login_failures WHERE email=?", email);
      return this.newSession(current, device);
    });
  }
  authenticate(authorization: unknown): Authenticated {
    if (typeof authorization !== "string" || !/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))
      throw new HubServerError("허브 서버에 로그인하세요.", 401);
    const tokenHash = sha256(authorization.slice(7));
    const session = this.hub.get<{ account_id: string; device: string; last_used: string; expires_at: string }>(
      "SELECT * FROM sessions WHERE token_sha256=?", tokenHash);
    if (!session) throw new HubServerError("로그인이 만료되었습니다. 다시 로그인하세요.", 401);
    const row = this.account(session.account_id);
    if (session.expires_at <= this.hub.now() || row.disabled_at) {
      this.hub.tx(() => {
        this.hub.run("DELETE FROM sessions WHERE token_sha256=?", tokenHash);
        this.hub.audit({ id: row.id, device: session.device }, "session.expire", row.id);
      });
      throw new HubServerError(row.disabled_at ? "사용 중지된 계정입니다." : "로그인이 만료되었습니다. 다시 로그인하세요.", row.disabled_at ? 403 : 401);
    }
    if (Date.parse(this.hub.now()) - Date.parse(session.last_used) >= 60_000) this.hub.tx(() => {
      this.hub.run("UPDATE sessions SET last_used=?,expires_at=? WHERE token_sha256=?", this.hub.now(), afterDays(this.hub.now(), RULES.sessionDays), tokenHash);
      this.hub.audit({ id: row.id, device: session.device }, "session.touch", row.id);
    });
    return { id: row.id, device: session.device, tokenHash, account: this.accountView(row) };
  }
  logout(auth: Authenticated) {
    this.hub.tx(() => {
      this.hub.run("DELETE FROM sessions WHERE token_sha256=?", auth.tokenHash);
      this.hub.audit(auth, "session.logout", auth.id);
    });
  }
  async updateMe(auth: Authenticated, body: HubUpdateMeBody) {
    if (!object(body) || Object.keys(body).some((key) => !["displayName", "password"].includes(key)))
      throw new HubServerError("변경할 계정 정보를 확인해 주세요.");
    const before = this.account(auth.id);
    const name = body.displayName === undefined ? before.display_name : displayName(body.displayName);
    let encoded = before.password;
    if (body.password !== undefined) {
      if (!object(body.password) || typeof body.password.current !== "string" || body.password.current.length > 800 ||
          !(await verifyPassword(body.password.current, before.password))) throw new HubServerError("현재 비밀번호가 맞지 않습니다.", 403);
      encoded = await hashPassword(passwordValue(body.password.next), this.hub);
    }
    return this.hub.tx(() => {
      const current = this.account(auth.id);
      if (current.disabled_at || current.password !== before.password ||
          !this.hub.get("SELECT token_sha256 FROM sessions WHERE token_sha256=?", auth.tokenHash))
        throw new HubServerError("계정 상태가 바뀌었습니다. 다시 로그인하세요.", 401);
      this.hub.run("UPDATE accounts SET display_name=?,password=? WHERE id=?", name, encoded, auth.id);
      if (body.password) this.hub.run("DELETE FROM sessions WHERE account_id=? AND token_sha256<>?", auth.id, auth.tokenHash);
      this.hub.audit(auth, "account.update", auth.id, { displayName: name, passwordChanged: Boolean(body.password) });
      return this.accountView(this.account(auth.id));
    });
  }
  updateUser(id: string, body: HubUpdateUserBody, actor: AuditActor): HubAccount {
    if (!object(body) || Object.keys(body).some((key) => !["role", "disabled"].includes(key)) ||
        (body.disabled !== undefined && typeof body.disabled !== "boolean")) throw new HubServerError("계정 상태를 확인해 주세요.");
    const role = body.role === undefined ? undefined : roleValue(body.role);
    return this.hub.tx(() => {
      const old = this.account(id);
      const nextRole = role ?? old.role;
      const disabled = body.disabled === undefined ? Boolean(old.disabled_at) : body.disabled;
      if (old.role === "admin" && !old.disabled_at && (nextRole !== "admin" || disabled) &&
          this.hub.get<{ n: number }>("SELECT COUNT(*) AS n FROM accounts WHERE role='admin' AND disabled_at IS NULL")!.n <= 1)
        throw new HubServerError("마지막 관리자는 사용 중지하거나 일반 연구자로 바꿀 수 없습니다.", 409);
      this.hub.run("UPDATE accounts SET role=?,disabled_at=? WHERE id=?", nextRole, disabled ? (old.disabled_at ?? this.hub.now()) : null, id);
      if (disabled) this.hub.run("DELETE FROM sessions WHERE account_id=?", id);
      this.hub.audit(actor, "account.admin-update", id, { role: nextRole, disabled });
      return this.accountView(this.account(id));
    });
  }
}
