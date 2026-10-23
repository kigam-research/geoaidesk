"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HUB_ACCOUNT_RULES, type HubAccount, type HubServerStatus } from "@/geo/contracts/hub-server";
import { OrcidId } from "@/geo/orcid/id-display";
import { hubServer } from "./api";
import { Field, text } from "./parts";

export function AccountSettings({ account, busy, run }: { account: HubAccount; busy: boolean; run: (action: () => Promise<HubServerStatus>) => Promise<boolean> }) {
  const [edit, setEdit] = useState<"name" | "password" | null>(null);
  const [name, setName] = useState(account.displayName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const close = () => { setEdit(null); setCurrent(""); setNext(""); setConfirm(""); setMismatch(false); };
  return <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="break-words font-semibold">{account.displayName}</p><p className="break-all text-[13px] text-gaid-ink-2">{text("accountLine", { email: account.email, role: text(`role.${account.role}`) })}</p></div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void run(hubServer.logout)}>{text("logout.button")}</Button>
    </div>
    {account.orcid && <OrcidId id={account.orcid.id} environment={account.orcid.environment} authenticated />}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={busy} onClick={() => { close(); setName(account.displayName); setEdit("name"); }}>{text("changeName.button")}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => { close(); setEdit("password"); }}>{text("changePassword.button")}</Button>
    </div>
    {edit && <form className="max-w-lg" onSubmit={async event => {
      event.preventDefault();
      if (edit === "password" && next !== confirm) { setMismatch(true); return; }
      if (await run(() => hubServer.update(edit === "name" ? { displayName: name.trim() } : { password: { current, next } }))) close();
    }}><fieldset disabled={busy} className="flex flex-col gap-3">
      {edit === "name" ? <Field label="displayName" required maxLength={HUB_ACCOUNT_RULES.displayName.max} value={name} onChange={e => setName(e.target.value)} /> : <>
        <Field label="currentPassword" type="password" required maxLength={HUB_ACCOUNT_RULES.password.max} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
        <Field label="newPassword" type="password" required minLength={HUB_ACCOUNT_RULES.password.min} maxLength={HUB_ACCOUNT_RULES.password.max} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
        <p className="text-[13px] text-gaid-ink-2">{text("passwordRule", { min: HUB_ACCOUNT_RULES.password.min, max: HUB_ACCOUNT_RULES.password.max })}</p>
        <Field label="confirmPassword" type="password" required maxLength={HUB_ACCOUNT_RULES.password.max} autoComplete="new-password" value={confirm} aria-invalid={mismatch} onChange={e => { setConfirm(e.target.value); setMismatch(false); }} />
        {mismatch && <p role="alert" className="text-[13px] text-gaid-danger">{text("passwordMismatch")}</p>}
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{text("cancel.button")}</Button><Button type="submit">{text(busy ? "working" : "saveAccount.button")}</Button></div>
    </fieldset></form>}
  </div>;
}
