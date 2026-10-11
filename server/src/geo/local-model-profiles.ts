export const MIN_LOCAL_CONTEXT = 65_536;

/** Evidence labels are part of the profile: these are not hardware guarantees. */
export const LOCAL_MODEL_PROFILES = [
  {
    id: "recorded-96k", contextWindow: 98_304, evidence: "recorded-trial",
    model: "qwen3:30b-a3b-instruct-2507-q4_K_M",
    hardware: "RTX 4090 24 GB", cpuOffloadPercent: 18, peakContextPercent: 89.9,
    trialDate: "2026-10-10", machines: 1,
  },
  { id: "proposed-64k", contextWindow: MIN_LOCAL_CONTEXT, evidence: "proposed-not-tested" },
] as const;
