import { previewSampleResponse } from "@/geo/authoring-preview/sample";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return previewSampleResponse({ enabled: process.env.GAID_AUTHORING_PREVIEW_SAMPLE === "1" });
}

export function HEAD() {
  return previewSampleResponse({ enabled: process.env.GAID_AUTHORING_PREVIEW_SAMPLE === "1", headersOnly: true });
}
