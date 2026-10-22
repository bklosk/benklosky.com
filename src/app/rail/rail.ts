// Railroad radio from the home RTL-SDR: types, the site's proxy routes, and placing events on the map.
// The browser only talks to this site (/map/radio/...); the server relays to the rail hub over the VPC.

export type RailEvent = {
  clip_kind: string | null;
  speaker_role: string | null;
  addressee_role: string | null;
  event_category: string | null;
  primary_event: string | null;
  movement_state: string | null;
  direction: string | null;
  signal_indication: string | null;
  train_ref: string | null;
  train_ref_kind: string | null;
  train_railroad: string | null;
  track: string | null;
  location: string | null;
  urgency: string | null;
  confidence: number | null;
  flags: string[];
};

export type RailClip = {
  id: number;
  name: string;
  channel: string;
  freq: string | null;
  label: string;
  ts: string; // Chicago local time, ISO without offset
  t: number; // epoch ms
  duration: number | null;
  text: string;
  meaningful: boolean;
  asr_confidence: number | null;
  audio: string | null; // hub path, e.g. /audio/2026/10/22/AAR61_20261022_080934.mp3
  event: RailEvent | null;
  run_id: string | null;
};

export type RailChannel = { name: string; freq: string; label: string | null; enabled: boolean; noisy: boolean };

// Same-origin routes in src/app/map/radio/[...path]; they need the radio session cookie.
export const RAIL_BASE = "/map/radio";

export const categoryColors: Record<string, string> = {
  authority: "#8e4b3c",
  signal_route: "#2f6f8f",
  movement: "#3f6b4a",
  protection_safety: "#b8862f",
  problem_report: "#b5402a",
  status_planning: "#6b6390",
  communication: "#7d776d",
  detector: "#4f7d73",
  non_operational: "#a39e94",
};

export function humanize(value: string | null | undefined) {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const chicagoTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
const chicagoDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });

export function clipTime(clip: RailClip, withDay = false) {
  const date = new Date(clip.t);
  return withDay ? `${chicagoDay.format(date)}, ${chicagoTime.format(date)}` : chicagoTime.format(date);
}

export function summary(clip: RailClip) {
  const event = clip.event;
  if (!event) return "";
  const parts = [humanize(event.primary_event)];
  if (event.train_ref) parts.push(event.train_ref);
  if (event.track) parts.push(event.track);
  if (event.location) parts.push(`at ${event.location}`);
  return parts.filter(Boolean).join(" · ");
}

// ------------------------------------------------------------------ placing clips on the map

type Place = { name: string; lon: number; lat: number; points?: number[][] };

export type Gazetteer = { yards: Place[]; subdivisions: Place[] };

import { REGION } from "./region";

const inRegion = (place: Place) =>
  place.lon >= REGION[0] && place.lon <= REGION[2] && place.lat >= REGION[1] && place.lat <= REGION[3];

