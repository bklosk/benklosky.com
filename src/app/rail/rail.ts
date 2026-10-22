// Railroad radio from the home RTL-SDR: types, the site's proxy routes, placing events on the map, and trains.
// The browser only talks to this site (/rail/radio/...); the server relays to the rail hub over the VPC.
import { chicagoMs } from "./delay";

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
  /** Ontology 2026-10-22b: a public road crossing's state, and the effect on train service. Null on older clips. */
  crossing_status?: string | null;
  service_impact?: string | null;
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

export type RailRunEvent = {
  ts: string | null;
  clip_name: string | null;
  event: string | null;
  detail: string | null;
  /** The transmission's clip kind and flags from Jev, so private ones can be left out. */
  clip_kind?: string | null;
  flags?: string[];
};

// One of Luna's runs: a train, job or work authority on one channel in one half-hour window. run_id carries over
// between windows while the run continues.
export type RailRun = {
  channel: string;
  label: string;
  window_start: string;
  run_id: string;
  train_ref: string | null;
  kind: string | null;
  railroad: string | null;
  service: string | null;
  direction: string | null;
  crew_roles: string[];
  first_seen: string | null;
  last_seen: string | null;
  locations: string[];
  tracks: string[];
  authorities: string[];
  issues: string[];
  status_at_end: string | null;
  narrative: string | null;
  confidence: string | null;
  /** The Metra GTFS trip the train number matched on the hub (gtfs.py), for scheduled passenger trains. */
  gtfs_trip: string | null;
  timeline: RailRunEvent[];
};

/** [name, lon, lat, arrival, departure], times in seconds after the service day's midnight. */
export type MetraStop = [string, number, number, number, number];

// A trip from Metra's published GTFS schedule, as the hub's /api/rail/metra serves it.
export type MetraTrip = {
  trip_id: string;
  route: string;
  route_name: string;
  color: string | null;
  train: string;
  headsign: string;
  direction: number;
  stops: MetraStop[];
  shape: [number, number][];
};

// Same-origin routes in src/app/rail/radio/[...path].
export const RAIL_BASE = "/rail/radio";

// Police and EMS radio isn't published: Amtrak Police at Union Station (AAR17), outside agencies heard on railroad
// channels, and anything Jev flags as sensitive (a member of the public's medical call, police contact, age, address
// or phone number). The relay drops these before anything reaches a browser.
const PRIVATE_CHANNELS = new Set(["AAR17"]);
const PRIVATE_KINDS = new Set(["police_security", "non_rail"]);

export function isPrivate(channel: string, clipKind: string | null | undefined, flags: string[] | null | undefined) {
  return PRIVATE_CHANNELS.has(channel) || PRIVATE_KINDS.has(clipKind ?? "") || Boolean(flags?.includes("sensitive"));
}

export const isPrivateClip = (clip: Pick<RailClip, "channel" | "event">) =>
  isPrivate(clip.channel, clip.event?.clip_kind, clip.event?.flags);

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
  // No new hue stays apart from the nine above, so the two newer categories share the closest one in meaning.
  crossing: "#b5402a",
  passenger_station: "#6b6390",
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

