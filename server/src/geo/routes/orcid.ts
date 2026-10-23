/**
 * `/geo/orcid*`: the researcher's ORCID link and importing their public works into the personal library
 * (gaid-orcid phase 1; contract `web/src/geo/contracts/orcid.ts`). User-level, like the library.
 */
import type { FastifyInstance } from "fastify";
import type { OrcidConfirmBody, OrcidLinkBody } from "../../../../web/src/geo/contracts/orcid.ts";
import { LibraryError, libraryStore, type LibraryStore } from "../library/store.ts";
import { OrcidError } from "../orcid/client.ts";
import { orcidErrorStatus, orcidService, type OrcidCallbackResult, type OrcidService } from "../orcid/service.ts";
import { orcidUrl } from "../../../../web/src/geo/contracts/orcid.ts";

export interface OrcidRouteOptions {
  store?: () => LibraryStore;
  service?: (store: LibraryStore) => OrcidService;
}

export async function registerGeoOrcidRoutes(app: FastifyInstance, options: OrcidRouteOptions = {}): Promise<void> {
  const storeOf = options.store ?? libraryStore;
  const serviceOf = options.service ?? orcidService;
  const service = () => serviceOf(storeOf());

  app.register(async (scope) => {
    scope.setErrorHandler((error, _req, reply) => {
      if (error instanceof LibraryError) return reply.code(error.status).send({ error: error.message });
      if (error instanceof OrcidError) {
        return reply.code(orcidErrorStatus(error)).send({ error: error.kind === "not-found" ? "공개된 ORCID 기록을 찾지 못했습니다." : "ORCID에 연결하지 못했습니다.", orcid: error.kind });
      }
      if ((error as { statusCode?: number }).statusCode === 400) return reply.code(400).send({ error: "요청 형식을 확인해 주세요." });
      scope.log.error(error);
      return reply.code(500).send({ error: "처리하지 못했습니다. 서버 기록을 확인해 주세요." });
    });

    scope.get("/geo/orcid", async () => service().status());
    scope.put<{ Body: Partial<OrcidLinkBody> }>("/geo/orcid", async (req) => service().link(req.body?.orcid));
    scope.delete("/geo/orcid", async () => service().unlink());
    scope.post("/geo/orcid/works", async () => service().preview());
    scope.post<{ Body: Partial<OrcidConfirmBody> }>("/geo/orcid/works/confirm", { bodyLimit: 256 * 1024 }, async (req) => service().confirm(req.body));
    scope.post("/geo/orcid/auth/start", async () => service().authStart());
    scope.delete("/geo/orcid/auth", async () => service().authUnlink());
    // ORCID's redirect target (a top-level navigation; the hub checks the single-use state against this login).
    scope.get<{ Querystring: Record<string, unknown> }>("/geo/orcid/callback", async (req, reply) => {
      const result = await service().callback(req.query ?? {});
      reply.header("Cache-Control", "no-store").type("text/html; charset=utf-8");
      return callbackPage(result);
    });
  });
}

const PAGE_TEXT: Record<OrcidCallbackResult extends infer R ? R extends { ok: false; reason: infer K } ? K & string : never : never, [string, string]> = {
  denied: ["ORCID에서 본인 확인을 취소했습니다.", "You cancelled the ORCID sign-in."],
  "no-account": ["기관 GAID 허브에 로그인한 뒤 GAID 서재에서 다시 시작하세요.", "Log in to the institute GAID hub, then start again from the GAID library."],
  expired: ["확인 요청이 만료되었거나 이미 사용되었습니다. GAID 서재에서 다시 시작하세요.", "The request expired or was already used. Start again from the GAID library."],
  taken: ["이 ORCID iD는 다른 허브 계정에 이미 연결되어 있습니다. 허브 관리자에게 문의하세요.", "This ORCID iD is already linked to another hub account. Ask the hub administrator."],
  "not-configured": ["기관 GAID 허브에 ORCID 연결이 설정되어 있지 않습니다.", "The institute GAID hub has no ORCID connection set up."],
  unreachable: ["허브 서버가 ORCID 확인을 마치지 못했습니다. 잠시 뒤 GAID 서재에서 다시 시작하세요.", "The hub server could not finish the ORCID check. Try again later from the GAID library."],
  failed: ["ORCID 본인 확인을 마치지 못했습니다. GAID 서재에서 다시 시작하세요.", "The ORCID sign-in did not finish. Start again from the GAID library."],
};
const escape = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Static result page (the API's CSP sandbox applies; no script). The library screen refreshes when the researcher returns. */
function callbackPage(result: OrcidCallbackResult): string {
  const [ko, en] = result.ok
    ? [`ORCID 본인 확인을 마쳤습니다. ${result.orcid} iD를 허브 계정에 연결했습니다. 이 탭을 닫고 GAID로 돌아가세요.`,
       `ORCID sign-in finished: ${result.orcid} is linked to your hub account. Close this tab and return to GAID.`]
    : PAGE_TEXT[result.reason];
  const link = result.ok ? `<p><a href="${escape(orcidUrl(result.orcid, result.environment))}">${escape(orcidUrl(result.orcid, result.environment))}</a></p>` : "";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>GAID · ORCID</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1.5rem}p.en{opacity:.75}</style></head>
<body><h1>GAID · ORCID</h1><p>${escape(ko)}</p><p class="en" lang="en">${escape(en)}</p>${link}</body></html>`;
}
