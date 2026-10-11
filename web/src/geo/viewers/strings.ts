import { defineGeoStrings } from "../i18n";
export const inspectionText = defineGeoStrings({
  ko: {
    loading: "파일 정보를 읽고 있습니다…", failed: "파일 정보를 읽지 못했습니다", retry: "다시 시도",
    format: "형식", size: "크기", bytes: "{size} 바이트", crs: "좌표계", unknown: "알 수 없음", declared: "파일에 선언됨", "user-supplied": "사용자 지정", conflicting: "선언이 서로 다름",
    extent: "범위", coordinateSpace: "좌표 공간", crsSpace: "좌표계 단위", pixel: "픽셀", native: "원본 좌표",
    layers: "레이어", fields: "필드", count: "피처 수", bands: "밴드", dimensions: "차원", curves: "곡선", unit: "단위", depth: "심도", basis: "심도 기준", datum: "기준면", start: "시작", stop: "끝", step: "간격",
    missing: "누락된 동반 파일", issues: "확인할 사항", preview: "제한된 미리보기", sampled: "일부 자료만 표시", truncated: "제한에 도달함", yes: "예", no: "아니요", rows: "표시한 행", sourceRows: "원본 행 수 또는 추정치", method: "읽기 방법", headers: "헤더", inspector: "검사기", sources: "원본 파일", columns: "열", fingerprint: "크기·수정 시각 기반 캐시 키입니다. 내용 해시가 아닙니다.", imaging: "지리 참조가 없는 TIFF입니다. 영상 뷰어로 표시합니다.", genericError: "요청을 처리하지 못했습니다.", nodata: "결측값", description: "설명",
  },
  en: {
    loading: "Reading file metadata…", failed: "Could not inspect file", retry: "Retry",
    format: "Format", size: "Size", bytes: "{size} bytes", crs: "CRS", unknown: "Unknown", declared: "Declared in file", "user-supplied": "User supplied", conflicting: "Conflicting declarations",
    extent: "Extent", coordinateSpace: "Coordinate space", crsSpace: "CRS units", pixel: "Pixel", native: "Native coordinates",
    layers: "Layers", fields: "Fields", count: "Feature count", bands: "Bands", dimensions: "Dimensions", curves: "Curves", unit: "Unit", depth: "Depth", basis: "Depth basis", datum: "Datum", start: "Start", stop: "Stop", step: "Step",
    missing: "Missing companions", issues: "Issues", preview: "Bounded preview", sampled: "Sampled", truncated: "Truncated", yes: "Yes", no: "No", rows: "Displayed rows", sourceRows: "Source rows or estimate", method: "Read method", headers: "Headers", inspector: "Inspector", sources: "Source files", columns: "Columns", fingerprint: "Cache key from size and modification time, not a content hash.", imaging: "TIFF has no georeference tags. Showing the imaging viewer.", genericError: "The request could not be completed.", nodata: "No data", description: "Description",
  },
});
