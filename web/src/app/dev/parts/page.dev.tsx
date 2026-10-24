import { DevPartsPage } from "@/geo/dev/parts-page";

// GAID development parts page (gaid-ui-quality-kit). The `.dev.tsx` page extension exists only for `next dev` (or a
// build with GAID_DEV_PAGES=1; web/next.config.ts), so a production build has no such route and answers 404.
export default function Page() {
  return <DevPartsPage />;
}
