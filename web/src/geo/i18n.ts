/**
 * Minimal string lookup for GeoAIDesk UI (Korean first, English second;
 * skill_hub geo-byok-plan §4.5). Each module owns a `strings.ts` built with
 * `defineGeoStrings`, so parallel packages never edit one shared file.
 * gaid-korean-workspace (WP07) owns locale selection and the copy rules and
 * will move these dictionaries into `web/src/geo/locales/` keeping the keys.
 */
export type GeoLocale = "ko" | "en";

/** Korean unless the browser's first language is not Korean. */
export function geoLocale(): GeoLocale {
  if (typeof navigator === "undefined") return "ko";
  const first = navigator.languages?.[0] ?? navigator.language ?? "ko";
  return first.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export type GeoText<K extends string> = (key: K, vars?: Record<string, string | number>, locale?: GeoLocale) => string;

/**
 * A lookup over one module's strings. Every key needs Korean; English falls
 * back to Korean. `{name}` placeholders are filled from `vars`.
 */
export function defineGeoStrings<K extends string>(strings: { ko: Record<K, string>; en: Partial<Record<K, string>> }): GeoText<K> {
  return (key, vars = {}, locale = geoLocale()) => {
    const template = (locale === "en" ? strings.en[key] : undefined) ?? strings.ko[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}
