"use client";
import { workDatabaseDescription, workLabel } from "@/geo/work-labels";
import { geoText } from "@/geo/i18n";
import type { ReactNode } from "react";
import {
  XIcon,
  DatabaseIcon,
  WandSparklesIcon,
  BookOpenIcon,
  MessagesSquareIcon,
  UsersIcon,
  SparklesIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { KadyFileIcon } from "@/components/file-icon";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import type { Database } from "@/components/database-selector";
import type { Skill } from "@/lib/use-skills";
import {
  researchRefKey,
  type ComposerContext,
  type DelegationChoice,
  type ResearchRef,
} from "@/lib/composer-context";

const appText = geoText("app");

const RESEARCH_CHIP = "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400";
const DELEGATE_CHIP = "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400";
const VERIFY_CHIP = "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

const DOMAIN_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  science: {
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/20",
    dot: "bg-violet-500",
  },
  finance: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
};

function Chip({
  children,
  onRemove,
  ariaLabel,
  className,
  tooltip,
}: {
  children: ReactNode;
  /** Omitted for read-only chips (sent messages). */
  onRemove?: () => void;
  ariaLabel?: string;
  className?: string;
  tooltip?: ReactNode;
}) {
  const body = (
    <div
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-current/60 opacity-60 transition-all hover:bg-destructive/10 hover:!text-destructive group-hover:opacity-100"
          aria-label={ariaLabel}
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </div>
  );
  if (!tooltip) return body;
  return <InfoTooltip content={tooltip}>{body}</InfoTooltip>;
}

export interface ContextChipsBarProps {
  attachedFiles: string[];
  onRemoveFile: (path: string) => void;
  selectedDbs: Database[];
  onDbsChange: (dbs: Database[]) => void;
  selectedSkills: Skill[];
  onSkillsChange: (skills: Skill[]) => void;
  researchRefs: ResearchRef[];
  onResearchChange: (refs: ResearchRef[]) => void;
  delegation: DelegationChoice;
  onDelegationChange: (next: DelegationChoice) => void;
}

/** Chips for research references and delegation, editable or read-only. */
function ComposerContextChips({
  context,
  onResearchChange,
  onDelegationChange,
}: {
  context: ComposerContext;
  onResearchChange?: (refs: ResearchRef[]) => void;
  onDelegationChange?: (next: DelegationChoice) => void;
}) {
  const { delegation, research } = context;
  const scope = onResearchChange ? appText("chat.chips.applies_to_the_next_message_only") : null;
  return (
    <>
      {delegation.auto && (
        <Chip
          className={DELEGATE_CHIP}
          onRemove={onDelegationChange && (() => onDelegationChange({ ...delegation, auto: false }))}
          ariaLabel={appText("chat.chips.stop_letting_kady_choose_specialists")}
          tooltip={
            <>
              <b>{appText("chat.chips.delegate_kady_chooses")}</b>
              <br />
              {appText("chat.chips.kady_splits_the_work_and_hands_parts")}{scope}
            </>
          }
        >
          <SparklesIcon className="size-3 shrink-0 opacity-70" />
          <span>{appText("chat.chips.specialists_kady_picks")}</span>
        </Chip>
      )}
      {delegation.specialists.map((name) => (
        <Chip
          key={`agent:${name}`}
          className={DELEGATE_CHIP}
          onRemove={
            onDelegationChange &&
            (() =>
              onDelegationChange({
                ...delegation,
                specialists: delegation.specialists.filter((n) => n !== name),
              }))
          }
          ariaLabel={appText("chat.chips.removeDelegate", { name })}
          tooltip={
            <>
              <b>{appText("chat.chips.delegateName", { name })}</b>
              <br />
              {appText("chat.chips.kady_briefs_this_specialist_and_checks_its")}{scope}
            </>
          }
        >
          <UsersIcon className="size-3 shrink-0 opacity-70" />
          <span className="max-w-[140px] truncate">{name}</span>
        </Chip>
      ))}
      {delegation.verify && (
        <Chip
          className={VERIFY_CHIP}
          onRemove={onDelegationChange && (() => onDelegationChange({ ...delegation, verify: false, verifiers: [] }))}
          ariaLabel={appText("chat.chips.remove_verification_gate")}
          tooltip={
            <>
              <b>{appText("chat.chips.verification_gate")}</b>
              <br />
              {appText("chat.chips.the_best_suited_verifier_specialist_reviews_the")}{" "}
              {scope}
            </>
          }
        >
          <ShieldCheckIcon className="size-3 shrink-0 opacity-70" />
          <span>{appText("chat.chips.verify_before_accepting")}</span>
        </Chip>
      )}
      {research.map((ref) => {
        const key = researchRefKey(ref);
        const label = ref.kind === "chat" ? appText("chat.chips.earlier_chat") : appText(`chat.chips.record.${ref.type}`);
        return (
          <Chip
            key={key}
            className={RESEARCH_CHIP}
            onRemove={
              onResearchChange &&
              (() => onResearchChange(research.filter((r) => researchRefKey(r) !== key)))
            }
            ariaLabel={appText("chat.chips.removeReference", { name: ref.title })}
            tooltip={
              <>
                <b>{label}</b>
                <br />
                {ref.title}
                <br />
                {ref.kind === "chat"
                  ? appText("chat.chips.kady_reads_a_compact_snapshot_of_this")
                  : appText("chat.chips.kady_reads_this_record_with_notebook_search")}{" "}
                {scope}
              </>
            }
          >
            {ref.kind === "chat" ? (
              <MessagesSquareIcon className="size-3 shrink-0 opacity-70" />
            ) : (
              <BookOpenIcon className="size-3 shrink-0 opacity-70" />
            )}
            <span className="max-w-[180px] truncate">{ref.title}</span>
          </Chip>
        );
      })}
    </>
  );
}