export function clipTime(clip: Pick<RailClip, "t">, withDay = false) {
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

const placeCache = new Map<string, Place | null>();

// Trains look up the same few places on every update, so remember the answers.
function findPlace(text: string, gazetteer: Gazetteer, kinds: (keyof Gazetteer)[] = ["yards", "subdivisions"], context = "") {
  const key = `${kinds.join()}|${context}|${text}`;
  if (!placeCache.has(key)) placeCache.set(key, searchPlace(text, gazetteer, kinds, context));
  return placeCache.get(key)!;
}

// Railroad-qualified names first ("Chicago Sub" on a BNSF channel is CHICAGO (BNSF)), then exact names,
// then names whose every word appears as a whole word in the text.
function searchPlace(text: string, gazetteer: Gazetteer, kinds: (keyof Gazetteer)[], context: string) {
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

// Where a named location is, when we can tell: a yard, or a numbered street on the channel's line.
// seed spreads out things at the same place.
function placeLocation(location: string, home: Place | null, gazetteer: Gazetteer, seed: string): Placement | null {
  const yard = findPlace(location, gazetteer, ["yards"]);
  if (yard) {
    const [dx, dy] = jitter(seed, 250);
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
      const [dx, dy] = jitter(seed, 150);
      return { lon: (lon ? lon[0] : home.lon) + dx, lat: lat + dy, exact: true, place: location };
    }
  }
  return null;
}

// Where to draw a clip: the place its event names when we can find it, otherwise around its channel's home.
export function placeClip(clip: RailClip, gazetteer: Gazetteer): Placement | null {
  const home = channelHome(clip, gazetteer);
  const location = clip.event?.location;
  const exact = location ? placeLocation(location, home, gazetteer, clip.name) : null;
  if (exact) return exact;
  if (!home) return null;
  const [dx, dy] = jitter(clip.name, 900);
  return { lon: home.lon + dx, lat: home.lat + dy, exact: false, place: home.name };
}

// ------------------------------------------------------------------ trains, from Luna's runs

export type TrainGroup = "passenger" | "freight" | "work" | "other";

// Colored by what a train is, not by railroad: on a map any two can sit side by side, and only about three hues
// stay apart for every pair (checked with the dataviz palette validator against palette.land). Gray is unknown.
// The number on the badge says which train it is.
export const trainColors: Record<TrainGroup, string> = {
  passenger: "#2e6fc0",
  freight: "#d45a2a",
  work: "#1a9a6c",
  other: "#7d776d",
};

export const trainGroupLabels: Record<TrainGroup, string> = {
  passenger: "Passenger",
  freight: "Freight",
  work: "Track work",
  other: "Train",
};

export type TrainStop = {
  t: number;
  clip: RailClip | null;
  event: string | null;
  detail: string | null;
  /** Where this transmission puts the train, when it names a place we can find. */
  place: Placement | null;
};

export type Train = {
  key: string;
  channel: string;
  label: string;
  name: string;
  badge: string;
  group: TrainGroup;
  service: string | null;
  direction: string | null;
  /** Luna's last word on the run; empty while the delay line is still inside its window. */
  status: string | null;
  confidence: string | null;
  /** Every transmission in the run, oldest first. */
  stops: TrainStop[];
  last: number;
  /** The last place it was heard, or near its channel's home (not exact) when it never named one. */
  position: Placement;
  /** For a Metra train Luna's number matched in the GTFS schedule: its trip, and how late the radio has it. */
  schedule: TrainSchedule | null;
};

export type TrainSchedule = {
  trip: MetraTrip;
  /** Epoch ms of the service day's midnight. */
  base: number;
  /** How late it ran at the last stop a transmission placed it at, in ms; 0 when none did. */
  late: number;
  /** Indexes of trip stops the radio placed it at, with when. */
  heard: { stop: number; t: number }[];
};

const known = (value: string | null | undefined) => (value && value !== "unknown" && value !== "none" ? value : null);

function trainGroup(run: Pick<RailRun, "service" | "kind" | "railroad">): TrainGroup {
  if (run.service === "passenger") return "passenger";
  if (run.service === "mow_work" || run.kind === "work_equipment") return "work";
  if (known(run.service) || run.kind === "yard_job") return "freight";
  if (/metra|south shore|nictd|amtrak/i.test(run.railroad ?? "")) return "passenger";
  return "other";
}

// "Metra 320" → "320", "Foreman 2150" → "2150", "29T" → "29T", "Coolway" → "Coolway".
function trainBadge(ref: string | null) {
  const id = ref?.match(/\b[A-Z]{0,3}\d+[A-Z]{0,2}\b/i)?.[0];
  if (id) return id.toUpperCase();
  const word = known(ref)?.trim().split(/\s+/)[0] ?? "";
  return word && word.length <= 10 ? word.charAt(0).toUpperCase() + word.slice(1) : "?";
}

function trainName(run: Pick<RailRun, "train_ref" | "railroad" | "service">) {
  const railroad = known(run.railroad);
  const ref = known(run.train_ref);
  if (ref && railroad && ref.toLowerCase().includes(railroad.toLowerCase())) return ref;
  if (ref) return railroad ? `${railroad} ${ref}` : ref;
  return `${railroad ?? "Unidentified"} ${humanize(known(run.service) ?? "train").toLowerCase()}`;
}

// ------------------------------------------------------------------ Metra trains on their GTFS trips

const meters = (a: [number, number], b: [number, number]) =>
  Math.hypot((b[0] - a[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (b[1] - a[1]) * 110540);

// The trip stop a placed transmission names: "91st Street" is 91st St., otherwise the nearest stop within a km.
function tripStop(trip: MetraTrip, place: Placement) {
  const ordinal = place.place.match(/\b\d{1,3}(?:st|nd|rd|th)\b/i)?.[0];
  if (ordinal) {
    const named = new RegExp(`\\b${ordinal}\\b`, "i");
    const index = trip.stops.findIndex(([name]) => named.test(name));
    return index >= 0 ? index : null;
  }
  let best: number | null = null;
  let bestMeters = 1000;
  trip.stops.forEach(([, lon, lat], index) => {
    const distance = meters([lon, lat], [place.lon, place.lat]);
    if (distance < bestMeters) [best, bestMeters] = [index, distance];
  });
  return best;
}

function trainSchedule(trip: MetraTrip, day: string, stops: TrainStop[]): TrainSchedule {
  const base = chicagoMs(`${day}T00:00:00`);
  const heard: TrainSchedule["heard"] = [];
  let late = 0;
  for (const stop of stops) {
    if (!stop.place) continue;
    const index = tripStop(trip, stop.place);
    if (index === null) continue;
    const off = stop.t - (base + trip.stops[index][3] * 1000);
    // A match this far off the timetable is a different stop with the same name, or a misplaced transmission.
    if (off < -15 * 60_000 || off > 45 * 60_000) continue;
    heard.push({ stop: index, t: stop.t });
    late = off;
  }
  return { trip, base, late, heard };
}

type Geometry = { points: [number, number][]; along: number[]; stops: number[] };
const geometries = new WeakMap<MetraTrip, Geometry>();

// The trip's shape, oriented from its first stop, with each stop's distance along it.
function geometry(trip: MetraTrip): Geometry {
  const cached = geometries.get(trip);
  if (cached) return cached;
  const first: [number, number] = [trip.stops[0][1], trip.stops[0][2]];
  let points: [number, number][] = trip.shape.length > 1 ? trip.shape : trip.stops.map(([, lon, lat]) => [lon, lat]);
  if (meters(points[0], first) > meters(points[points.length - 1], first)) points = [...points].reverse();
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + meters(points[i - 1], points[i]));
  let from = 0;
  const stops = trip.stops.map(([, lon, lat]) => {
    let best = from;
    for (let i = from; i < points.length; i++) if (meters(points[i], [lon, lat]) < meters(points[best], [lon, lat])) best = i;
    from = best;
    return along[best];
  });
  const result = { points, along, stops };
  geometries.set(trip, result);
  return result;
}

export type ScheduledPosition = {
  lon: number;
  lat: number;
  state: "waiting" | "running" | "arrived";
  /** The shape from the trip's origin to here. */
  path: [number, number][];
  /** The next stop and when the train should reach it, late included. */
  next: { name: string; t: number } | null;
};

// Where a scheduled train is at time t: along its shape, between the stops its timetable (shifted by how late
// the radio has it) puts it between.
export function scheduledPosition(schedule: TrainSchedule, t: number): ScheduledPosition {
  const { trip, base, late } = schedule;
  const { points, along, stops } = geometry(trip);
  const clock = (t - late - base) / 1000;
  const last = trip.stops.length - 1;
  let reached = 0;
  while (reached < last && trip.stops[reached + 1][3] <= clock) reached++;
  let distance = stops[reached];
  let state: ScheduledPosition["state"] = "running";
  if (clock < trip.stops[0][4]) state = "waiting";
  else if (reached === last) state = "arrived";
  else if (clock > trip.stops[reached][4]) {
    const [, , , , leave] = trip.stops[reached];
    const arrive = trip.stops[reached + 1][3];
    distance += (stops[reached + 1] - stops[reached]) * Math.min(1, (clock - leave) / Math.max(1, arrive - leave));
  }
  let segment = 0;
  while (segment < along.length - 2 && along[segment + 1] < distance) segment++;
  const span = along[segment + 1] - along[segment] || 1;
  const f = Math.max(0, Math.min(1, (distance - along[segment]) / span));
  const a = points[segment];
  const b = points[Math.min(segment + 1, points.length - 1)];
  const here: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const upcoming = state === "waiting" ? 0 : reached < last ? reached + 1 : null;
  return {
    lon: here[0],
    lat: here[1],
    state,
    path: [...points.slice(0, segment + 1), here],
    next: upcoming === null ? null : { name: trip.stops[upcoming][0], t: base + late + trip.stops[upcoming][3] * 1000 },
  };
}

// Luna's runs for one channel, merged across windows by run_id into trains. Each transmission is placed by the
// location Jev read from it, or by one of the run's locations that Luna's note on it mentions. A Metra train whose
// number the hub matched in the GTFS schedule also gets its trip.
export function buildTrains(
  runs: RailRun[],
  clips: Map<string, RailClip>,
  gazetteer: Gazetteer,
  trips: Map<string, MetraTrip> = new Map(),
): Train[] {
  const byKey = new Map<string, RailRun[]>();
  for (const run of runs) {
    const key = `${run.channel}|${run.run_id}`;
    byKey.set(key, [...(byKey.get(key) ?? []), run]);
  }
  const trains: Train[] = [];
  for (const [key, windows] of byKey) {
    windows.sort((a, b) => a.window_start.localeCompare(b.window_start));
    const latest = windows[windows.length - 1];
    const home = channelHome(latest, gazetteer);
    const seen = new Set<string>();
    const stops: TrainStop[] = [];
    for (const run of windows) {
      for (const entry of run.timeline) {
        const id = entry.clip_name ?? entry.ts;
        if (!entry.ts || !id || seen.has(id)) continue;
        seen.add(id);
        const clip = entry.clip_name ? (clips.get(entry.clip_name) ?? null) : null;
        const said = words(normalize(entry.detail ?? ""));
        const mentioned = run.locations.filter((location) => {
          const needed = [...words(normalize(location))];
          return needed.length > 0 && needed.every((word) => said.has(word));
        });
        let place: Placement | null = null;
        for (const location of [clip?.event?.location, ...mentioned]) {
          place = location ? placeLocation(location, home, gazetteer, key) : null;
          if (place) break;
        }
        stops.push({ t: clip?.t ?? chicagoMs(entry.ts), clip, event: entry.event, detail: entry.detail, place });
      }
    }
    stops.sort((a, b) => a.t - b.t);
    if (!stops.length) continue;
    let position = stops.findLast((stop) => stop.place)?.place ?? null;
    if (!position) {
      if (!home) continue;
      const [dx, dy] = jitter(key, 900);
      position = { lon: home.lon + dx, lat: home.lat + dy, exact: false, place: home.name };
    }
    // A later window may not repeat what an earlier one worked out.
    const pick = (field: "train_ref" | "railroad" | "service" | "direction" | "kind") =>
      windows.map((run) => known(run[field])).findLast(Boolean) ?? null;
    const identity = { train_ref: pick("train_ref"), railroad: pick("railroad"), service: pick("service"), kind: pick("kind") };
    const scheduledRun = windows.findLast((run) => run.gtfs_trip && trips.has(run.gtfs_trip));
    const trip = scheduledRun ? trips.get(scheduledRun.gtfs_trip!)! : null;
    trains.push({
      key,
      channel: latest.channel,
      label: latest.label,
      name: trip ? `${trip.route_name} ${trip.train}` : trainName(identity),
      badge: trainBadge(identity.train_ref),
      group: trainGroup(identity),
      service: identity.service,
      direction: pick("direction"),
      status: latest.status_at_end,
      confidence: latest.confidence,
      stops,
      last: stops[stops.length - 1].t,
      position,
      schedule: trip && scheduledRun ? trainSchedule(trip, scheduledRun.window_start.slice(0, 10), stops) : null,
    });
  }
  return trains;
}
