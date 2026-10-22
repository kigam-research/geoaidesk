import { API_BASE } from "@/lib/projects";
import { withApiToken } from "@/lib/api-auth";

/** Fixed hidden CVD preview endpoint. No arbitrary path is accepted by the server. */
export function checkPreviewUrl(projectId: string, sha256: string, variant: string): string {
  return withApiToken(`${API_BASE}/geo/figures/check-preview?project=${encodeURIComponent(projectId)}&sha256=${encodeURIComponent(sha256)}&variant=${encodeURIComponent(variant)}`);
}
