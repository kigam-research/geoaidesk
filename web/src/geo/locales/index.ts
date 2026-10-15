/**
 * GAID locale catalogues: one directory per namespace, `<namespace>/{ko,en}.json`.
 * Ids are `<namespace>.<dotted key>` (see ../i18n.ts). Adding a namespace = one
 * directory plus two lines here; the copy validator (geo/copy/validate-copy.mjs)
 * checks every directory under locales/.
 */
import appKo from "./app/ko.json";
import appEn from "./app/en.json";
import workspaceKo from "./workspace/ko.json";
import workspaceEn from "./workspace/en.json";
import viewersKo from "./viewers/ko.json";
import viewersEn from "./viewers/en.json";
import depthKo from "./depth/ko.json";
import depthEn from "./depth/en.json";
import mapKo from "./map/ko.json";
import mapEn from "./map/en.json";
import basemapKo from "./basemap/ko.json";
import basemapEn from "./basemap/en.json";
import tablesKo from "./tables/ko.json";
import tablesEn from "./tables/en.json";
import contextKo from "./context/ko.json";
import contextEn from "./context/en.json";
import localModelKo from "./localModel/ko.json";
import localModelEn from "./localModel/en.json";

import methodsKo from "./methods/ko.json";
import methodsEn from "./methods/en.json";

import skillHubKo from "./skillHub/ko.json";
import skillHubEn from "./skillHub/en.json";

// gaid-ui-locale: upstream K-Dense screens
import settingsKo from "./settings/ko.json";
import settingsEn from "./settings/en.json";
import notebookKo from "./notebook/ko.json";
import notebookEn from "./notebook/en.json";
import researchKo from "./research/ko.json";
import researchEn from "./research/en.json";
import filesKo from "./files/ko.json";
import filesEn from "./files/en.json";
import workKo from "./work/ko.json";
import workEn from "./work/en.json";
import workflowsKo from "./workflows/ko.json";
import workflowsEn from "./workflows/en.json";

import authoringPreviewKo from "./authoringPreview/ko.json";
import authoringPreviewEn from "./authoringPreview/en.json";
import previewSourceKo from "./previewSource/ko.json";
import previewSourceEn from "./previewSource/en.json";
import previewMethodKo from "./previewMethod/ko.json";
import previewMethodEn from "./previewMethod/en.json";

export type Catalogue = Record<string, string>;

function flatten(value: unknown, prefix = "", out: Catalogue = {}): Catalogue {
  for (const [key, v] of Object.entries((value ?? {}) as Record<string, unknown>)) {
    const id = prefix ? `${prefix}.${key}` : key;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, id, out);
    else if (typeof v === "string") out[id] = v;
  }
  return out;
}

const pair = (ko: unknown, en: unknown) => ({ ko: flatten(ko), en: flatten(en) });

/** namespace -> locale -> flattened catalogue */
export const GEO_CATALOGUES: Record<string, { ko: Catalogue; en: Catalogue }> = {
  authoringPreview: pair(authoringPreviewKo, authoringPreviewEn),
  previewSource: pair(previewSourceKo, previewSourceEn),
  previewMethod: pair(previewMethodKo, previewMethodEn),
  // gaid-korean-workspace--korean: branding and upstream primary-path strings
  app: pair(appKo, appEn),
  methods: pair(methodsKo, methodsEn),
  skillHub: pair(skillHubKo, skillHubEn),
  // gaid-korean-workspace--tasks: task catalogue, setup, recipes, suggestions, results, reusable skill
  workspace: pair(workspaceKo, workspaceEn),
  // shared inspection viewer
  viewers: pair(viewersKo, viewersEn),
  // LAS depth viewer (WP04)
  depth: pair(depthKo, depthEn),
  // map viewer (WP05)
  map: pair(mapKo, mapEn),
  basemap: pair(basemapKo, basemapEn),
  // table roles (WP04)
  tables: pair(tablesKo, tablesEn),
  // prompt budget chip (WP03)
  context: pair(contextKo, contextEn),
  // local model card (WP03)
  localModel: pair(localModelKo, localModelEn),
  // gaid-ui-locale: upstream K-Dense screens (settings, notebook, research dialogs, files, work surfaces, workflows)
  settings: pair(settingsKo, settingsEn),
  notebook: pair(notebookKo, notebookEn),
  research: pair(researchKo, researchEn),
  files: pair(filesKo, filesEn),
  work: pair(workKo, workEn),
  workflows: pair(workflowsKo, workflowsEn),
};
