export const MIN_LOCAL_CONTEXT = 65_536;

/**
 * Evidence labels are part of the profile: these are not hardware guarantees.
 * `releaseTrial` is the WP10 real-task trial (geo/compatibility.json routes
 * local-ollama-qwen3-30b-{64k,98k}); task outcomes are per catalogue workflow.
 */
export const LOCAL_MODEL_PROFILES = [
  {
    id: "recorded-96k", contextWindow: 98_304, evidence: "recorded-trial",
    model: "qwen3:30b-a3b-instruct-2507-q4_K_M",
    hardware: "RTX 4090 24 GB", cpuOffloadPercent: 18, peakContextPercent: 89.9,
    trialDate: "2026-10-10", machines: 1,
    releaseTrial: {
      date: "2026-10-11", appVersion: "0.1.0", connection: "passed", cpuOffloadPercent: 18,
      tasks: { "well-log-qc": "partial", "geo-map-and-crs": "passed" },
    },
  },
  {
    id: "proposed-64k", contextWindow: MIN_LOCAL_CONTEXT, evidence: "recorded-trial",
    model: "qwen3:30b-a3b-instruct-2507-q4_K_M", hardware: "RTX 4090 24 GB", machines: 1,
    releaseTrial: {
      date: "2026-10-11", appVersion: "0.1.0", connection: "passed", cpuOffloadPercent: 7,
      tasks: { "well-log-qc": "partial", "geo-map-and-crs": "partial" },
    },
  },
] as const;
