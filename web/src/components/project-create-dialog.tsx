"use client";
import { geoText } from "@/geo/i18n";
/**
 * "New project" dialog shared by the project switcher and the Projects view.
 * Editing an existing project happens in Settings → Project instead.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/lib/projects";
import { useProjects } from "@/lib/use-projects";

const appText = geoText("app");

interface FormState {
  name: string;
  description: string;
  tags: string;
  /** Empty string = no limit. */
  spendLimit: string;
}

const EMPTY: FormState = { name: "", description: "", tags: "", spendLimit: "" };

export function ProjectCreateDialog({
  open,
  onOpenChange,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (project: Project) => void;
}) {
  const { create } = useProjects();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, name: initialName });
      setError(null);
    }
  }, [initialName, open]);

  const close = () => {
    if (!submitting) onOpenChange(false);
  };

  const submit = async () => {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError(appText("projects.create.name_is_required"));
      return;
    }
    const trimmedLimit = form.spendLimit.trim();
    let spendLimitUsd: number | null = null;
    if (trimmedLimit !== "") {
      const parsed = Number(trimmedLimit);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(appText("projects.create.spend_limit_must_be_a_non_negative"));
        return;
      }
      spendLimitUsd = parsed;
    }
    setSubmitting(true);
    try {
      const project = await create({
        name,
        description: form.description.trim(),
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        spendLimitUsd,
      });
      onOpenChange(false);
      onCreated(project);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : appText("projects.create.create_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{appText("projects.create.new_project")}</DialogTitle>
          <DialogDescription>
            {appText("projects.create.each_project_has_its_own_sandbox_chat")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {appText("projects.create.name")}<Input
              autoFocus
              aria-invalid={Boolean(error && !form.name.trim())}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={appText("projects.create.rna_seq_pilot")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {appText("projects.create.description")}<Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder={appText("projects.create.optional_one_line_summary")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {appText("projects.create.tags")}<span className="opacity-60">{appText("projects.create.comma_separated")}</span>
            <Input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder={appText("projects.create.genomics_proteomics")}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            {appText("projects.create.spend_limit")}<span className="opacity-60">{appText("projects.create.usd_optional")}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={form.spendLimit}
              onChange={(event) => setForm((current) => ({ ...current, spendLimit: event.target.value }))}
              placeholder={appText("projects.create.leave_empty_for_no_limit")}
            />
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
              {appText("projects.create.cancel")}</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Spinner data-icon="inline-start" />}
              {submitting ? appText("projects.create.creating") : appText("projects.create.create_project")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
