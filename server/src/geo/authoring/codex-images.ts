/**
 * Concept pictures through the researcher's ChatGPT sign-in (subscription), the way Codex CLI makes images with ChatGPT
 * auth: POST `<chatgpt backend>/codex/images/generations` with an Images API body (openai/codex
 * codex-rs/codex-api/src/endpoint/images.rs, codex-rs/ext/image-generation). The token comes from Pi's auth store through
 * GAID's model runtime (Settings → Providers → OpenAI "Sign in with ChatGPT"); it is never read from ~/.codex.
 */
import { AuthoringError } from "./store.ts";

export const CODEX_IMAGE_MODEL = "gpt-image-2";
export type ImageMime = "image/png" | "image/webp" | "image/jpeg";
/**
 * Pi providers whose OAuth token reaches the ChatGPT Codex backend. Only the legacy "OpenAI Codex" login qualifies:
 * the current "Sign in with ChatGPT" (`openai`) token is for api.openai.com subscription sharing, which refuses image
 * generation ("subscription_sharing_unsupported_capability", checked 2026-10-16) and the Images API
 * ("rejected_by_hardened_oauth_boundary").
 */
export const CHATGPT_PROVIDERS = ["openai-codex"] as const;
const DEFAULT_BACKEND = "https://chatgpt.com/backend-api";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

export interface ChatGptAuth {
  provider: string;
  token: string;
  baseUrl?: string;
}

/** The ChatGPT account id carried in the access token (same claim Pi's Codex transport reads). */
export function chatGptAccountId(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    const id = payload?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
    if (typeof id === "string" && id) return id;
  } catch {
    /* fall through */
  }
  throw new AuthoringError("ChatGPT 로그인 정보에서 계정을 확인하지 못했습니다. 설정에서 다시 로그인하세요.", 401);
}

export function codexImagesUrl(baseUrl?: string): string {
  const base = (baseUrl && /chatgpt\.com/.test(baseUrl) ? baseUrl : DEFAULT_BACKEND).replace(/\/+$/, "");
  return `${base.replace(/\/codex(\/responses)?$/, "")}/codex/images/generations`;
}

/** One picture from the ChatGPT subscription's image model; PNG/WebP bytes. */
export async function generateCodexImage(
  auth: ChatGptAuth,
  prompt: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<{ bytes: Uint8Array; mimeType: ImageMime }> {
  const response = await (options.fetch ?? fetch)(codexImagesUrl(auth.baseUrl), {
    method: "POST",
    signal: options.signal ?? AbortSignal.timeout(5 * 60_000),
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "chatgpt-account-id": chatGptAccountId(auth.token),
      originator: "pi",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, model: CODEX_IMAGE_MODEL, n: 1, size: "1536x1024", quality: "medium" }),
  });
  if (response.status === 401 || response.status === 403)
    throw new AuthoringError("ChatGPT 구독으로 그림을 만들 권한이 없습니다. 설정에서 다시 로그인하세요.", 401);
  if (response.status === 429)
    throw new AuthoringError("ChatGPT 구독의 그림 생성 사용량 한도에 도달했습니다. 잠시 뒤 다시 시도하세요.", 429);
  if (!response.ok) throw new AuthoringError(`ChatGPT 구독 그림 생성이 실패했습니다 (HTTP ${response.status}).`, 502);
  const body = (await response.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new AuthoringError("ChatGPT 구독 이미지 모델이 그림을 반환하지 않았습니다.", 422);
  const bytes = Buffer.from(b64, "base64");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new AuthoringError("반환된 그림이 너무 큽니다.", 422);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!png && !webp && !jpeg)
    throw new AuthoringError("ChatGPT 구독 이미지 모델이 그림 파일을 반환하지 않았습니다.", 422);
  return { bytes, mimeType: png ? "image/png" : webp ? "image/webp" : "image/jpeg" };
}
