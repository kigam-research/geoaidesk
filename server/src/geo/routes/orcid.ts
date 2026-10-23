/**
 * `/geo/orcid*`: the researcher's ORCID link and importing their public works into the personal library
 * (gaid-orcid phase 1; contract `web/src/geo/contracts/orcid.ts`). User-level, like the library.
 */
import type { FastifyInstance } from "fastify";
import type { OrcidConfirmBody, OrcidLinkBody } from "../../../../web/src/geo/contracts/orcid.ts";
import { LibraryError, libraryStore, type LibraryStore } from "../library/store.ts";
import { OrcidError } from "../orcid/client.ts";
import { orcidErrorStatus, orcidService, type OrcidService } from "../orcid/service.ts";

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
  });
}
