// One shared aisstream.io connection per server process. Browsers can't hold the API key,
// so /map/ships relays this hub to each visitor as server-sent events.
import { REGION } from "./region";
import type { ShipStatus, Vessel } from "./vessel";

type Listener = (event: { vessels: Vessel[] } | { status: ShipStatus }) => void;

type Record = Omit<Vessel, "lat" | "lon"> & { lat: number | null; lon: number | null; updated: number };

const STREAM = "wss://stream.aisstream.io/v0/stream";
const MESSAGE_TYPES = [
  "PositionReport",
  "StandardClassBPositionReport",
  "ExtendedClassBPositionReport",
  "ShipStaticData",
  "StaticDataReport",
];
const STALE_MS = 30 * 60_000;
const LINGER_MS = 5 * 60_000;
const FLUSH_MS = 1_000;
const TRACK_POINTS = 40;
// Roughly 40 m. Closer fixes replace the last track point instead of adding one.
const TRACK_SPACING = 0.0004;

function clean(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.replace(/@+$/, "").trim();
  return text || null;
}

class AisHub {
  status: ShipStatus = "connecting";
  private records = new Map<number, Record>();
  private listeners = new Set<Listener>();
  private socket: WebSocket | null = null;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Set<number>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    this.lingerTimer = null;
    if (!this.socket && !this.retryTimer) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.lingerTimer = setTimeout(() => this.disconnect(), LINGER_MS);
    };
  }

  snapshot() {
    this.prune();
    return [...this.records.values()].flatMap((record) => this.publishable(record) ?? []);
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
      if (this.listeners.size === 0) return;
      // Back off to a minute. A bad key fails every attempt, so stop claiming to connect after a few.
      this.attempts += 1;
      if (this.attempts >= 4) this.setStatus("unavailable");
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.connect();
      }, Math.min(60_000, 2_000 * 2 ** this.attempts));
    };
  }

  private disconnect() {
    this.lingerTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
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
      lat: null,
      lon: null,
      course: null,
      speed: null,
      heading: null,
      status: null,
      type: null,
      destination: null,
      length: null,
      seen: 0,
      track: [],
      updated: now,
    };
    record.updated = now;
    record.name ??= clean(message.MetaData.ShipName);

    switch (message.MessageType) {
      case "ShipStaticData": {
        record.name = clean(body.Name) ?? record.name;
        record.type = body.Type || record.type;
        record.destination = clean(body.Destination);
        record.length = this.length(body.Dimension) ?? record.length;
        break;
      }
      case "StaticDataReport": {
        if (body.ReportA?.Valid) record.name = clean(body.ReportA.Name) ?? record.name;
        if (body.ReportB?.Valid) {
          record.type = body.ReportB.ShipType || record.type;
          record.length = this.length(body.ReportB.Dimension) ?? record.length;
        }
        break;
      }
      default: {
        const lat = body.Latitude;
        const lon = body.Longitude;
        if (typeof lat !== "number" || typeof lon !== "number" || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
        record.lat = lat;
        record.lon = lon;
        record.course = typeof body.Cog === "number" && body.Cog < 360 ? body.Cog : null;
        record.speed = typeof body.Sog === "number" && body.Sog < 102.3 ? body.Sog : null;
        record.heading = typeof body.TrueHeading === "number" && body.TrueHeading < 360 ? body.TrueHeading : null;
        record.status = typeof body.NavigationalStatus === "number" ? body.NavigationalStatus : record.status;
        record.seen = now;
        const last = record.track.at(-1);
        if (last && Math.hypot(last[0] - lon, last[1] - lat) < TRACK_SPACING) record.track[record.track.length - 1] = [lon, lat];
        else record.track = [...record.track, [lon, lat] as [number, number]].slice(-TRACK_POINTS);
      }
    }

    this.records.set(mmsi, record);
    this.pending.add(mmsi);
    this.flushTimer ??= setTimeout(() => this.flush(), FLUSH_MS);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private length(dimension: any) {
    const total = (dimension?.A ?? 0) + (dimension?.B ?? 0);
    return total > 0 ? total : null;
  }

  private publishable(record: Record): Vessel | null {
    if (record.lat === null || record.lon === null) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updated, ...vessel } = record;
    return { ...vessel, lat: record.lat, lon: record.lon };
  }

  private flush() {
    this.flushTimer = null;
    const vessels = [...this.pending].flatMap((mmsi) => {
      const record = this.records.get(mmsi);
      return (record && this.publishable(record)) ?? [];
    });
    this.pending.clear();
    this.prune();
    if (vessels.length === 0) return;
    for (const listener of this.listeners) listener({ vessels });
  }

  private prune() {
    const cutoff = Date.now() - STALE_MS;
    for (const [mmsi, record] of this.records) {
      if (Math.max(record.seen, record.updated) < cutoff) this.records.delete(mmsi);
    }
  }
}

// Survives hot reloads in development, so edits don't open a second upstream connection.
const globalHub = globalThis as typeof globalThis & { aisHub?: AisHub };
export const aisHub = (globalHub.aisHub ??= new AisHub());
