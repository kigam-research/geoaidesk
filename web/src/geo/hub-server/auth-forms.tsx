"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { HUB_ACCOUNT_RULES, type HubServerStatus } from "@/geo/contracts/hub-server";
import { hubServer } from "./api";
import { Field, text } from "./parts";

export function AuthForms({ busy, run }: { busy: boolean; run: (action: () => Promise<HubServerStatus>) => Promise<boolean> }) {
  const [mode, setMode] = useState<"login" | "invite">("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "invite" && password !== confirm) { setMismatch(true); return; }
    setMismatch(false);
    if (await run(() => mode === "login" ? hubServer.login(email.trim(), password) : hubServer.accept(code.trim(), name.trim(), password))) {
      setPassword(""); setConfirm(""); setCode("");
    }
  };
  return <div className="flex flex-col gap-4">
    <div role="group" aria-label={text("auth.title")} className="gaid-seg flex w-fit gap-1">
      {(["login", "invite"] as const).map(value => <Button key={value} type="button" variant="ghost" aria-pressed={mode === value} disabled={busy}
        className={mode === value ? "bg-gaid-signal-tint font-semibold text-gaid-signal-ink" : "text-gaid-ink-2"}
        onClick={() => { setMode(value); setPassword(""); setConfirm(""); setMismatch(false); }}>{text(`auth.${value}.title`)}</Button>)}
    </div>
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="flex max-w-lg flex-col gap-3">
        {mode === "login" ? <Field label="email" type="email" required maxLength={HUB_ACCOUNT_RULES.email.max} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /> : <>
          <Field label="invite.code" required autoComplete="off" value={code} onChange={e => setCode(e.target.value)} />
          <Field label="displayName" required maxLength={HUB_ACCOUNT_RULES.displayName.max} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} />
        </>}
        <Field label="password" type="password" required minLength={mode === "invite" ? HUB_ACCOUNT_RULES.password.min : undefined} maxLength={HUB_ACCOUNT_RULES.password.max}
          autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => { setPassword(e.target.value); setMismatch(false); }} />
        {mode === "invite" && <>
          <p className="text-[13px] text-gaid-ink-2">{text("passwordRule", { min: HUB_ACCOUNT_RULES.password.min, max: HUB_ACCOUNT_RULES.password.max })}</p>
          <Field label="confirmPassword" type="password" required autoComplete="new-password" maxLength={HUB_ACCOUNT_RULES.password.max} value={confirm} aria-invalid={mismatch} onChange={e => { setConfirm(e.target.value); setMismatch(false); }} />
          {mismatch && <p role="alert" className="text-[13px] text-gaid-danger">{text("passwordMismatch")}</p>}
        </>}
        <Button type="submit" className="self-end">{text(busy ? "working" : `auth.${mode}.button`)}</Button>
      </fieldset>
    </form>
  </div>;
}
