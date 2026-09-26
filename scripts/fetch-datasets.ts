import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const commit = "b047385ae138566c891b7786c0fa9a78e6b5700a";

const datasets = [
  { name: "patient_profiles.db", bytes: 18_526_208 },
  { name: "benchmark_v1.3.db", bytes: 92_430_336 },
] as const;

function datasetUrl(name: string) {
  return `https://raw.githubusercontent.com/sparkcpark/synthetic_hospital/${commit}/${name}`;
}

function isNotFound(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function fileSize(filePath: string) {
  try {
    const info = await stat(filePath);
    return info.isFile() ? info.size : null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function download(name: string, destination: string, expectedBytes: number) {
  const response = await fetch(datasetUrl(name));
  if (!response.ok) {
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== expectedBytes) {
    throw new Error(`${name} is ${bytes.byteLength} bytes, expected ${expectedBytes}`);
  }
  if (bytes.subarray(0, 15).toString("utf8") !== "SQLite format 3") {
    throw new Error(`${name} is not a SQLite database`);
  }

  const partial = `${destination}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, destination);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  await mkdir(dataDir, { recursive: true });

  for (const dataset of datasets) {
    const destination = path.join(dataDir, dataset.name);
    const size = await fileSize(destination);
    if (size === dataset.bytes) {
      console.log(`${dataset.name} ok (${size} bytes)`);
      continue;
    }

    if (checkOnly) {
      throw new Error(
        `${dataset.name} is ${size ?? "missing"}, expected ${dataset.bytes} bytes`,
      );
    }

    console.log(`Downloading ${dataset.name}...`);
    await download(dataset.name, destination, dataset.bytes);
    console.log(`Saved ${dataset.name} (${dataset.bytes} bytes)`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
