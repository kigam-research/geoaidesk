# Basemaps and geological overlay

GAID keeps **No basemap** as the default. It makes no online imagery requests. Local project layers remain usable
without credentials or a network connection. Online maps are display context, not analysis inputs. Unknown CRS /
pixel-coordinate views must not attach these layers; a declared, registered projected CRS is supported by OpenLayers
reprojection. A native projected CRS is not the same as an unknown pixel CRS.

## Providers

| ID | Role | Delivery / source CRS | Attribution while shown |
| --- | --- | --- | --- |
| `none` | Base, default | No requests | None |
| `osm` | Base | Browser directly to OSM standard HTTPS tiles / EPSG:3857 | © OpenStreetMap contributors, linked to copyright |
| `ngii-base` | Base | Backend NGII WMTS `korean_map` / EPSG:5179 | © 국토지리정보원(NGII) 바로e맵 |
| `ngii-satellite` | Base | Backend NGII WMTS `satellite_map` / EPSG:5179 | Same NGII credit |
| `ngii-white` | Base | Backend NGII WMTS `white_map` / EPSG:5179 | Same NGII credit |
| `kigam-geology` | Independent overlay | Backend WMS `L_50K_Geology_Map`, version 1.1.1 / EPSG:5186 | 한국지질자원연구원(KIGAM) 1:5만 지질도 |

Base layer zIndex is -200, geological overlay -100; project data stays above both. Sources use anonymous CORS so
export is not inherently canvas-tainted. Attribution is non-collapsible on OpenLayers sources and is also visible
next to the picker. The integrating viewer should retain that picker attribution and include it in exported figures.

NGII's `korean` matrix uses origin (-200000, 4000000), 256px tiles, zooms 5–18, resolution
2088.96 / 2^(z-5), and square matrix size ceil(32024123.62 / (resolution × 256)). The client grid's zero-based
zoom maps to upstream `L05` through `L18`. No invented referer is used.

KIGAM uses transparent PNG WMS GetMap, not WFS. Its client grid covers Korea in EPSG:5186
(-100000, -100000, 600000, 1000000), with 256px tiles and maximum resolution 200m/px. Each coarsest tile spans
51.2km, below the server cap of 60km per side. Width/height are integers 1–1024. No legend WFS request is ported.

## Per-user credentials

Credentials are neither bundled nor sent to the browser. Resolve each credential from the first non-empty process
environment alias, then from the first existing file below (do not merge later files):

1. `GAID_MAP_KEYS_FILE`.
2. `<GAID_HOME>/map-keys.env`, only when `GAID_HOME` is set.
3. `~/.config/map_env/map-keys.env`.

| Credential | Aliases, in priority order |
| --- | --- |
| NGII key | `GAID_NGII_API_KEY`, `NGII_API_KEY`, `NGII_KEY` |
| NGII registered application URL | `GAID_NGII_REFERER`, `NGII_REFERER`, `활용URL` |
| KIGAM key | `GAID_KIGAM_API_KEY`, `KIGAM_API_KEY`, `KIGAM_KEY` |

The app's managed `config.env` already contributes process environment values. The separate map-key file is
read-only and capped at 64KiB. Changes to file mtime/ctime/size refresh it on the next request; catalogue hooks also
refresh when the browser window regains focus. Only supported aliases are parsed; Naver and other credentials
are ignored. Quoted values, `export` and Unicode variable names are supported, without shell evaluation.
NGII without an HTTP(S) registered application URL is unavailable (`missing-referer`); without its key it reports
`missing-key`. KIGAM without a key reports `missing-key`. Availability means configured, not a successful external
health probe. Network/authentication failures still surface as failed image requests; the None option remains usable.

## Transport and bounds

- `GET /geo/basemaps`: safe provider metadata only (no keys, registered URL or upstream request URLs); no-store.
- `GET /geo/basemap/ngii/:layer/:z/:row/:col`: only the three layers and matrix-valid integer indices.
- `GET /geo/basemap/kigam?bbox=...&width=...&height=...`: finite increasing EPSG:5186 bounds, maximum span 60km
  per side, coordinates bounded to ±10,000,000m and size 1–1024px.
- Invalid input → 400; unconfigured provider → 404; upstream HTTP/network/timeout/oversize/non-image → 502.
- Global fetch uses the app's installed proxy dispatcher; timeout 20s, streamed response cap 4MiB, redirects refused.
  Only HTTPS `map.ngii.go.kr/openapi/Gettile.do` and `data.kigam.re.kr/openapi/wms` can be fetched.
- The upstream must declare an `image/*` type; the served type comes from the magic bytes (NGII PNG/JPEG — its satellite tiles are JPEG bytes labelled `image/png`; KIGAM PNG only). No upstream error body or exception URL is
  exposed or logged. The URL redaction helper removes case-insensitive `apikey` and `key` query values.
- Valid images use `Cache-Control: private, max-age=86400`. There is no persistent backend imagery cache,
  tile prefetch, retry loop, offline imagery download or shared public CDN. Ordinary browser HTTP caching remains.
- Image URLs use `API_BASE` and `withApiToken` (`kady_token`); the existing global guard/auth/CORS accepts allowed
  UI origins and query-token image loads. No project data or project query is needed.

