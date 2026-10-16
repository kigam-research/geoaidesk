"use client";
/** The agent model for reading sources and writing the draft: the app default or a connected model (e.g. Qwen, MiniMax). */
import { geoText } from "@/geo/i18n";
import { useModels } from "@/lib/use-models";

const text = geoText("hub");

export function AgentModelSelect({ value, onChange }: { value: string; onChange: (ref: string) => void }) {
  const { providerModels, directProviderModels } = useModels();
  const options = [...directProviderModels, ...providerModels].filter(
    (m, i, all) =>
      m.available !== false &&
      !m.isFusion &&
      all.findIndex(
        (x) =>
          x.id === m.id || (x.label === m.label && (x.sourceLabel ?? x.provider) === (m.sourceLabel ?? m.provider)),
      ) === i,
  );
  const groups = new Map<string, typeof options>();
  for (const m of options) {
    const key = m.sourceLabel ?? m.provider;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {text("sources.agentModel")}
      <select
        className="h-9 rounded-md border bg-background px-2 text-sm font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{text("sources.agentModelDefault")}</option>
        {value && !options.some((m) => m.id === value) && <option value={value}>{value}</option>}
        {[...groups].map(([group, models]) => (
          <optgroup key={group} label={group}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-xs font-normal text-muted-foreground">{text("sources.agentModelHint")}</span>
    </label>
  );
}
