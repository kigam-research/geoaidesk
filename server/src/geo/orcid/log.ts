/** ORCID's one-time `code` and `state` on the redirect target stay out of request logs (gaid-orcid phase 2). */
export function redactOrcidCallback(url: string): string {
  if (!url.startsWith("/geo/orcid/callback")) return url;
  return url.replace(/([?&](?:code|state)=)[^&#]*/g, "$1[redacted]");
}
