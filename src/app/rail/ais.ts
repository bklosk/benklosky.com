// One shared aisstream.io connection per server process. Browsers can't hold the API key,
// so /rail/ships relays this hub to each visitor as server-sent events.
// Everything on /rail runs an hour behind, so the hub keeps each vessel's recent fixes and publishes where it was
// DELAY_MS ago. It connects when the server starts (src/instrumentation.ts) and stays connected, so the delayed
// picture is already there when someone opens the page.
import { DELAY_MS } from "./delay";
import { REGION } from "./region";
import type { ShipStatus, Vessel } from "./vessel";

type Listener = (event: { vessels: Vessel[] } | { status: ShipStatus }) => void;

type Fix = Pick<Vessel, "lat" | "lon" | "course" | "speed" | "heading" | "status"> & { t: number };

type Record = Pick<Vessel, "mmsi" | "name" | "type" | "destination" | "length"> & {
  /** Positions, oldest first, kept for the delay plus the trail. */
  fixes: Fix[];
  updated: number;
  /** Time of the last fix sent to visitors. */
  published: number;
  /** Static data changed since the last publish. */
  dirty: boolean;
};

const STREAM = "wss://stream.aisstream.io/v0/stream";
const MESSAGE_TYPES = [
  "PositionReport",
  "StandardClassBPositionReport",
  "ExtendedClassBPositionReport",
  "ShipStaticData",
  "StaticDataReport",
];
// In delayed time: a vessel is shown for 30 minutes after its last position, with up to an hour of trail.
const STALE_MS = 30 * 60_000;
const TRAIL_MS = 60 * 60_000;
const KEEP_MS = DELAY_MS + TRAIL_MS;
const FLUSH_MS = 2_000;
const TRACK_POINTS = 40;
// Roughly 40 m. Closer fixes replace the last track point instead of adding one.
const TRACK_SPACING = 0.0004;
// A vessel that hasn't moved keeps one fix every 30 seconds.
const FIX_EVERY_MS = 30_000;

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.replace(/@+$/, "").trim();
  return text || null;
}

// Index of the last fix at or before t, or -1.
function fixAt(fixes: Fix[], t: number) {
  let low = 0;
  let high = fixes.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (fixes[middle].t <= t) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}

class AisHub {
  status: ShipStatus = "connecting";
  private records = new Map<number, Record>();
  private listeners = new Set<Listener>();
  private socket: WebSocket | null = null;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (!this.socket && !this.retryTimer) this.connect();
    this.flushTimer ??= setInterval(() => this.flush(), FLUSH_MS);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Every vessel as it was DELAY_MS ago.
  snapshot() {
    this.prune();
    const now = Date.now() - DELAY_MS;
    return [...this.records.values()].flatMap((record) => {
      const vessel = this.publishable(record, now);
      return vessel && vessel.seen >= now - STALE_MS ? [vessel] : [];
    });
  }

