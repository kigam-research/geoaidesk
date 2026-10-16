/**
 * Concept pictures through the researcher's MiniMax key (M Plan subscription: text, image and speech share one quota).
 * MiniMax text-to-image API: POST https://api.minimax.io/v1/image_generation, model image-01, base64 response
 * (platform.minimax.io/docs/api-reference/image-generation-t2i). The key is the one saved under Settings → Providers →
 * MiniMax, resolved through GAID's model runtime.
 */
import type { ImageMime } from "./codex-images.ts";
import { AuthoringError } from "./store.ts";

export const MINIMAX_IMAGE_MODEL = "image-01";
const ENDPOINT = "https://api.minimax.io/v1/image_generation";
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;

const STATUS: Record<number, [string, number]> = {
  1002: ["MiniMax 사용량 제한에 걸렸습니다. 잠시 뒤 다시 시도하세요.", 429],
  1004: ["MiniMax 키를 확인하지 못했습니다. 설정의 MiniMax 키를 확인하세요.", 401],
  1008: ["MiniMax 계정의 사용량이나 잔액이 부족합니다.", 402],
  1026: ["MiniMax가 그림 설명을 민감한 내용으로 판단해 그림을 만들지 않았습니다.", 422],
  2013: ["MiniMax가 요청 형식을 받아들이지 않았습니다.", 422],
  2049: ["MiniMax 키가 올바르지 않습니다. 설정의 MiniMax 키를 확인하세요.", 401],
};

export async function generateMiniMaxImage(
  apiKey: string,
  prompt: string,
  options: { fetch?: typeof fetch; signal?: AbortSignal } = {},
): Promise<{ bytes: Uint8Array; mimeType: ImageMime }> {
  const response = await (options.fetch ?? fetch)(ENDPOINT, {
    method: "POST",
    signal: options.signal ?? AbortSignal.timeout(5 * 60_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MINIMAX_IMAGE_MODEL,
      prompt: prompt.slice(0, 1500),
      aspect_ratio: "3:2",
      response_format: "base64",
      n: 1,
    }),
  });
  if (response.status === 401 || response.status === 403)
    throw new AuthoringError("MiniMax 키를 확인하지 못했습니다. 설정의 MiniMax 키를 확인하세요.", 401);
  if (!response.ok) throw new AuthoringError(`MiniMax 그림 생성이 실패했습니다 (HTTP ${response.status}).`, 502);
  const body = (await response.json().catch(() => null)) as {
    data?: { image_base64?: string[] };
    base_resp?: { status_code?: number; status_msg?: string };
  } | null;
  const code = body?.base_resp?.status_code ?? 0;
  if (code !== 0) {
    const [message, status] = STATUS[code] ?? [`MiniMax 그림 생성이 실패했습니다 (코드 ${code}).`, 502];
    throw new AuthoringError(message, status);
  }
  const b64 = body?.data?.image_base64?.[0];
  if (!b64) throw new AuthoringError("MiniMax 이미지 모델이 그림을 반환하지 않았습니다.", 422);
  const bytes = Buffer.from(b64, "base64");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new AuthoringError("반환된 그림이 너무 큽니다.", 422);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp =
    bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!png && !webp && !jpeg) throw new AuthoringError("MiniMax 이미지 모델이 그림 파일을 반환하지 않았습니다.", 422);
  return { bytes, mimeType: png ? "image/png" : webp ? "image/webp" : "image/jpeg" };
}
