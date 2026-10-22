"use client";

// One connection to the Pi shared by the map layer and the history table.
import { useSyncExternalStore } from "react";
import { RAIL_BASE, type RailChannel, type RailClip } from "./rail";

export type RailFilters = { q: string; channel: string; eventsOnly: boolean };

type RailState = {
  status: "off" | "probing" | "on" | "unreachable";
  base: string;
  channels: RailChannel[];
  history: RailClip[]; // newest first, filtered
  more: string | null; // cursor for older clips
  loading: boolean;
  recent: Map<string, RailClip>; // last hour of meaningful clips, for the map
  selected: string | null;
  selectedAt: number;
  filters: RailFilters;
};

const RECENT_MS = 60 * 60_000;
const PAGE = 100;

let state: RailState = {
  status: "off",
  base: "",
  channels: [],
  history: [],
  more: null,
  loading: false,
  recent: new Map(),
  selected: null,
  selectedAt: 0,
  filters: { q: "", channel: "", eventsOnly: false },
};
const listeners = new Set<() => void>();
let stream: EventSource | null = null;
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
  const cutoff = Date.now() - RECENT_MS;
  const recent = new Map(state.recent);
  for (const clip of clips) if (clip.meaningful && clip.t >= cutoff) recent.set(clip.name, clip);
  for (const [name, clip] of recent) if (clip.t < cutoff) recent.delete(name);
  return recent;
}

async function loadHistory() {
  set({ loading: true });
  try {
    const page = await api<{ clips: RailClip[]; next_before: string | null }>(query());
    set({ history: page.clips, more: page.next_before, recent: remember(page.clips), loading: false });
  } catch {
    set({ loading: false });
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
    set({ history, recent: remember([clip]) });
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
  await loadHistory();
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
        started = false;
        set({ status: "off" });
      }
    };
  },
  get: () => state,
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
    return state.recent.get(name) ?? state.history.find((clip) => clip.name === name);
  },
  url(path: string) {
    return `${state.base}${path}`;
  },
};

const serverState = state;

export function useRail() {
  return useSyncExternalStore(rail.subscribe, rail.get, () => serverState);
}
