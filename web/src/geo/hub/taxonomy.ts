/**
 * Display labels of the Atlas task terms (generated from geo/hub/taxonomy/tasks.yaml): researcher views show these
 * labels, never the English ids (UI guide R1). Unknown ids are not shown.
 */
import type { MethodText } from "@/geo/contracts/authoring";

export const TASK_LABELS: Record<string, MethodText> = {
  "data-discovery": {
    ko: "자료 찾기",
    en: "Data discovery",
  },
  acquisition: {
    ko: "자료 수집·접근",
    en: "Acquisition and access",
  },
  "data-qc": {
    ko: "자료 QC",
    en: "Data QC",
  },
  "spatial-transform": {
    ko: "공간 변환·정합",
    en: "Spatial transformation",
  },
  interpretation: {
    ko: "해석",
    en: "Interpretation",
  },
  modeling: {
    ko: "모델링",
    en: "Modelling",
  },
  simulation: {
    ko: "시뮬레이션",
    en: "Simulation",
  },
  inversion: {
    ko: "역산",
    en: "Inversion",
  },
  calibration: {
    ko: "보정",
    en: "Calibration",
  },
  uncertainty: {
    ko: "불확실성",
    en: "Uncertainty",
  },
  "spatial-validation": {
    ko: "공간 검증",
    en: "Spatial validation",
  },
  visualization: {
    ko: "시각화",
    en: "Visualisation",
  },
  reporting: {
    ko: "보고서",
    en: "Reporting",
  },
};
