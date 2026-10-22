import { orcidUrl } from "@/geo/contracts/orcid";
import { t } from "@/geo/i18n";

/** Phase 1 always uses the official unauthenticated asset, unchanged (ORCID display guidelines). */
export function OrcidId({ id }: { id: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <a href={orcidUrl(id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 break-all underline underline-offset-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/geo/orcid/ORCID-iD_icon_unauth_vector.svg" alt="" width={16} height={16} className="size-4 shrink-0" />
        {orcidUrl(id)}
      </a>
      <span>{t("orcid.id.unauthenticated")}</span>
    </span>
  );
}
