"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HUB_ACCOUNT_RULES, type HubAccount, type HubInvite, type HubRole } from "@/geo/contracts/hub-server";
import { hubServer, HubServerError } from "./api";
import { dateLabel, ErrorNotice, Field, fieldClass, text } from "./parts";
import { FeedSourcesAdmin } from "@/geo/hub-feeds/admin-sources";

export function AdminSettings({ onAccountChange }: { onAccountChange: () => void }) {
  const [view, setView] = useState<"users" | "invites" | "feeds">("users");
  const [users, setUsers] = useState<HubAccount[]>([]);
  const [invites, setInvites] = useState<HubInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<HubRole>("member");
  const [created, setCreated] = useState<HubInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [lastAdmin, setLastAdmin] = useState(false);
  const load = useCallback(async () => {
    const [u, i] = await Promise.all([hubServer.users(), hubServer.invites()]);
    setUsers(u.users); setInvites(i.invites);
  }, []);
  useEffect(() => { let live = true; load().catch(e => live && setError(e)).finally(() => live && setBusy(false)); return () => { live = false; }; }, [load]);
  const run = async (action: () => Promise<unknown>, userChange = false) => {
    setBusy(true); setError(null); setLastAdmin(false);
    try {
      await action();
      if (userChange) onAccountChange();
      try { await load(); }
      catch (e) {
        // Successfully changing one's own role/disabled state may remove admin access immediately.
        if (!(userChange && e instanceof HubServerError && (e.status === 403 || e.status === 401))) throw e;
      }
    }
    catch (e) { setError(e); setLastAdmin(userChange && e instanceof HubServerError && e.status === 409); }
    finally { setBusy(false); }
  };
  return <div className="mt-4 flex flex-col gap-4">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="gaid-seg flex w-fit gap-1" role="group" aria-label={text("admin.title")}>
        {(["users", "invites", "feeds"] as const).map(value => <Button key={value} type="button" variant="ghost" disabled={busy} aria-pressed={view === value}
          className={view === value ? "bg-gaid-signal-tint font-semibold text-gaid-signal-ink" : "text-gaid-ink-2"}
          onClick={() => setView(value)}>{text(`admin.${value}.title`)}</Button>)}
      </div>
      {view !== "feeds" && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(load)}>{text("refresh.button")}</Button>}
    </div>
    <ErrorNotice error={error} fallback={lastAdmin ? "admin.lastAdmin" : "admin.failed"} />
    {busy && <p role="status" className="text-[13px] text-gaid-ink-2">{text("working")}</p>}
    {view === "feeds" ? <FeedSourcesAdmin /> : view === "users" ? <ul className="divide-y divide-gaid-edge">
      {users.map(user => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-words font-medium">{user.displayName}</p><p className="break-all text-[13px] text-gaid-ink-2">{text("accountLine", { email: user.email, role: text(`role.${user.role}`) })}</p>
          {user.disabledAt && <p className="text-[13px] text-gaid-danger">{text("admin.disabled")}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => hubServer.updateUser(user.id, { role: user.role === "admin" ? "member" : "admin" }), true)}>{text(user.role === "admin" ? "admin.makeMember.button" : "admin.makeAdmin.button")}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => hubServer.updateUser(user.id, { disabled: !user.disabledAt }), true)}>{text(user.disabledAt ? "admin.enable.button" : "admin.disable.button")}</Button>
        </div>
      </li>)}
      {!busy && !users.length && <li className="text-[13px] text-gaid-ink-2">{text("admin.users.empty")}</li>}
    </ul> : <>
      <form onSubmit={event => { event.preventDefault(); void run(async () => { const invite = await hubServer.invite({ email: email.trim(), role }); setCreated(invite); setCopied(false); setEmail(""); }); }}>
        <fieldset disabled={busy} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1"><Field label="email" type="email" required maxLength={HUB_ACCOUNT_RULES.email.max} value={email} onChange={e => setEmail(e.target.value)} /></div>
          <label className="flex flex-col gap-1.5 text-[13px] text-gaid-ink-2">{text("role.title")}<select className={fieldClass} value={role} onChange={e => setRole(e.target.value as HubRole)}><option value="member">{text("role.member")}</option><option value="admin">{text("role.admin")}</option></select></label>
          <Button type="submit">{text("invite.create.button")}</Button>
        </fieldset>
      </form>
      {created?.code && <div className="flex flex-col gap-2 border border-gaid-edge bg-gaid-face-2 p-3" role="status">
        <p className="text-[13px]">{text("invite.once")}</p><p className="break-all font-mono text-[15px]">{created.code}</p>
        <p className="text-[13px] text-gaid-ink-2">{text("invite.expires", { when: dateLabel(created.expiresAt) })}</p>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(created.code!); setCopied(true); } catch (e) { setError(e); } }}>{text(copied ? "invite.copied" : "invite.copy.button")}</Button><Button type="button" variant="ghost" onClick={() => setCreated(null)}>{text("invite.hide.button")}</Button></div>
      </div>}
      <ul className="divide-y divide-gaid-edge">
        {invites.map(invite => <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="break-all text-[15px]">{text("accountLine", { email: invite.email, role: text(`role.${invite.role}`) })}</p><p className="text-[13px] text-gaid-ink-2">{invite.usedAt ? text("invite.used") : text("invite.expires", { when: dateLabel(invite.expiresAt) })}</p></div>
          {!invite.usedAt && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(async () => { await hubServer.revoke(invite.id); if (created?.id === invite.id) setCreated(null); })}>{text("invite.revoke.button")}</Button>}
        </li>)}
        {!busy && !invites.length && <li className="text-[13px] text-gaid-ink-2">{text("admin.invites.empty")}</li>}
      </ul>
    </>}
  </div>;
}
