import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../src/config.ts";
import { siwcAppName, siwcAuthorizationUrl } from "../src/geo/siwc.ts";

const piUrl =
  "https://auth.openai.com/api/accounts/authorize?client_id=dynamic_agent_client&agent_name_hint=Pi&ext_agent_host_id=urn%3Auuid%3Ax&response_type=code&state=s";

describe("Sign in with ChatGPT app name", () => {
  it("names the distribution in the registration hint and keeps every other parameter", () => {
    const url = new URL(siwcAuthorizationUrl(piUrl, "GeoAIDesk"));
    expect(url.searchParams.get("agent_name_hint")).toBe("GeoAIDesk");
    const before = new URL(piUrl);
    for (const key of ["client_id", "ext_agent_host_id", "response_type", "state"]) {
      expect(url.searchParams.get(key)).toBe(before.searchParams.get(key));
    }
    expect(siwcAppName(REPO_ROOT)).toBe("GeoAIDesk");
  });

  it("leaves other URLs and upstream checkouts alone", () => {
    expect(siwcAuthorizationUrl(piUrl, null)).toBe(piUrl);
    const other = "https://claude.ai/oauth/authorize?agent_name_hint=Pi";
    expect(siwcAuthorizationUrl(other, "GeoAIDesk")).toBe(other);
    expect(siwcAuthorizationUrl("not a url", "GeoAIDesk")).toBe("not a url");
  });
});
