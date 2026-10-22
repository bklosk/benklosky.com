"use client";

// One connection to the rail hub shared by the map layer and the history table. Everything the server sends is
// already an hour old (see delay.ts).
import { useSyncExternalStore } from "react";
import { chicagoIso, delayedNow } from "./delay";
import { RAIL_BASE, type MetraTrip, type RailChannel, type RailClip, type RailIncident, type RailRun } from "./rail";

export type RailFilters = { q: string; channel: string; eventsOnly: boolean };

type RailState = {
  status: "off" | "probing" | "on" | "unreachable";
  base: string;
  channels: RailChannel[];
  history: RailClip[]; // newest first, filtered
  more: string | null; // cursor for older clips
  loading: boolean;
  clips: Map<string, RailClip>; // the map's last few hours of meaningful clips, unfiltered
  runs: RailRun[]; // Luna's runs over the same hours
  trips: Map<string, MetraTrip>; // Metra GTFS trips those runs matched
  incidents: RailIncident[]; // road-crossing incidents over the same hours
  selected: string | null;
  selectedAt: number;
  filters: RailFilters;
};

const HORIZON_MS = 3 * 60 * 60_000;
// The hub's runs route counts hours back from real time; this covers the horizon behind the delay line.
const RUN_HOURS = 5;
const RUNS_EVERY_MS = 60_000;
const PAGE = 100;

let state: RailState = {
  status: "off",
  base: "",
  channels: [],
  history: [],
  more: null,
  loading: false,
  clips: new Map(),
  runs: [],
  trips: new Map(),
  incidents: [],
  selected: null,
  selectedAt: 0,
  filters: { q: "", channel: "", eventsOnly: false },
};
const listeners = new Set<() => void>();
const clipListeners = new Set<(clip: RailClip) => void>();
let stream: EventSource | null = null;
let runsTimer: ReturnType<typeof setInterval> | undefined;
let started = false;
let users = 0;

function set(patch: Partial<RailState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function api<T>(path: string, timeout = 10_000): Promise<T> {
  const response = await fetch(`${state.base}/api/${path}`, { signal: AbortSignal.timeout(timeout), cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function query(before?: string) {
  const params = new URLSearchParams({ limit: String(PAGE), meaningful: "1" });
  const { q, channel, eventsOnly } = state.filters;
  if (q) params.set("q", q);
  if (channel) params.set("channel", channel);
  if (eventsOnly) params.set("events", "1");
  if (before) params.set("before", before);
  return `clips?${params}`;
}

function matches(clip: RailClip) {
  const { q, channel, eventsOnly } = state.filters;
  if (!clip.meaningful) return false;
  if (channel && clip.channel !== channel) return false;
  if (eventsOnly && clip.event?.clip_kind !== "operational") return false;
  if (q && !q.toLowerCase().split(/\s+/).every((word) => clip.text.toLowerCase().includes(word))) return false;
  return true;
}

function remember(clips: RailClip[]) {
  const cutoff = delayedNow() - HORIZON_MS;
  const kept = new Map(state.clips);
  for (const clip of clips) if (clip.meaningful && clip.t >= cutoff) kept.set(clip.name, clip);
  for (const [name, clip] of kept) if (clip.t < cutoff) kept.delete(name);
  return kept;
}

async function loadHistory() {
  set({ loading: true });
  try {
    const page = await api<{ clips: RailClip[]; next_before: string | null }>(query());
    set({ history: page.clips, more: page.next_before, clips: remember(page.clips), loading: false });
  } catch {
    set({ loading: false });
  }
}

// Every meaningful clip in the horizon, for trains and map dots, whatever the table is filtered to.
async function loadClips() {
  const params = new URLSearchParams({ limit: "300", meaningful: "1", after: chicagoIso(delayedNow() - HORIZON_MS) });
  const found: RailClip[] = [];
  try {
    for (let page = 0; page < 6; page++) {
      const { clips, next_before } = await api<{ clips: RailClip[]; next_before: string | null }>(`clips?${params}`);
      found.push(...clips);
      if (!next_before) break;
      params.set("before", next_before);
    }
  } catch {
    // Keep what arrived.
  }
  set({ clips: remember(found) });
}

async function loadRuns() {
  try {
    const { runs } = await api<{ runs: RailRun[] }>(`runs?hours=${RUN_HOURS}`);
    const missing = [...new Set(runs.flatMap((run) => (run.gtfs_trip ? [run.gtfs_trip] : [])))].filter((id) => !state.trips.has(id));
    if (missing.length) {
      const { trips } = await api<{ trips: MetraTrip[] }>(`metra?trips=${missing.slice(0, 60).join(",")}`);
      set({ trips: new Map([...state.trips, ...trips.map((trip) => [trip.trip_id, trip] as const)]) });
    }
    set({ runs });
    const { incidents } = await api<{ incidents: RailIncident[] }>(`incidents?hours=${RUN_HOURS}`);
    set({ incidents });
  } catch {
    // Try again on the next round.
  }
}

function openStream() {
  stream?.close();
  stream = new EventSource(`${state.base}/api/stream`);
  stream.addEventListener("clip", (event) => {
    const clip = JSON.parse((event as MessageEvent).data) as RailClip;
    const history = state.history.filter((row) => row.name !== clip.name);
    if (matches(clip)) {
      history.push(clip);
      history.sort((a, b) => b.t - a.t);
    }
    set({ history, clips: remember([clip]) });
    for (const listener of clipListeners) listener(clip);
  });
}

async function start() {
  if (started) return;
  started = true;
  set({ status: "probing", base: RAIL_BASE });
  try {
    await api("health", 4000);
  } catch {
    set({ status: "unreachable" });
    return;
  }
  set({ status: "on" });
  api<{ channels: RailChannel[] }>("channels").then(({ channels }) => set({ channels }), () => {});
  loadRuns();
  runsTimer = setInterval(loadRuns, RUNS_EVERY_MS);
  await Promise.all([loadHistory(), loadClips()]);
  openStream();
}

export const rail = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    users += 1;
    start();
    return () => {
      listeners.delete(listener);
      users -= 1;
      if (users === 0) {
        stream?.close();
        stream = null;
        clearInterval(runsTimer);
        started = false;
        set({ status: "off" });
      }
    };
  },
  get: () => state,
  // New clips as they cross the delay line.
  onClip(listener: (clip: RailClip) => void) {
    clipListeners.add(listener);
    return () => {
      clipListeners.delete(listener);
    };
  },
  setFilters(filters: Partial<RailFilters>) {
    set({ filters: { ...state.filters, ...filters } });
    if (state.status === "on") loadHistory();
  },
  async loadMore() {
    if (!state.more || state.loading) return;
    set({ loading: true });
    try {
      const page = await api<{ clips: RailClip[]; next_before: string | null }>(query(state.more));
      const seen = new Set(state.history.map((clip) => clip.name));
      set({ history: [...state.history, ...page.clips.filter((clip) => !seen.has(clip.name))], more: page.next_before, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  select(name: string | null) {
    set({ selected: name, selectedAt: Date.now() });
  },
  find(name: string) {
    return state.clips.get(name) ?? state.history.find((clip) => clip.name === name);
  },
  url(path: string) {
    return `${state.base}${path}`;
  },
};

const serverState = state;

export function useRail() {
  return useSyncExternalStore(rail.subscribe, rail.get, () => serverState);
}
