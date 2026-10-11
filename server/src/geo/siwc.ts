/**
 * Sign in with ChatGPT under the distribution's own name.
 *
 * OpenAI's terms for the open-source flow (openai.com/policies/sign-in-with-chatgpt-terms,
 * 2026-09-29) ask an app to "use your app's own name during sign-in and
 * activation". Pi's login sends `agent_name_hint=Pi` when it registers the
 * dynamic client, so the consent screen would name Pi. The hint only labels
 * the registration: the issued client id, PKCE, state and token exchange are
 * untouched, so Kady rewrites the hint in the authorization URL it hands to
 * the browser instead of patching the SDK. Upstream checkouts (no
 * distribution manifest) keep Pi's URL.
 */
import { REPO_ROOT } from "../config.ts";
import { readDistributionProductName } from "./distribution.ts";

const AUTHORIZE_HOST = "auth.openai.com";

export function siwcAuthorizationUrl(url: string, appName: string | null): string {
  if (!appName) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== AUTHORIZE_HOST || !parsed.searchParams.has("agent_name_hint")) return url;
  parsed.searchParams.set("agent_name_hint", appName);
  return parsed.toString();
}

let productName: string | null | undefined;

/** The distribution's product name (`geo/distribution.json`), or null upstream. */
export function siwcAppName(repoRoot = REPO_ROOT): string | null {
  if (productName === undefined) productName = readDistributionProductName(repoRoot);
  return productName;
}
