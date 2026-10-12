"use client";
import { geoText } from "@/geo/i18n";

/**
 * Asks for the backend access token when the server demands one (see
 * lib/api-auth.ts). Invisible on a default install: it only opens after a
 * request comes back 401 with `X-Kady-Auth: required`.
 */
import { useEffect, useState } from "react";
import { KeyRoundIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_REQUIRED_EVENT, getApiToken, setApiToken } from "@/lib/api-auth";

const settingsText = geoText("settings");

export function ApiTokenGate() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [hadToken, setHadToken] = useState(false);

  useEffect(() => {
    const onRequired = () => {
      setHadToken(Boolean(getApiToken()));
      setOpen(true);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequired);
  }, []);

  const submit = () => {
    if (!value.trim()) return;
    setApiToken(value);
    // Every hook re-fetches with the token on a clean load.
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRoundIcon className="size-4" /> {settingsText("api_token_gate.access_token_required")}
          </DialogTitle>
          <DialogDescription>
            {hadToken
              ? settingsText("api_token_gate.the_kady_server_rejected_the_saved_access_token_it_changes_each_time_kady_restarts_unless")
              : settingsText("api_token_gate.this_kady_server_is_protected_with_an_access_token")}
            {settingsText("api_token_gate.open_the_link_printed_in_the_terminal_that_started_kady_or_paste_the_link_or_token_here")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={settingsText("api_token.token_placeholder")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={settingsText("api_token_gate.access_token")}
          />
        </form>
        <DialogFooter>
          <Button onClick={submit} disabled={!value.trim()}>
            {settingsText("api_token_gate.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