const MARKS: Record<string, string> = {
  bnsf: "BNSF", up: "UP", cn: "CN", ns: "NS", csx: "CSXT", ihb: "IHB", brc: "BRC", cpkc: "CPKC", metra: "NIRC",
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(yard|yards|sub|subdivision|district|line|street|st|avenue|ave|junction|jct|station|interlocking|cp|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Yard and subdivision centers from the BTS rail layer the map already draws. Subdivisions also keep a sample
// of their track, so a numbered street can be snapped onto the line.
export function buildGazetteer(rail: GeoJSON.FeatureCollection): Gazetteer {
  const sums = { yard: new Map<string, number[]>(), subdivision: new Map<string, number[]>() };
  const tracks = new Map<string, number[][]>();
  for (const feature of rail.features) {
    if (feature.geometry.type !== "LineString" && feature.geometry.type !== "MultiLineString") continue;
    const lines = feature.geometry.type === "LineString" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const key of ["yard", "subdivision"] as const) {
      const name = feature.properties?.[key];
      if (!name) continue;
      const sum = sums[key].get(name) ?? [0, 0, 0];
      for (const line of lines) {
        for (const [lon, lat] of line) {
          sum[0] += lon;
          sum[1] += lat;
          sum[2] += 1;
        }
        if (key === "subdivision") {
          const sample = tracks.get(name) ?? [];
          for (let i = 0; i < line.length; i += 4) sample.push(line[i]);
          tracks.set(name, sample);
        }
      }
      sums[key].set(name, sum);
    }
  }
  const places = (map: Map<string, number[]>) =>
    [...map]
      .map(([name, [lon, lat, n]]) => ({ name, lon: lon / n, lat: lat / n, points: tracks.get(name) }))
      .filter(inRegion)
      .sort((a, b) => a.name.length - b.name.length);
  return { yards: places(sums.yard), subdivisions: places(sums.subdivision) };
}

// Channels whose label names no BTS yard or subdivision: a yard to use instead, or coordinates for lines the
// freight-only rail layer leaves out (Metra Electric, South Shore, Amtrak at Union Station).
const channelOverrides: Record<string, string | [number, number]> = {
  "metra electric": [-87.5885, 41.8],
  "south shore": [-87.531, 41.648],
  "chicago rail link": [-87.63, 41.712],
  "belt railway": "CLEARING",
  amtrak: [-87.6402, 41.8789],
};

const words = (text: string) => new Set(text.split(" ").filter(Boolean));

// Railroad-qualified names first ("Chicago Sub" on a BNSF channel is CHICAGO (BNSF)), then exact names,
// then names whose every word appears as a whole word in the text.
function findPlace(text: string, gazetteer: Gazetteer, kinds: (keyof Gazetteer)[] = ["yards", "subdivisions"], context = "") {
  const raw = text.toLowerCase().replace(/[^a-z0-9& ]+/g, " ").replace(/\s+/g, " ").trim();
  const wanted = normalize(text);
  if (wanted.length < 3) return null;
  const marks = Object.entries(MARKS).filter(([key]) => new RegExp(`\\b${key}\\b`).test(context.toLowerCase())).map(([, mark]) => mark);
  for (const kind of kinds) {
    for (const mark of marks) {
      const qualified = gazetteer[kind].find((place) => place.name.toLowerCase() === `${wanted} (${mark.toLowerCase()})`);
      if (qualified) return qualified;
    }
    const exact =
      gazetteer[kind].find((place) => place.name.toLowerCase() === raw) ??
      gazetteer[kind].find((place) => normalize(place.name) === wanted && !place.name.includes("("));
    if (exact) return exact;
  }
  const have = words(wanted);
  for (const kind of kinds) {
    const partial = gazetteer[kind].find((place) => {
      const name = normalize(place.name);
      return name.length >= 4 && [...words(name)].every((word) => have.has(word));
    });
    if (partial) return partial;
  }
  return null;
}

const homeCache = new Map<string, Place | null>();

// "BNSF yard (Corwith)" → Corwith Yard; "UP road (Villa Grove Sub)" → Villa Grove Subdivision.
export function channelHome(clip: Pick<RailClip, "channel" | "label">, gazetteer: Gazetteer): Place | null {
  if (homeCache.has(clip.channel)) return homeCache.get(clip.channel)!;
  const label = clip.label.toLowerCase();
  let home: Place | null = null;
  const override = Object.entries(channelOverrides).find(([key]) => label.includes(key))?.[1];
  if (typeof override === "string") home = findPlace(override, gazetteer, ["yards"]);
  else if (override) home = { name: clip.label, lon: override[0], lat: override[1] };
  if (!home) {
    const inner = [...clip.label.matchAll(/\(([^)]+)\)/g)].flatMap((m) => m[1].split("/"));
    const candidates = [...inner, ...clip.label.split("/")].map((part) => part.replace(/\b[A-Z]{1,2}\b/g, " ").trim());
    for (const candidate of candidates) {
      home = findPlace(candidate, gazetteer, ["yards", "subdivisions"], clip.label);
      if (home) break;
    }
  }
  homeCache.set(clip.channel, home);
  return home;
}

// South-side numbered streets on the Chicago grid: Roosevelt (1200 S) and then 8 blocks to the mile.
function streetLatitude(location: string) {
  const match = location.match(/\b(\d{1,3})(?:st|nd|rd|th)\b/i);
  const number = match ? Number(match[1]) : NaN;
  return number >= 12 && number <= 140 ? 41.8674 - ((number - 12) / 8) * 0.014472 : null;
}

export type Placement = { lon: number; lat: number; exact: boolean; place: string };

function jitter(name: string, meters: number): [number, number] {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  const angle = ((hash >>> 0) % 3600) / 3600 * 2 * Math.PI;
  const radius = meters * (0.35 + (((hash >>> 12) % 1000) / 1000) * 0.65);
  return [(Math.cos(angle) * radius) / 83000, (Math.sin(angle) * radius) / 111000];
}

// Where to draw a clip: the place its event names when we can find it, otherwise around its channel's home.
export function placeClip(clip: RailClip, gazetteer: Gazetteer): Placement | null {
  const home = channelHome(clip, gazetteer);
  const location = clip.event?.location;
  if (location) {
    const yard = findPlace(location, gazetteer, ["yards"]);
    if (yard) {
      const [dx, dy] = jitter(clip.name, 250);
      return { lon: yard.lon + dx, lat: yard.lat + dy, exact: true, place: yard.name };
    }
    const lat = streetLatitude(location);
    if (lat !== null && home) {
      // On a subdivision, snap to its track at that latitude; a yard or fixed point just takes the latitude.
      const lon = home.points?.length
        ? home.points.reduce((best, point) => (Math.abs(point[1] - lat) < Math.abs(best[1] - lat) ? point : best))
        : null;
      const near = lon ? Math.abs(lon[1] - lat) < 0.01 : Math.abs(home.lat - lat) < 0.12;
      if (near) {
        const [dx, dy] = jitter(clip.name, 150);
        return { lon: (lon ? lon[0] : home.lon) + dx, lat: lat + dy, exact: true, place: location };
      }
    }
  }
  if (!home) return null;
  const [dx, dy] = jitter(clip.name, 900);
  return { lon: home.lon + dx, lat: home.lat + dy, exact: false, place: home.name };
}
