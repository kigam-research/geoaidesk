"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { geoLocale, t } from "./i18n";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Resolve browser-only language before rendering localized application chrome. */
export function GeoLocaleRoot({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  useEffect(() => {
    document.documentElement.lang = geoLocale();
  }, []);
  if (!ready) return <p role="status" className="p-4">{t("app.loading", {}, "ko")}</p>;
  return children;
}
