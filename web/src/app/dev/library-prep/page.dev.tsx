import { DevLibraryPrepPage } from "@/geo/dev/library-prep/library-prep-page";

// 문헌 정리 mockups (gaid-library-prep phase 1): development-only like /dev/parts (`.dev.tsx` exists only for `next dev`
// or a GAID_DEV_PAGES=1 build; web/next.config.ts), so a production build answers 404.
export default function Page() {
  return <DevLibraryPrepPage />;
}