## Terms, sources and exclusions

Source check: 2026-10-12, following the parent unit's approved provider research. These are implementation limits,
not a claim that every redistribution/proxy permission has been verified.

- [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/): browser requests directly to the
  standard endpoint, visible linked attribution, default browser caching and a valid browser referer. No bulk/offline
  prefetch or backend proxy. The hosting UI must not suppress OSM referers; no restrictive per-image referrer policy
  is introduced here. [OSM copyright](https://www.openstreetmap.org/copyright).
- [NGII API listing](https://www.data.go.kr/data/15059358/openapi.do): per-user key and registered application URL;
  NGII credit remains visible. Proxy/caching permission was not verified by the parent's research, so imagery is not
  persisted on the backend or redistributed with GAID.
- [KIGAM OpenAPI guide](https://data.kigam.re.kr/guide/openapi?lang=ko) and
  [KIGAM service answer](https://data.kigam.re.kr/share/requests/60493): WMS GetMap only; WFS is not offered.
  Per-user credentials and visible source credit; no persistent backend imagery cache. Proxy/caching permission
  remains unverified, as recorded by the parent.
- **Naver excluded:** no verified raw-tile/proxy permission; the reference called Static Map, not a tile API. Its
  [browser SDK setup](https://navermaps.github.io/maps.js.ncp/docs/tutorial-2-Getting-Started.html) exposes a client ID.
- **VWorld and Google excluded:** no credentials provided and terms not verified. No additional provider is inferred.

## Viewer integration contract

The parent unit owns `index.tsx` and `map-canvas.tsx`. It should call `useBasemapCatalog()`, hold a fresh
`{ base: "none", overlays: [] }` selection for each workspace, render `BasemapPicker`, and attach the result of
`basemapLayers(selection, providers)` only when the view has a declared, registered CRS. On selection/catalogue/view
change, remove and dispose previous layers and sources. When catalogue fetching fails, None and direct OSM remain
in the local catalogue, with a localized error. The factory does not mutate project data or map view state.

## UI state and copy changes

Every `basemap.*` string is new (before: absent). Labels, configured/unconfigured reasons, pixel-CRS limit,
network notice and catalogue failure use the Korean-first catalogues below. English preserves the same limits.
The copyright mark is stored as `&copy;` and decoded for display because the existing copy validator classifies
literal © as pictographic. The rendered attribution remains exactly ©; the shared copy policy is not changed.

| String ID | Korean after | English after |
| --- | --- | --- |
| `basemap.title` | 배경지도와 지질도 | Basemaps and geological map |
| `basemap.base` | 배경지도 | Basemap |
| `basemap.provider.none` | 배경지도 없음 | No basemap |
| `basemap.provider.osm` | OpenStreetMap | OpenStreetMap |
| `basemap.provider.ngii-base` | NGII 바로e맵 일반지도 | NGII Baro e-map standard |
| `basemap.provider.ngii-satellite` | NGII 바로e맵 영상지도 | NGII Baro e-map imagery |
| `basemap.provider.ngii-white` | NGII 바로e맵 백지도 | NGII Baro e-map white |
| `basemap.provider.kigam-geology` | KIGAM 1:5만 지질도 | KIGAM 1:50,000 geological map |
| `basemap.attribution.osm` | © OpenStreetMap contributors | © OpenStreetMap contributors |
| `basemap.attribution.ngii` | © 국토지리정보원(NGII) 바로e맵 | © National Geographic Information Institute (NGII) Baro e-map |
| `basemap.attribution.kigam-geology` | 한국지질자원연구원(KIGAM) 1:5만 지질도 | Korea Institute of Geoscience and Mineral Resources (KIGAM) 1:50,000 geological map |
| `basemap.missingKey` | 서버에 API 키가 없습니다 | No API key configured on the server |
| `basemap.missingReferer` | NGII에 등록한 활용URL이 없습니다 | No application URL registered with NGII is configured |
| `basemap.crsRequired` | 배경지도와 지질도를 표시하려면 원본 CRS가 필요합니다. 픽셀 좌표에서는 표시하지 않습니다. | Basemaps and the geological map require a declared source CRS. They are not shown in pixel coordinates. |
| `basemap.onlineNotice` | 온라인 지도는 네트워크 연결이 필요합니다. 배경지도 없음은 네트워크나 API 키 없이 사용할 수 있습니다. | Online maps require a network connection. No basemap works without a network or API key. |
| `basemap.catalogError` | 배경지도 목록을 불러오지 못했습니다. 배경지도 없음은 사용할 수 있습니다. | Could not load the basemap catalogue. No basemap remains available. |

## Verification

Focused tests cover key precedence/file reload, provider status secrecy, grid/bbox limits, allowlist/redaction,
response magic/size/error handling, query-token authentication and CORS; client tests cover projections, grids,
layer order/URLs, None/default selection, missing-configuration reasons, pixel-CRS disabling, attribution and
catalogue recovery. Exact check outcomes and live response metadata are recorded in the child task document.
The parent performs integrated viewer/browser checks and full `scripts/check`.
