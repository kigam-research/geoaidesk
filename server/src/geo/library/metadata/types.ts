import type { CslItem, MetadataOrigin } from "../../../../../web/src/geo/contracts/library.ts";

/** Evidence of an update, not a declaration that the target paper is retracted. */
export interface MetadataSignal {
  kind: "retraction" | "correction" | "update";
  relation: string;
  doi?: string;
  source: MetadataOrigin;
  assertionSource?: string;
  recordId?: string;
  updatedAt?: string;
  label?: string;
}

export interface MetadataRecord {
  csl: CslItem;
  metadataOrigin: MetadataOrigin;
  metadataConfirmed: false;
  signals: MetadataSignal[];
}

export interface ProviderError { provider: MetadataOrigin; message: string }
export interface SearchCandidate extends MetadataRecord { score: number }
export interface SearchResult {
  candidates: SearchCandidate[];
  errors: ProviderError[];
  requiresSelection: true;
}

export interface MetadataClientOptions {
  fetch?: typeof globalThis.fetch;
  /** Crossref polite pool; never invent an address. Defaults to CROSSREF_MAILTO. */
  mailto?: string;
  openAlexApiKey?: string;
  kciApiKey?: string;
  timeoutMs?: number;
  /** Refuse a long provider cooldown instead of issuing a request before it expires. */
  maxRateWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class MetadataLookupError extends Error {
  constructor(public readonly errors: ProviderError[]) {
    super(errors.map((e) => `${e.provider}: ${e.message}`).join("; "));
    this.name = "MetadataLookupError";
  }
}