/** Read-only chips under a sent user message. */
export function SentContextChips({ context }: { context: ComposerContext }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ComposerContextChips context={context} />
    </div>
  );
}

/**
 * Renders a single row of dismissible chips representing every piece of
 * active context for the next message (files, research, delegation, data
 * sources, skills). Hidden entirely when there's nothing to show.
 */
export function ContextChipsBar({
  attachedFiles,
  onRemoveFile,
  selectedDbs,
  onDbsChange,
  selectedSkills,
  onSkillsChange,
  researchRefs,
  onResearchChange,
  delegation,
  onDelegationChange,
}: ContextChipsBarProps) {
  const hasAny =
    attachedFiles.length > 0 ||
    selectedDbs.length > 0 ||
    selectedSkills.length > 0 ||
    researchRefs.length > 0 ||
    delegation.auto ||
    delegation.verify ||
    delegation.specialists.length > 0;

  if (!hasAny) return null;

  const removeSkill = (id: string) =>
    onSkillsChange(selectedSkills.filter((s) => s.id !== id));
  const removeDb = (id: string) =>
    onDbsChange(selectedDbs.filter((d) => d.id !== id));

  return (
    <div className="flex w-full flex-wrap gap-1.5 px-3 pt-2.5">
      {/* File attachments */}
      {attachedFiles.map((path) => {
        const name = path.split("/").pop() ?? path;
        return (
          <Chip
            key={`file:${path}`}
            onRemove={() => onRemoveFile(path)}
            ariaLabel={appText("chat.chips.removeFile", { name })}
            className="border-border/70 bg-muted/60 text-foreground/80 hover:bg-muted"
            tooltip={
              <>
                <b>{name}</b>
                <br />
                <span className="opacity-80">{path}</span>
                <br />
                {appText("chat.chips.attached_to_the_next_message_the_agent")}</>
            }
          >
            <KadyFileIcon name={name} className="size-3" />
            <span className="max-w-[140px] truncate">{name}</span>
          </Chip>
        );
      })}

      <ComposerContextChips
        context={{ delegation, research: researchRefs }}
        onResearchChange={onResearchChange}
        onDelegationChange={onDelegationChange}
      />

      {/* Data sources */}
      {selectedDbs.map((db) => {
        const c = DOMAIN_COLORS[db.domain];
        return (
          <Chip
            key={`db:${db.id}`}
            onRemove={() => removeDb(db.id)}
            ariaLabel={appText("chat.chips.removeSource", { name: db.name })}
            className={cn(c.bg, c.text, c.border)}
            tooltip={
              <>
                <b>{db.name}</b>{" "}
                <span className="opacity-70 capitalize">· {workLabel("database.domain", db.domain)}</span>
                <br />
                {workDatabaseDescription(db)}
                <br />
                <span className="opacity-70">{db.url}</span>
              </>
            }
          >
            <DatabaseIcon className="size-3 shrink-0 opacity-70" />
            <span className={cn("inline-block size-1.5 rounded-full", c.dot)} />
            <span className="max-w-[140px] truncate">{db.name}</span>
          </Chip>
        );
      })}

      {/* Skills */}
      {selectedSkills.map((skill) => (
        <Chip
          key={`skill:${skill.id}`}
          onRemove={() => removeSkill(skill.id)}
          ariaLabel={appText("chat.chips.removeSkill", { name: skill.name })}
          className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
          tooltip={
            <>
              <b>{appText("chat.chips.skillName", { name: skill.name })}</b>
              {skill.author ? (
                <span className="opacity-70"> {appText("chat.chips.skillSource", { source: skill.author })}</span>
              ) : null}
              <br />
              {skill.description}
              <br />
              {appText("chat.chips.kady_follows_this_skill_s_instructions_on")}</>
          }
        >
          <WandSparklesIcon className="size-3 shrink-0 opacity-70" />
          <span className="max-w-[160px] truncate">{skill.name}</span>
        </Chip>
      ))}
    </div>
  );
}
