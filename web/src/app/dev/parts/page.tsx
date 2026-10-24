import { notFound } from "next/navigation";

import { DevPartsPage } from "@/geo/dev/parts-page";

// GAID development parts page (gaid-ui-quality-kit): served by `next dev`; a production server answers 404 unless it was
// started with GAID_DEV_PAGES=1. Read per request so one build serves both.
export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.GAID_DEV_PAGES !== "1") notFound();
  return <DevPartsPage />;
}
