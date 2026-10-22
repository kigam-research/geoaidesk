"use client";
import { geoText, geoLocaleSetting, setGeoLocaleSetting, type GeoLocaleSetting } from "@/geo/i18n";
import { useSyncExternalStore } from "react";
import { CompassIcon, MapIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsHeader } from "./primitives";
import { setGaidStyle, useGaidStyle, type GaidStyle } from "@/geo/appearance/style";

const appText = geoText("app");

export function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const language = useSyncExternalStore(() => () => {}, geoLocaleSetting, () => "auto" as GeoLocaleSetting);
  // GeoAIDesk screen style (UI guide v2 section 2): 계측 default, 도폭 optional; independent of the theme.
  const style = useGaidStyle();
  const styleOptions: { value: GaidStyle; label: string; icon: typeof SunIcon }[] = [
    { value: "instrument", label: appText("settings.appearance.styleInstrument"), icon: CompassIcon },
    { value: "mapsheet", label: appText("settings.appearance.styleMapsheet"), icon: MapIcon },
  ];

  const options: { value: string; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: appText("settings.appearance.light"), icon: SunIcon },
    { value: "dark", label: appText("settings.appearance.dark"), icon: MoonIcon },
    { value: "system", label: appText("settings.appearance.system"), icon: MonitorIcon },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SettingsHeader
        title={appText("settings.appearance.appearance")}
        description={appText("settings.appearance.choose_how_k_dense_byok_looks_system")}
      />

      <label className="flex flex-col gap-2 text-xs font-medium">
        {appText("settings.appearance.language")}
        <select className="h-9 w-full rounded-md border bg-background px-2" value={language} onChange={(event) => {
          setGeoLocaleSetting(event.target.value as GeoLocaleSetting);
          window.location.reload();
        }}>
          <option value="auto">{appText("settings.appearance.auto")}</option>
          <option value="ko">{appText("settings.appearance.korean")}</option>
          <option value="en">{appText("settings.appearance.english")}</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <Button
              key={opt.value}
              variant={active ? "default" : "outline"}
              size="sm"
              aria-pressed={active}
              onClick={() => setTheme(opt.value)}
              className={cn("flex-1 gap-1.5 text-xs")}
            >
              <Icon className="size-3.5" />
              {opt.label}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2" role="group" aria-labelledby="gaid-style-label">
        <span id="gaid-style-label" className="text-xs font-medium">{appText("settings.appearance.style")}</span>
        <div className="flex flex-wrap gap-2">
          {styleOptions.map((opt) => {
            const Icon = opt.icon;
            const active = style === opt.value;
            return (
              <Button
                key={opt.value}
                variant={active ? "default" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => setGaidStyle(opt.value)}
                className="flex-1 gap-1.5 text-xs"
              >
                <Icon className="size-3.5" />
                {opt.label}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{appText("settings.appearance.styleHint")}</p>
      </div>
    </div>
  );
}
