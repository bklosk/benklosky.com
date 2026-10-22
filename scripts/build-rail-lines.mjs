// Usage: node scripts/build-rail-lines.mjs
// Snapshots freight rail around Chicago from the BTS North American Rail Network into public/rail.
// Track used only by passenger operators (Metra, South Shore, Amtrak, CTA) is dropped.
import { writeFile } from "node:fs/promises";

const service =
  "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0/query";
// [west, south, east, north]. Keep in step with REGION in src/app/rail/region.ts.
const bbox = [-89.2, 40.9, -86.2, 43.2];
const output = "public/rail/rail-lines.geojson";

// Main, other, yard, industry, and siding track. Skips abandoned (A), railbanked (R),
// out of service (X), and transit (T) segments.
const activeNetworks = new Set(["M", "O", "Y", "I", "S"]);
const passengerOperators = new Set(["NIRC", "NICD", "AMTK", "CTA", "METX", "XXXX"]);
const ownerFields = ["RROWNER1", "RROWNER2", "RROWNER3"];
const rightsFields = Array.from({ length: 9 }, (_, index) => `TRKRGHTS${index + 1}`);

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: "1=1",
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: [...ownerFields, ...rightsFields, "SUBDIV", "YARDNAME", "NET", "TRACKS"].join(","),
    outSR: "4326",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: "2000",
    f: "geojson",
  });
  const response = await fetch(`${service}?${params}`);
  if (!response.ok) throw new Error(`BTS returned ${response.status}`);
  return response.json();
}

const raw = [];
for (let offset = 0; ; ) {
  const page = await fetchPage(offset);
  raw.push(...page.features);
  offset += page.features.length;
  if (!page.properties?.exceededTransferLimit || page.features.length === 0) break;
}

const round = (value) => Math.round(value * 1e5) / 1e5;
const features = [];
for (const feature of raw) {
  const p = feature.properties;
  if (!activeNetworks.has(p.NET) || feature.geometry?.type !== "LineString") continue;
  const owners = ownerFields.map((field) => p[field]).filter(Boolean);
  // Trackage rights fields sometimes hold several space-separated marks.
  const rights = rightsFields.flatMap((field) => (p[field] ?? "").split(/\s+/)).filter(Boolean);
  const freight = [...new Set([...owners, ...rights])].filter((mark) => !passengerOperators.has(mark));
  if (freight.length === 0) continue;
  features.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates: feature.geometry.coordinates.map(([x, y]) => [round(x), round(y)]) },
    properties: {
      owner: owners[0] ?? null,
      freight: freight.join(" "),
      subdivision: p.SUBDIV ?? null,
      yard: p.YARDNAME ?? null,
      network: p.NET,
      tracks: p.TRACKS ?? null,
    },
  });
}

await writeFile(
  output,
  JSON.stringify({
    type: "FeatureCollection",
    source: "BTS NTAD North American Rail Network Lines",
    retrieved: new Date().toISOString().slice(0, 10),
    bbox,
    features,
  }),
);
console.log(`Kept ${features.length} of ${raw.length} segments in ${output}.`);
