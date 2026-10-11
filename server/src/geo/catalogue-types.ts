/**
 * The parts of the skill_hub catalogue contracts the app reads
 * (skill_hub docs/specs/gaid-interfaces.md §3–§4, §9). Fields the app does not
 * use stay `unknown`; contracts grow additively, so unknown keys are ignored.
 */

/** `{ko, en?}` text as the catalogue ships it. */
export interface LocalizedText {
  ko: string;
  en?: string;
}

export interface CatalogueDependency {
  name: string;
  kind: "required" | "optional" | "runtime";
  verificationOrigin?: string;
}

/** One entry of `catalogue/index.json` (`geo-catalogue/v1`). */
export interface GeoCatalogueSkill {
  id: string;
  runtimeName: string;
  origin: "owned" | "import" | string;
  kind?: string;
  releaseState?: string;
  title: LocalizedText;
  taskLine?: LocalizedText;
  limitations?: LocalizedText[];
  disciplines?: string[];
  tasks?: string[];
  dataTypes?: string[];
  inputFormats?: string[];
  outputKinds?: string[];
  packageRef: string;
  packageDigest: string;
  fileCount?: number;
  workflowIds?: string[];
  environmentIds?: string[];
  compatibilityRefs?: string[];
  dependencies?: CatalogueDependency[];
  pythonImports?: string[];
  network?: unknown;
  credentials?: string[];
  exampleIds?: string[];
  [key: string]: unknown;
}

export interface GeoCatalogueIndex {
  schemaVersion: "geo-catalogue/v1";
  catalogueVersion: string;
  generatedFrom: { repository: string; sourceCommit: string; dirty: boolean };
  skills: GeoCatalogueSkill[];
  excludedSources?: unknown[];
}

/** `manifest.json` (`geo-catalogue-manifest/v1`). */
export interface GeoCatalogueManifest {
  schemaVersion: "geo-catalogue-manifest/v1";
  catalogueVersion: string;
  generatedFrom: { repository: string; sourceCommit: string; dirty: boolean };
  runtimeSkills: { id: string; runtimeName: string; packageRef: string; packageDigest: string }[];
  included: Record<string, unknown>;
  examples?: { archive: string; sha256: string; caseCount?: number };
  /** sha256 of every archive file outside `runtime/skills/`. */
  files: Record<string, string>;
}

/** One entry of `workflows.json` (`geo-workflow/v1`). */
export interface GeoWorkflow {
  id: string;
  title: LocalizedText;
  description?: LocalizedText;
  disciplines?: string[];
  inputRoles?: { id: string; label: LocalizedText; formats: string[]; required: boolean }[];
  requiredScientificChoices?: { id: string; label: LocalizedText; why?: LocalizedText }[];
  prompt?: LocalizedText;
  /** Atlas ids (`publisher/slug`), primary first: the workflow's exposure set. */
  skillIds: string[];
  environmentProfile: string;
  expectedArtifacts?: unknown[];
  boundary?: LocalizedText;
  exampleCaseIds?: string[];
  compatibilityRef?: string;
  [key: string]: unknown;
}

export interface GeoEnvironmentPackage {
  name: string;
  /** Lower bound in PEP 440 form, e.g. `>=1.4`. */
  version?: string;
  /** Modules to import-test. */
  imports: string[];
}

export interface GeoEnvironmentTool {
  name: string;
  version?: string;
  check: string;
  optional?: boolean;
}

/** One entry of `environments.json` (`geo-environments/v1`). */
export interface GeoEnvironment {
  id: string;
  title: LocalizedText;
  purpose?: LocalizedText;
  extends?: string;
  optional?: boolean;
  targets: ("helper" | "project")[];
  packages: GeoEnvironmentPackage[];
  tools?: GeoEnvironmentTool[];
}

export interface GeoEnvironments {
  schemaVersion: "geo-environments/v1";
  /** Python requirement, e.g. `>=3.12`. */
  python: string;
  environments: GeoEnvironment[];
}
