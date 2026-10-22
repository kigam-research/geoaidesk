/** Research feeds client. The browser calls only its own GAID; the GAID backend asks the hub server. */
import type {
  FeedFetchResponse,
  FeedListQuery,
  FeedListResponse,
  FeedSource,
  FeedSourceAddBody,
  FeedSourceDecision,
  FeedSourcesResponse,
} from "@/geo/contracts/hub-feeds";
import { hubRequest } from "@/geo/hub-server/api";

const admin = "/geo/hub-server/admin/feeds";
const sourcePath = (id: string) => `${admin}/sources/${encodeURIComponent(id)}`;

export const hubFeeds = {
  list: (query: FeedListQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    return hubRequest<FeedListResponse>(`/geo/hub/feeds${params.size ? `?${params}` : ""}`);
  },
  sources: () => hubRequest<FeedSourcesResponse>(`${admin}/sources`),
  add: (body: FeedSourceAddBody) => hubRequest<FeedSource>(`${admin}/sources`, "POST", body),
  decide: (id: string, body: FeedSourceDecision) => hubRequest<FeedSource>(sourcePath(id), "PATCH", body),
  remove: (id: string) => hubRequest<void>(sourcePath(id), "DELETE"),
  fetch: (sourceId?: string) => hubRequest<FeedFetchResponse>(`${admin}/fetch`, "POST", sourceId ? { sourceId } : {}),
};
