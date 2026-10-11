import {
  listCustomProviders, publicCustomProviders, validateCustomProviders, writeCustomProviders,
} from "../agent/custom-models.ts";
import { readAppDefaults, writeAppDefaults } from "../app-settings.ts";
import { ollamaBaseUrl } from "../config.ts";
import { LOCAL_MODEL_PROFILES, MIN_LOCAL_CONTEXT } from "./local-model-profiles.ts";
import { GAID_LOCAL_PROVIDER } from "./local-provider.ts";

export { GAID_LOCAL_PROVIDER } from "./local-provider.ts";
export interface LocalModelOptions {
  agentDir?: string;
  baseUrl?: () => string;
  refreshModels?: () => Promise<unknown>;
}
export class LocalModelError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
type Rec = Record<string, unknown>;
const record = (value: unknown): Rec => value && typeof value === "object" && !Array.isArray(value) ? value as Rec : {};
const positive = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const base = (options: LocalModelOptions) => (options.baseUrl ?? ollamaBaseUrl)().replace(/\/+$/, "");

async function ollama(url: string, body?: unknown, create = false): Promise<Rec> {
  try {
    const response = await fetch(url, {
      ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(create ? 120_000 : 5_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = record(await response.json());
    if (result.error) throw new Error(String(result.error));
    return result;
  } catch (error) {
    throw new LocalModelError(502, `Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface LocalModelInfo {
  model: string;
  configuredContext: number | null;
  trainedContext: number | null;
  loadedContext: number | null;
  detailAvailable: boolean;
}

export async function localModelStatus(options: LocalModelOptions = {}) {
  const baseUrl = base(options);
  const provider = publicCustomProviders(options.agentDir).find(p => p.id === GAID_LOCAL_PROVIDER && p.managed) ?? null;
  const defaults = readAppDefaults(options.agentDir);
  let reachable = false;
  let error: string | null = null;
  let loadedStatusAvailable = false;
  const models: LocalModelInfo[] = [];
  try {
    const tags = await ollama(`${baseUrl}/api/tags`);
    if (!Array.isArray(tags.models)) throw new LocalModelError(502, "Ollama: invalid model list");
    reachable = true;
    let loaded: Rec[] = [];
    try {
      const ps = await ollama(`${baseUrl}/api/ps`);
      if (Array.isArray(ps.models)) { loaded = ps.models.map(record); loadedStatusAvailable = true; }
    } catch { /* Older Ollama servers may not expose loaded context. */ }
    const names = [...new Set(tags.models.map(item => record(item).name ?? record(item).model)
      .filter((name): name is string => typeof name === "string" && !!name))];
    // Bound concurrent show requests, rather than flooding a model server.
    for (let offset = 0; offset < names.length; offset += 4) {
      models.push(...await Promise.all(names.slice(offset, offset + 4).map(async model => {
        let show: Rec = {};
        let detailAvailable = false;
        try { show = await ollama(`${baseUrl}/api/show`, { model }); detailAvailable = true; } catch { /* visible below */ }
        const parameters = typeof show.parameters === "string" ? show.parameters : "";
        const configuredContext = positive(Number(parameters.match(/^\s*num_ctx\s+(\d+)\s*$/m)?.[1]))
          ?? positive(record(show.parameters).num_ctx);
        const lengths = Object.entries(record(show.model_info))
          .filter(([key]) => key.endsWith(".context_length")).map(([, value]) => positive(value))
          .filter((value): value is number => value !== null);
        const running = loaded.find(item => item.name === model || item.model === model);
        return { model, configuredContext, trainedContext: lengths.length ? Math.min(...lengths) : null,
          loadedContext: positive(running?.context_length), detailAvailable };
      })));
    }
  } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  const configured = provider?.models[0];
  const info = models.find(item => item.model === configured?.id);
  const declared = configured?.contextWindow ?? null;
  const knownRuntime = info?.loadedContext ?? info?.configuredContext ?? null;
  const source = info?.loadedContext != null ? "loaded" : info?.configuredContext != null ? "configured" : null;
  const reason = provider && provider.baseUrl.replace(/\/+$/, "") !== `${baseUrl}/v1` ? "server-changed"
    : declared !== null && info?.trainedContext != null && declared > info.trainedContext ? "exceeds-trained"
      : declared !== null && knownRuntime !== null && declared > knownRuntime ? "exceeds-runtime" : null;
  const verification = { state: reason ? "mismatch" : declared !== null && knownRuntime !== null ? "verified" : "unverified",
    reason, declared, knownRuntime, source };
  return { baseUrl, reachable, error, loadedStatusAvailable, models, provider, defaults, verification, profiles: LOCAL_MODEL_PROFILES };
}

export interface ConfigureLocalModel {
  model: string; contextWindow: number; maxTokens: number; createVariant?: boolean; setDefault?: boolean;
}
export function validateLocalModel(input: unknown): ConfigureLocalModel {
  const value = record(input);
  if (Object.keys(value).some(key => !["model", "contextWindow", "maxTokens", "createVariant", "setDefault"].includes(key))) {
    throw new LocalModelError(400, "Unknown local model setting");
  }
  if (typeof value.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(value.model)) {
    throw new LocalModelError(400, "model must be an Ollama model name (at most 200 characters)");
  }
  if (!Number.isInteger(value.contextWindow) || Number(value.contextWindow) < MIN_LOCAL_CONTEXT || Number(value.contextWindow) > 100_000_000
    || !Number.isInteger(value.maxTokens) || Number(value.maxTokens) < 1 || Number(value.maxTokens) > 10_000_000
    || Number(value.maxTokens) >= Number(value.contextWindow)) {
    throw new LocalModelError(400, "contextWindow must be at least 65536 (64K) and maxTokens must be a positive integer smaller than context");
  }
  for (const key of ["createVariant", "setDefault"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") throw new LocalModelError(400, `${key} must be boolean`);
  }
  return value as unknown as ConfigureLocalModel;
}

export async function configureLocalModel(input: unknown, options: LocalModelOptions = {}) {
  const config = validateLocalModel(input);
  const baseUrl = base(options);
  const listed = listCustomProviders(options.agentDir);
  if (listed.some(p => p.id === GAID_LOCAL_PROVIDER && !p.managed)) {
    throw new LocalModelError(409, "gaid-local belongs to a hand-written provider; it was not changed");
  }
  const tags = await ollama(`${baseUrl}/api/tags`);
  if (!Array.isArray(tags.models) || !tags.models.some(item => record(item).name === config.model || record(item).model === config.model)) {
    throw new LocalModelError(400, "The selected model is not installed in Ollama");
  }
  const model = config.createVariant ? `${config.model}-gaid-${Math.round(config.contextWindow / 1024)}k` : config.model;
  const validated = validateCustomProviders([{
    id: GAID_LOCAL_PROVIDER, name: "GAID local", baseUrl: `${baseUrl}/v1`, api: "openai-completions",
    models: [{ id: model, contextWindow: config.contextWindow, maxTokens: config.maxTokens, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }],
  }]);
  if (typeof validated === "string") throw new LocalModelError(400, validated);
  if (config.createVariant) {
    // Creation is only reached for an explicit true, never on status or refresh.
    await ollama(`${baseUrl}/api/create`, { model, from: config.model, parameters: { num_ctx: config.contextWindow }, stream: false }, true);
  }
  // Re-read after network awaits. Preserve other managed entries and their exact saved keys.
  const others = listCustomProviders(options.agentDir).filter(p => p.managed && p.id !== GAID_LOCAL_PROVIDER)
    .map(({ apiKey: _key, ...p }) => ({ ...p, keepApiKey: true }));
  const providers = validateCustomProviders([...others, ...validated]);
  if (typeof providers === "string") throw new LocalModelError(400, providers);
  if (!writeCustomProviders(providers, options.agentDir)) {
    throw new LocalModelError(409, "models.json could not be updated (malformed file or hand-written provider conflict)");
  }
  try {
    await (options.refreshModels ?? (async () => {
      const { getModelRuntime } = await import("../agent/session-registry.ts");
      return getModelRuntime().refresh();
    }))();
  } catch {
    throw new LocalModelError(502, "Model configuration saved, but runtime reload failed; default was not changed");
  }
  if (config.setDefault && !writeAppDefaults({ model: `${GAID_LOCAL_PROVIDER}/${model}` }, options.agentDir)) {
    throw new LocalModelError(409, "Model configuration saved, but kady-settings.json is malformed; default was not changed");
  }
  return localModelStatus(options);
}
