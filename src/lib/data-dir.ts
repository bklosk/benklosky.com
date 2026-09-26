import path from "node:path";

/** Server-only datasets. Lives outside `public/` so it is never served as static files. */
export const dataDir = path.join(process.cwd(), "data");

export const datasets = {
  patientProfiles: path.join(dataDir, "patient_profiles.db"),
  benchmark: path.join(dataDir, "benchmark_v1.3.db"),
} as const;
