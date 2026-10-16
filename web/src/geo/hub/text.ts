import type { AtlasTextInput } from "@/geo/contracts/authoring";
import { geoLocale } from "@/geo/i18n";

/** Display text of an Atlas/method text value in the current locale (Korean when English is missing). */
export function localText(value: AtlasTextInput | undefined | null): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return geoLocale() === "en" && value.en ? value.en : value.ko;
}
