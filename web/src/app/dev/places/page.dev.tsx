import { DevPlacesPage } from "@/geo/dev/places/places-page";

// GAID place mockups (gaid-ia-connect-workspace): development-only like /dev/parts (`.dev.tsx` exists only for `next dev`
// or a GAID_DEV_PAGES=1 build; web/next.config.ts), so a production build answers 404.
export default function Page() {
  return <DevPlacesPage />;
}