  private connect() {
    const key = process.env.AISSTREAM_API_KEY;
    if (!key || typeof WebSocket === "undefined") return this.setStatus("unavailable");
    this.setStatus("connecting");
    const socket = new WebSocket(STREAM);
    this.socket = socket;
    socket.onopen = () => {
      // aisstream closes connections that don't subscribe within a few seconds.
      const [west, south, east, north] = REGION;
      socket.send(
        JSON.stringify({
          APIKey: key,
          BoundingBoxes: [[[south, west], [north, east]]],
          FilterMessageTypes: MESSAGE_TYPES,
        }),
      );
    };
    socket.onmessage = async (event) => {
      const text = typeof event.data === "string" ? event.data : await new Response(event.data).text();
      try {
        this.handle(JSON.parse(text));
      } catch {
        // Skip malformed frames.
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      // Back off to a minute. A bad key fails every attempt, so stop claiming to connect after a few.
      this.attempts += 1;
      if (this.attempts >= 4) this.setStatus("unavailable");
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.connect();
      }, Math.min(60_000, 2_000 * 2 ** this.attempts));
    };
  }

  private setStatus(status: ShipStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.listeners) listener({ status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handle(message: any) {
    if (message.MessageType === "SubscriptionConfirmation") {
      this.attempts = 0;
      return this.setStatus("live");
    }
    const mmsi = Number(message.MetaData?.MMSI);
    const body = message.Message?.[message.MessageType];
    if (!mmsi || !body) return;
    this.setStatus("live");
    this.attempts = 0;

    const now = Date.now();
    const record = this.records.get(mmsi) ?? {
      mmsi,
      name: null,
      type: null,
      destination: null,
      length: null,
      fixes: [],
      updated: now,
      published: 0,
      dirty: false,
    };
    record.updated = now;
    const named = record.name;
    record.name ??= clean(message.MetaData.ShipName);

    switch (message.MessageType) {
      case "ShipStaticData": {
        record.name = clean(body.Name) ?? record.name;
        record.type = body.Type || record.type;
        record.destination = clean(body.Destination);
        record.length = this.length(body.Dimension) ?? record.length;
        record.dirty = true;
        break;
      }
      case "StaticDataReport": {
        if (body.ReportA?.Valid) record.name = clean(body.ReportA.Name) ?? record.name;
        if (body.ReportB?.Valid) {
          record.type = body.ReportB.ShipType || record.type;
          record.length = this.length(body.ReportB.Dimension) ?? record.length;
        }
        record.dirty = true;
        break;
      }
      default: {
        const lat = body.Latitude;
        const lon = body.Longitude;
        if (typeof lat !== "number" || typeof lon !== "number" || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        const last = record.fixes.at(-1);
        // Thin the history: a fix that neither moved nor waited long adds nothing to the delayed picture.
        if (last && Math.hypot(last.lon - lon, last.lat - lat) < TRACK_SPACING && now - last.t < FIX_EVERY_MS) break;
        record.fixes.push({
          t: now,
          lat,
          lon,
          course: typeof body.Cog === "number" && body.Cog < 360 ? body.Cog : null,
          speed: typeof body.Sog === "number" && body.Sog < 102.3 ? body.Sog : null,
          heading: typeof body.TrueHeading === "number" && body.TrueHeading < 360 ? body.TrueHeading : null,
          status: typeof body.NavigationalStatus === "number" ? body.NavigationalStatus : (last?.status ?? null),
        });
      }
    }
    if (record.name !== named) record.dirty = true;
    this.records.set(mmsi, record);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private length(dimension: any) {
    const total = (dimension?.A ?? 0) + (dimension?.B ?? 0);
    return total > 0 ? total : null;
  }

  // The vessel as it was at time t, with the trail that led there.
  private publishable(record: Record, t: number): Vessel | null {
    const index = fixAt(record.fixes, t);
    if (index < 0) return null;
    const fix = record.fixes[index];
    let track: [number, number][] = [];
    for (let i = 0; i <= index; i++) {
      const { lon, lat, t: at } = record.fixes[i];
      if (at < t - TRAIL_MS) continue;
      const last = track.at(-1);
      if (last && Math.hypot(last[0] - lon, last[1] - lat) < TRACK_SPACING) track[track.length - 1] = [lon, lat];
      else track.push([lon, lat]);
    }
    track = track.slice(-TRACK_POINTS);
    return {
      mmsi: record.mmsi,
      name: record.name,
      type: record.type,
      destination: record.destination,
      length: record.length,
      lat: fix.lat,
      lon: fix.lon,
      course: fix.course,
      speed: fix.speed,
      heading: fix.heading,
      status: fix.status,
      seen: fix.t,
      track,
    };
  }

  // Sends every vessel whose delayed position or static data changed since the last flush.
  private flush() {
    this.prune();
    if (this.listeners.size === 0) return;
    const now = Date.now() - DELAY_MS;
    const vessels: Vessel[] = [];
    for (const record of this.records.values()) {
      const index = fixAt(record.fixes, now);
      if (index < 0) continue;
      const seen = record.fixes[index].t;
      if (seen === record.published && !record.dirty) continue;
      record.published = seen;
      record.dirty = false;
      const vessel = this.publishable(record, now);
      if (vessel) vessels.push(vessel);
    }
    if (vessels.length === 0) return;
    for (const listener of this.listeners) listener({ vessels });
  }

  private prune() {
    const cutoff = Date.now() - KEEP_MS;
    for (const [mmsi, record] of this.records) {
      const keep = record.fixes.findIndex((fix) => fix.t >= cutoff);
      if (keep > 0) record.fixes.splice(0, keep);
      else if (keep < 0) record.fixes.length = 0;
      if (record.fixes.length === 0 && record.updated < cutoff) this.records.delete(mmsi);
    }
  }
}

// Survives hot reloads in development, so edits don't open a second upstream connection.
const globalHub = globalThis as typeof globalThis & { aisHub?: AisHub };
export const aisHub = (globalHub.aisHub ??= new AisHub());
