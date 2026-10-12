import type { MapKeys } from "./keys.ts";

export const NGII_LAYERS = ["korean_map", "satellite_map", "white_map"] as const;
export const NGII_MIN_Z = 5;
export const NGII_MAX_Z = 18;
export const ngiiResolution = (z: number) => 2088.96 / 2 ** (z - NGII_MIN_Z);
export const ngiiMatrixSize = (z: number) => Math.ceil(32024123.62 / (256 * ngiiResolution(z)));
export class BasemapError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validateNgii(layer: string, z: number, row: number, col: number): void {
  if (!NGII_LAYERS.includes(layer as typeof NGII_LAYERS[number]) || ![z, row, col].every(Number.isSafeInteger) ||
    z < NGII_MIN_Z || z > NGII_MAX_Z || row < 0 || col < 0 || row >= ngiiMatrixSize(z) || col >= ngiiMatrixSize(z)) {
    throw new BasemapError(400, "Invalid NGII tile coordinate.");
  }
}
export function validateKigam(bbox: number[], width: number, height: number): void {
  if (bbox.length !== 4 || !bbox.every(n => Number.isFinite(n) && Math.abs(n) <= 1e7) ||
    bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || bbox[2] - bbox[0] > 60000 || bbox[3] - bbox[1] > 60000 ||
    ![width, height].every(n => Number.isSafeInteger(n) && n >= 1 && n <= 1024)) {
    throw new BasemapError(400, "Invalid KIGAM bbox or image size (maximum span 60 km, size 1024).");
  }
}
export function providerCatalog(keys: MapKeys) {
  const ngiiReason = !keys.ngii ? "missing-key" : !keys.referer ? "missing-referer" : undefined;
  return { providers: [
    { id: "none", kind: "base", available: true, attribution: "", crs: "EPSG:3857" },
    { id: "osm", kind: "base", available: true, attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright", crs: "EPSG:3857", minZoom: 0, maxZoom: 19 },
    ...["ngii-base", "ngii-satellite", "ngii-white"].map(id => ({ id, kind: "base", available: !ngiiReason,
      ...(ngiiReason ? { reason: ngiiReason } : {}), attribution: "© 국토지리정보원(NGII) 바로e맵", attributionUrl: "https://map.ngii.go.kr/", crs: "EPSG:5179", minZoom: 5, maxZoom: 18 })),
    { id: "kigam-geology", kind: "overlay", available: !!keys.kigam, ...(!keys.kigam ? { reason: "missing-key" } : {}),
      attribution: "한국지질자원연구원(KIGAM) 1:5만 지질도", attributionUrl: "https://data.kigam.re.kr/", crs: "EPSG:5186" },
  ] };
}
