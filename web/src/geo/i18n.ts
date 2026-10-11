/**
 * GeoAIDesk UI strings (Korean first, English second; skill_hub geo-byok-plan
 * §4.5–4.6, copy rules in geo/copy/gaid-writing.md).
 *
 * Every visible GAID string lives in a locale catalogue,
 * `web/src/geo/locales/<namespace>/{ko,en}.json` (ICU messages, nested
 * objects flatten to dotted ids), collected by `locales/index.ts`. Look one up
 * with `t("<namespace>.<id>", values)`. `scripts/check` runs the WP00 copy
 * validator over the catalogues, so ko and en stay complete and on-policy.
 *
 * Locale: a saved choice (Settings, `gaid:locale`) or else the browser's first
 * language; Korean unless that language is something else. Changing the
 * choice reloads the page, so strings are plain lookups, not subscriptions.
 */
import { formatMessage, type MessageValues } from "./icu";
import { GEO_CATALOGUES } from "./locales";

export type GeoLocale = "ko" | "en";
export type GeoLocaleSetting = GeoLocale | "auto";

export const GEO_LOCALE_STORAGE_KEY = "gaid:locale";

export function geoLocaleSetting(): GeoLocaleSetting {
  try {
    const saved = globalThis.localStorage?.getItem(GEO_LOCALE_STORAGE_KEY);
    if (saved === "ko" || saved === "en") return saved;
  } catch {
    // Storage unavailable (private mode, tests): fall through.
  }
  return "auto";
}

/** The saved choice, else Korean unless the browser's first language is not Korean. */
export function geoLocale(): GeoLocale {
  const setting = geoLocaleSetting();
  if (setting !== "auto") return setting;
  if (typeof navigator === "undefined") return "ko";
  const first = navigator.languages?.[0] ?? navigator.language ?? "ko";
  return first.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/** Save the language choice; the caller reloads the page to apply it. */
export function setGeoLocaleSetting(setting: GeoLocaleSetting): void {
  try {
    if (setting === "auto") globalThis.localStorage?.removeItem(GEO_LOCALE_STORAGE_KEY);
    else globalThis.localStorage?.setItem(GEO_LOCALE_STORAGE_KEY, setting);
  } catch {
    // Not persisted; the current page keeps its language.
  }
}

/** Raw message for a catalogue id, or undefined. */
function lookup(id: string, locale: GeoLocale): string | undefined {
  const dot = id.indexOf(".");
  if (dot <= 0) return undefined;
  const namespace = GEO_CATALOGUES[id.slice(0, dot)];
  return namespace?.[locale]?.[id.slice(dot + 1)];
}

export function hasGeoText(id: string, locale: GeoLocale = geoLocale()): boolean {
  return lookup(id, locale) !== undefined;
}

/**
 * Formatted message `id` ("<namespace>.<key>"). A missing English message
 * falls back to Korean and a missing id to the id itself, so a gap shows as
 * an id on screen instead of breaking the page; the copy validator reports
 * such gaps in `scripts/check`.
 */
export function t(id: string, values: MessageValues = {}, locale: GeoLocale = geoLocale()): string {
  const message = lookup(id, locale) ?? lookup(id, "ko");
  if (message === undefined) return id;
  try {
    return formatMessage(message, locale, values);
  } catch {
    // A missing value: show the template rather than nothing.
    return message;
  }
}

/** `t` bound to one namespace: `const nt = geoText("map"); nt("legend.title")`. */
export function geoText(namespace: string) {
  return (key: string, values?: MessageValues, locale?: GeoLocale) => t(`${namespace}.${key}`, values, locale);
}

export type GeoText<K extends string> = (key: K, vars?: Record<string, string | number>, locale?: GeoLocale) => string;

/**
 * Module-local dictionaries from before the locale catalogues (WP03–WP05).
 * Kept for modules not yet moved to `locales/`; new strings go to catalogues.
 * Every key needs Korean; English falls back to Korean. `{name}` placeholders
 * are filled from `vars`.
 */
export function defineGeoStrings<K extends string>(strings: { ko: Record<K, string>; en: Partial<Record<K, string>> }): GeoText<K> {
  return (key, vars = {}, locale = geoLocale()) => {
    const template = (locale === "en" ? strings.en[key] : undefined) ?? strings.ko[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}
