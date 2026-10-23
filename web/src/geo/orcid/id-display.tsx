import { orcidUrl, type OrcidEnvironment } from "@/geo/contracts/orcid";
import { t } from "@/geo/i18n";

/** Official assets stay unchanged; compact authenticated links sit after the author's name. */
export function OrcidId({ id, authenticated = false, environment = "production", compact = false }: {
  id: string; authenticated?: boolean; environment?: OrcidEnvironment; compact?: boolean;
}) {
  const url = orcidUrl(id, environment);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t(authenticated ? "orcid.id.authenticatedLink" : "orcid.id.link", { url })}
        className="pointer-events-auto relative inline-flex min-h-7 min-w-7 items-center justify-center gap-1.5 break-all rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/geo/orcid/${authenticated ? "ORCID-iD_icon_vector.svg" : "ORCID-iD_icon_unauth_vector.svg"}`} alt="" width={16} height={16} className="size-4 shrink-0" />
        {!compact && url}
      </a>
      {!authenticated && <span>{t("orcid.id.unauthenticated")}</span>}
      {environment === "sandbox" && !compact && <span>{t("orcid.id.sandbox")}</span>}
    </span>
  );
}
