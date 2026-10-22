"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { delayedNow } from "./delay";
import { mapStyle, palette } from "./map-style";
import {
  buildGazetteer,
  buildTrains,
  categoryColors,
  clipTime,
  humanize,
  placeClip,
  scheduledPosition,
  summary,
  trainColors,
  trainGroupLabels,
  type Gazetteer,
  type RailClip,
  type ScheduledPosition,
  type Train,
  type TrainGroup,
} from "./rail";
import { rail, useRail } from "./rail-store";
import { HOME } from "./region";
import { vesselKind, type Vessel, type VesselKind } from "./vessel";

const kindColors: Record<VesselKind, string> = {
  cargo: "#36597a",
  tanker: "#a2553a",
  passenger: "#7a5c8e",
  tug: "#b8862f",
  fishing: "#4f7d73",
  pleasure: "#6f8f5a",
  other: "#7d776d",
};

const kindLabels: Record<VesselKind, string> = {
  cargo: "Cargo",
  tanker: "Tanker",
  passenger: "Passenger",
  tug: "Tug or tow",
  fishing: "Fishing",
  pleasure: "Pleasure craft",
  other: "Vessel",
};

const railroads: Record<string, string> = {
  BNSF: "BNSF",
  BRC: "Belt Railway of Chicago",
  CFE: "Chicago, Fort Wayne & Eastern",
  CN: "Canadian National",
  CPKC: "CPKC",
  CRL: "Chicago Rail Link",
  CSS: "Chicago SouthShore & South Bend",
  CSXT: "CSX",
  GRW: "Gary Railway",
  IAIS: "Iowa Interstate",
  IHB: "Indiana Harbor Belt",
  IR: "Illinois Railway",
  NIRC: "Metra",
  NS: "Norfolk Southern",
  UP: "Union Pacific",
  WSOR: "Wisconsin & Southern",
};

const services: Record<string, string> = {
  road_freight: "Road freight",
  transfer: "Transfer",
  yard_job: "Yard job",
  passenger: "Passenger",
  mow_work: "Track work",
  light_engine: "Light engine",
};

const kindColor = ["match", ["get", "kind"], ...Object.entries(kindColors).flat(), kindColors.other] as unknown as ExpressionSpecification;
// Ships fade as their last position ages.
const fade: ExpressionSpecification = ["interpolate", ["linear"], ["get", "age"], 0, 1, 10, 0.8, 30, 0.2];

// Delayed time, like everything on the page: ships stay for 30 minutes after their last position, and trains for
// 45 minutes after they were last heard. A Metra train on its GTFS trip stays while its timetable has it running.
const STALE_MS = 30 * 60_000;
const TRAIN_MS = 45 * 60_000;
const SCHEDULED_MS = 2 * 60 * 60_000;

type PlacedTrain = { train: Train; lon: number; lat: number; exact: boolean; scheduled: ScheduledPosition | null };

// Where a train is now, or null once it's gone quiet (or its scheduled trip has ended).
function placeTrain(train: Train, now: number): PlacedTrain | null {
  const quiet = now - train.last;
  if (train.schedule) {
    const { trip, base, late } = train.schedule;
    const end = base + late + trip.stops[trip.stops.length - 1][3] * 1000;
    const at = scheduledPosition(train.schedule, now);
    if (quiet > SCHEDULED_MS || now > end + 5 * 60_000 || (at.state === "waiting" && quiet > TRAIN_MS)) return null;
    return { train, lon: at.lon, lat: at.lat, exact: true, scheduled: at };
  }
  if (quiet > TRAIN_MS) return null;
  return { train, lon: train.position.lon, lat: train.position.lat, exact: train.position.exact, scheduled: null };
}

type Selection = { kind: "ship"; mmsi: number } | { kind: "train"; key: string; highlight: string | null } | null;

function escape(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function ago(ms: number) {
  const minutes = Math.round((delayedNow() - ms) / 60_000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

// "CHICAGO (CN)" becomes "Chicago (CN)": railroad marks in parentheses stay capitalized.
function title(text: string) {
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\(([^)]+)\)/g, (_, inner: string) => `(${inner.toUpperCase()})`);
}

function rgba(hex: string, alpha: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// A selected trail darkens toward where the ship or train is now.
function trailGradient(color: string) {
  return ["interpolate", ["linear"], ["line-progress"], 0, rgba(color, 0.12), 1, rgba(color, 1)] as ExpressionSpecification;
}

// A slim dart pointing north, drawn at 2x and rotated by heading on the map.
function shipIcon(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 22;
  canvas.height = 30;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.moveTo(11, 2);
  context.lineTo(19, 27);
  context.lineTo(11, 21);
  context.lineTo(3, 27);
  context.closePath();
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = palette.land;
  context.stroke();
  context.fillStyle = color;
  context.fill();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

// A rounded badge, drawn at 2x, that stretches around a train's number. Hollow when the train never named a place
// and sits near its channel's home, like the hollow radio rings.
function trainIcon(color: string, hollow: boolean) {
  const width = 28;
  const height = 24;
  const radius = 8;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.beginPath();
  context.roundRect(2, 2, width - 4, height - 4, radius - 2);
  context.fillStyle = hollow ? palette.land : color;
  context.fill();
  context.lineWidth = hollow ? 2.5 : 3;
  context.strokeStyle = hollow ? color : palette.land;
  context.stroke();
  return {
    image: context.getImageData(0, 0, width, height),
    options: {
      pixelRatio: 2,
      stretchX: [[radius, width - radius]] as [number, number][],
      stretchY: [[radius, height - radius]] as [number, number][],
      content: [radius, 6, width - radius, height - 6] as [number, number, number, number],
    },
  };
}

function shipData(vessels: Map<number, Vessel>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const vessel of vessels.values()) {
    const bearing = vessel.heading ?? vessel.course;
    features.push({
      type: "Feature",
      id: vessel.mmsi,
      geometry: { type: "Point", coordinates: [vessel.lon, vessel.lat] },
      properties: {
        mmsi: vessel.mmsi,
        kind: vesselKind(vessel.type),
        bearing: bearing ?? 0,
        moving: bearing !== null && (vessel.speed ?? 0) >= 0.5,
        age: (now - vessel.seen) / 60_000,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function shipPopup(vessel: Vessel) {
  const kind = vesselKind(vessel.type);
  const facts = [
    vessel.status === 1 ? "At anchor" : vessel.status === 5 ? "Moored" : null,
    vessel.speed !== null && vessel.speed >= 0.5 ? `${vessel.speed.toFixed(1)} kn` : null,
    vessel.course !== null && (vessel.speed ?? 0) >= 0.5 ? `${Math.round(vessel.course)}°` : null,
    vessel.length ? `${vessel.length} m` : null,
  ].filter(Boolean);
  return `
    <p class="map-popup-title">${escape(vessel.name ? title(vessel.name) : `MMSI ${vessel.mmsi}`)}</p>
    <p>${kindLabels[kind]}${facts.length ? ` · ${facts.join(" · ")}` : ""}</p>
    ${vessel.destination ? `<p>To ${escape(title(vessel.destination))}</p>` : ""}
    <p class="map-popup-muted">Heard ${ago(vessel.seen)}</p>`;
}

const categoryColor = [
  "match",
  ["get", "category"],
  ...Object.entries(categoryColors).flat(),
  categoryColors.communication,
] as unknown as ExpressionSpecification;
// Radio events fade over the hour after they were heard.
const railFade: ExpressionSpecification = ["interpolate", ["linear"], ["get", "age"], 0, 1, 20, 0.7, 60, 0.12];
const trainFade: ExpressionSpecification = ["interpolate", ["linear"], ["get", "age"], 0, 1, 20, 0.85, 45, 0.4];
// Top first, so a click picks what's drawn on top.
const CLICKABLE = ["trains", "rail-events", "rail-events-area", "ships-moving", "ships-still", "rail-hit"];

// Transmissions from the last hour that no train on the map already carries.
function railEventData(clips: Iterable<RailClip>, gazetteer: Gazetteer | null, carried: Set<string>, now: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (gazetteer) {
    for (const clip of clips) {
      const age = (now - clip.t) / 60_000;
      if (age > 60 || carried.has(clip.name)) continue;
      const placement = placeClip(clip, gazetteer);
      if (!placement) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [placement.lon, placement.lat] },
        properties: {
          name: clip.name,
          category: clip.event?.event_category ?? "communication",
          exact: placement.exact,
          age,
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function trainData(trains: PlacedTrain[], now: number, selected: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: trains.map(({ train, lon, lat, exact, scheduled }) => {
      // A scheduled train is where its timetable says, so it only fades once the radio has been quiet a while.
      const age = Math.max(0, (now - train.last) / 60_000 - (scheduled ? 30 : 0));
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lon, lat] },
        properties: {
          key: train.key,
          badge: train.badge,
          group: train.group,
          exact,
          age,
          // Newest on top, and the selected train above everything.
          order: train.key === selected ? 1e6 : -age,
        },
      };
    }),
  };
}

// The places a train's transmissions put it, in order. A scheduled train's trail is instead its trip so far along
// Metra's route, with dots at the stops the radio placed it at.
function trainTrail({ train, scheduled }: PlacedTrain): GeoJSON.FeatureCollection {
  const points: [number, number][] = [];
  if (train.schedule) {
    for (const { stop } of train.schedule.heard) points.push([train.schedule.trip.stops[stop][1], train.schedule.trip.stops[stop][2]]);
  } else {
    for (const stop of train.stops) {
      if (!stop.place) continue;
      const last = points.at(-1);
      if (!last || last[0] !== stop.place.lon || last[1] !== stop.place.lat) points.push([stop.place.lon, stop.place.lat]);
    }
  }
  const color = trainColors[train.group];
  const features: GeoJSON.Feature[] = points.map((point) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: point },
    properties: { color },
  }));
  const line = scheduled ? scheduled.path : points;
  if (line.length > 1) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: line }, properties: {} });
  return { type: "FeatureCollection", features };
}

const timetable = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

function lateness(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes === 0) return "on time";
  return minutes > 0 ? `${minutes} min late` : `${-minutes} min early`;
}

function shipTrail(vessel: Vessel): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features:
      vessel.track.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: vessel.track }, properties: {} }] : [],
  };
}

function trainPopup(train: Train, highlight: string | null, scheduled: ScheduledPosition | null) {
  const trip = train.schedule?.trip;
  const facts = [
    services[train.service ?? ""] ?? trainGroupLabels[train.group],
    trip ? `to ${trip.headsign}` : train.direction ? `${train.direction}bound` : null,
  ].filter(Boolean);
  const where = !trip && train.position.exact ? ` · at ${title(train.position.place)}` : "";
  const next = scheduled?.next
    ? `${scheduled.state === "waiting" ? "Leaves" : "Next"} ${scheduled.next.name} ${timetable.format(scheduled.next.t)}`
    : scheduled
      ? "Arrived"
      : null;
  const timing = train.schedule?.heard.length ? lateness(train.schedule.late) : "by the timetable";
  const rows = [...train.stops]
    .reverse()
    .map((stop) => {
      const audio = stop.clip?.audio ? rail.url(stop.clip.audio) : null;
      const said = stop.clip?.text && stop.clip.text !== stop.detail ? stop.clip.text : null;
      const meta = [clipTime(stop), humanize(stop.event), stop.place ? title(stop.place.place) : null].filter(Boolean).join(" · ");
      return `
        <li class="map-popup-comm${highlight && stop.clip?.name === highlight ? " map-popup-comm--on" : ""}">
          ${audio ? `<button type="button" class="map-popup-play" data-audio="${escape(audio)}" aria-label="Play">▶</button>` : '<span class="map-popup-play" aria-hidden="true"></span>'}
          <div>
            <p class="map-popup-muted">${escape(meta)}</p>
            ${stop.detail ? `<p>${escape(stop.detail)}</p>` : ""}
            ${said ? `<p class="map-popup-said">“${escape(said)}”</p>` : ""}
          </div>
        </li>`;
    })
    .join("");
  return `
    <p class="map-popup-title">${escape(train.name)}</p>
    <p>${escape(facts.join(" · "))}</p>
    <p class="map-popup-muted">${escape(train.label || train.channel)} · heard ${ago(train.last)}${escape(where)}</p>
    ${next ? `<p>${escape(next)} · ${escape(timing)}</p>` : ""}
    ${train.status ? `<p class="map-popup-status">${escape(train.status)}</p>` : ""}
    <ol class="map-popup-comms">${rows}</ol>
    <p class="map-popup-muted map-popup-foot">A run Luna inferred from ${train.stops.length} transmission${train.stops.length === 1 ? "" : "s"}${train.confidence ? `, ${escape(train.confidence)} confidence` : ""}${trip ? ". Position from Metra's GTFS schedule, shifted by how late the radio has it." : ""}</p>`;
}

function clipPopup(clip: RailClip, place: string | null) {
  const event = clip.event;
  const heading = summary(clip) || "Transmission";
  const crossing =
    event?.crossing_status && !["none", "mentioned"].includes(event.crossing_status)
      ? `Road crossing ${event.crossing_status}${event.location ? ` at ${event.location}` : ""}`
      : null;
  const who = [humanize(event?.speaker_role), event?.addressee_role && event.addressee_role !== "unknown" ? `to ${humanize(event.addressee_role).toLowerCase()}` : null]
    .filter((part) => part && part !== "Unknown")
    .join(" ");
  return `
    <p class="map-popup-title">${escape(heading)}</p>
    <p>${escape(clip.label || clip.channel)} · ${escape(clip.freq ?? "")} MHz</p>
    <p class="map-popup-quote">“${escape(clip.text)}”</p>
    ${who ? `<p>${escape(who)}${event?.direction ? ` · ${escape(event.direction)}bound` : ""}</p>` : ""}
    ${crossing ? `<p>${escape(crossing)}</p>` : ""}
    ${clip.run_id ? `<p class="map-popup-muted">Run ${escape(clip.run_id)}</p>` : ""}
    <p class="map-popup-muted">${escape(clipTime(clip, true))}${place ? ` · ${escape(place)}` : ""}</p>
    ${clip.audio ? `<audio class="map-popup-audio" controls preload="none" src="${escape(rail.url(clip.audio))}"></audio>` : ""}`;
}

// A WAV with no samples. Playing it on the click lets the browser play later clips without another tap.
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// Plays each transmission as it crosses the delay line, an hour after it was heard.
function Listen() {
  const audio = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const element = audio.current;
    if (!on || !element) return;
    let queue: string[] = [];
    const next = () => {
      const src = queue.shift();
      if (!src) return;
      element.src = src;
      element.play().catch(next);
    };
    const unsubscribe = rail.onClip((clip) => {
      if (!clip.audio) return;
      // Clips come in bursts; stay near the delay line rather than drift behind it.
      queue = [...queue, rail.url(clip.audio)].slice(-4);
      if (element.paused) next();
    });
    element.addEventListener("ended", next);
    return () => {
      unsubscribe();
      element.removeEventListener("ended", next);
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [on]);

  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (!on) {
      // Start with the latest transmission, if there was one in the last few minutes.
      const now = delayedNow();
      const latest = [...rail.get().clips.values()]
        .filter((clip) => clip.audio && now - clip.t < 5 * 60_000)
        .sort((a, b) => b.t - a.t)[0];
      element.src = latest?.audio ? rail.url(latest.audio) : SILENCE;
      element.play().catch(() => {});
    }
    setOn(!on);
  };

  return (
    <button type="button" className={`map-live${on ? " map-live--on" : ""}`} onClick={toggle} aria-pressed={on}>
      <span className="map-live-dot" aria-hidden />
      {on ? "Listening" : "Listen"}
      <audio ref={audio} preload="none" />
    </button>
  );
}

function railPopup(properties: Record<string, unknown>) {
  const owner = String(properties.owner ?? "");
  const others = String(properties.freight ?? "")
    .split(" ")
    .filter((mark) => mark && mark !== owner);
  const place = properties.yard ?? properties.subdivision;
  return `
    <p class="map-popup-title">${escape(railroads[owner] ?? owner)}</p>
    ${place ? `<p>${escape(title(String(place)))}${properties.yard ? "" : " Subdivision"}</p>` : ""}
    ${others.length ? `<p class="map-popup-muted">Also ${escape(others.map((mark) => railroads[mark] ?? mark).join(", "))}</p>` : ""}`;
}

export function LiveMap() {
  const container = useRef<HTMLDivElement>(null);
  const railStatus = useRail().status;

  useEffect(() => {
    let disposed = false;
    let map: MapLibreMap | null = null;
    let events: EventSource | null = null;
    let ager: ReturnType<typeof setInterval> | undefined;
    let frame = 0;
    const vessels = new Map<number, Vessel>();
    let gazetteer: Gazetteer | null = null;
    let trains: Train[] = [];
    let builtFrom: unknown[] = [];
    let unsubscribeRail = () => {};
    const player = new Audio();
    player.preload = "none";

    (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed || !container.current) return;
      // MapLibre finds its worker next to its own module, which bundling moves; point it at the emitted copy.
      maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      map = new maplibre.Map({
        container: container.current,
        style: mapStyle,
        bounds: [HOME[0], HOME[1], HOME[2], HOME[3]],
        fitBoundsOptions: { padding: 24 },
        minZoom: 6,
        maxZoom: 17,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();

      // One popup at a time. A ship or train popup also selects it, which draws its trail until the popup closes.
      let popup: Popup | null = null;
      let selection: Selection = null;
      let shownStops = 0;
      let trailColor = "";
      let ready = false;

      // Play buttons in a train's history share one player.
      const syncButtons = () => {
        for (const button of popup?.getElement().querySelectorAll<HTMLButtonElement>("[data-audio]") ?? []) {
          const playing = !player.paused && player.src === new URL(button.dataset.audio!, location.href).href;
          button.textContent = playing ? "❚❚" : "▶";
          button.setAttribute("aria-label", playing ? "Pause" : "Play");
        }
      };
      for (const type of ["play", "pause", "ended"]) player.addEventListener(type, syncButtons);

      const openPopup = (lngLat: [number, number], html: string, next: Selection, maxWidth = "15rem") => {
        popup?.remove();
        selection = next;
        const current = new maplibre.Popup({ closeButton: false, maxWidth, offset: 10, className: "map-popup" })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map!);
        popup = current;
        current.getElement().addEventListener("click", (event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-audio]");
          if (!button) return;
          const src = new URL(button.dataset.audio!, location.href).href;
          if (player.src === src && !player.paused) player.pause();
          else {
            player.src = src;
            player.play().catch(() => {});
          }
        });
        current.on("close", () => {
          if (popup !== current) return;
          popup = null;
          selection = null;
          player.pause();
          schedule();
        });
        schedule();
      };

      const showTrain = (placed: PlacedTrain, highlight: string | null, fly: boolean) => {
        const { train } = placed;
        const center: [number, number] = [placed.lon, placed.lat];
        if (fly) map!.flyTo({ center, zoom: Math.max(map!.getZoom(), 11.5), duration: 900 });
        shownStops = train.stops.length;
        openPopup(center, trainPopup(train, highlight, placed.scheduled), { kind: "train", key: train.key, highlight }, "19rem");
        // Scroll the history, not the page, to the transmission picked in the radio log.
        const list = popup?.getElement().querySelector<HTMLElement>(".map-popup-comms");
        const row = list?.querySelector<HTMLElement>(".map-popup-comm--on");
        if (list && row) list.scrollTop = row.offsetTop - list.offsetTop - 8;
      };

      const render = () => {
        frame = 0;
        // Not isStyleLoaded(): that stays false while any basemap tile loads, which would drop updates mid-pan.
        if (!map || !ready) return;
        const now = delayedNow();
        for (const [mmsi, vessel] of vessels) if (vessel.seen < now - STALE_MS) vessels.delete(mmsi);
        (map.getSource("ships") as GeoJSONSource | undefined)?.setData(shipData(vessels, now));

        const state = rail.get();
        if (gazetteer && (builtFrom[0] !== state.runs || builtFrom[1] !== state.clips || builtFrom[2] !== state.trips)) {
          trains = buildTrains(state.runs, state.clips, gazetteer, state.trips);
          builtFrom = [state.runs, state.clips, state.trips];
        }
        const current = trains.flatMap((train) => placeTrain(train, now) ?? []);
        const carried = new Set(current.flatMap(({ train }) => train.stops.flatMap((stop) => (stop.clip ? [stop.clip.name] : []))));
        const selectedTrain = selection?.kind === "train" ? selection.key : null;
        (map.getSource("trains") as GeoJSONSource | undefined)?.setData(trainData(current, now, selectedTrain));
        (map.getSource("rail-events") as GeoJSONSource | undefined)?.setData(railEventData(state.clips.values(), gazetteer, carried, now));

        let trail: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        let color = trailColor;
        if (selection?.kind === "ship") {
          const vessel = vessels.get(selection.mmsi);
          if (vessel) {
            trail = shipTrail(vessel);
            color = kindColors[vesselKind(vessel.type)];
            popup?.setLngLat([vessel.lon, vessel.lat]).setHTML(shipPopup(vessel));
          }
        } else if (selection?.kind === "train") {
          const placed = current.find(({ train }) => train.key === selectedTrain);
          if (placed) {
            trail = trainTrail(placed);
            color = trainColors[placed.train.group];
            popup?.setLngLat([placed.lon, placed.lat]);
            if (placed.train.stops.length !== shownStops) {
              shownStops = placed.train.stops.length;
              popup?.setHTML(trainPopup(placed.train, selection.highlight, placed.scheduled));
              syncButtons();
            }
          }
        }
        (map.getSource("trail") as GeoJSONSource | undefined)?.setData(trail);
        if (color !== trailColor && map.getLayer("trail")) {
          trailColor = color;
          map.setPaintProperty("trail", "line-gradient", trailGradient(color));
        }
      };
      const schedule = () => {
        frame ||= requestAnimationFrame(render);
      };

      map.on("load", async () => {
        if (!map) return;
        for (const [kind, color] of Object.entries(kindColors)) {
          map.addImage(`ship-${kind}`, shipIcon(color), { pixelRatio: 2 });
        }
        for (const [group, color] of Object.entries(trainColors) as [TrainGroup, string][]) {
          for (const hollow of [false, true]) {
            const { image, options } = trainIcon(color, hollow);
            map.addImage(`train-${group}${hollow ? "-hollow" : ""}`, image, options);
          }
        }

        map.addSource("rail", { type: "geojson", data: "/rail/rail-lines.geojson" });
        map.addLayer(
          {
            id: "rail-minor",
            type: "line",
            source: "rail",
            minzoom: 9,
            filter: ["!=", ["get", "network"], "M"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": palette.rail,
              "line-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.12, 13, 0.3],
              "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 9, 0.4, 13, 0.9, 16, 1.6],
            },
          },
          "water-label",
        );
        map.addLayer(
          {
            id: "rail-main",
            type: "line",
            source: "rail",
            filter: ["==", ["get", "network"], "M"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": palette.rail,
              "line-opacity": 0.72,
              "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 7, 0.5, 10, 1, 13, 1.8, 16, 2.8],
            },
          },
          "water-label",
        );
        map.addLayer({
          id: "rail-label",
          type: "symbol",
          source: "rail",
          minzoom: 11.5,
          filter: ["all", ["==", ["get", "network"], "M"], ["has", "subdivision"]],
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 400,
            "text-field": ["get", "subdivision"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 9.5,
            "text-letter-spacing": 0.14,
            "text-offset": [0, -0.8],
          },
          paint: { "text-color": palette.label, "text-halo-color": palette.land, "text-halo-width": 1.2 },
        });
        // A wide invisible line makes thin track easy to click.
        map.addLayer({
          id: "rail-hit",
          type: "line",
          source: "rail",
          paint: { "line-color": "#000", "line-opacity": 0, "line-width": 10 },
        });

        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        // The selected ship's or train's trail, in its color, on a land-colored casing.
        map.addSource("trail", { type: "geojson", data: empty, lineMetrics: true });
        map.addLayer({
          id: "trail-casing",
          type: "line",
          source: "trail",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": palette.land, "line-opacity": 0.85, "line-width": 5.5 },
        });
        map.addLayer({
          id: "trail",
          type: "line",
          source: "trail",
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-width": 2.5, "line-gradient": trailGradient(palette.rail) },
        });
        map.addLayer({
          id: "trail-stops",
          type: "circle",
          source: "trail",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 13, 4],
            "circle-color": ["get", "color"],
            "circle-stroke-color": palette.land,
            "circle-stroke-width": 1.5,
          },
        });

        map.addSource("ships", { type: "geojson", data: empty });
        map.addLayer({
          id: "ships-still",
          type: "circle",
          source: "ships",
          filter: ["!=", ["get", "moving"], true],
          paint: {
            "circle-color": kindColor,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2.2, 12, 3.6, 15, 5],
            "circle-stroke-color": palette.land,
            "circle-stroke-width": 1.2,
            "circle-opacity": fade,
            "circle-stroke-opacity": fade,
          },
        });
        map.addLayer({
          id: "ships-moving",
          type: "symbol",
          source: "ships",
          filter: ["==", ["get", "moving"], true],
          layout: {
            "icon-image": ["concat", "ship-", ["get", "kind"]],
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-size": ["interpolate", ["linear"], ["zoom"], 7, 0.75, 12, 1.1, 15, 1.5],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: { "icon-opacity": fade },
        });

        // Radio events from the home SDR that no train carries, drawn above the ships. Hollow rings are placed only by channel.
        map.addSource("rail-events", { type: "geojson", data: empty });
        map.addLayer({
          id: "rail-events-area",
          type: "circle",
          source: "rail-events",
          filter: ["!=", ["get", "exact"], true],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3.5, 12, 6, 15, 8],
            "circle-color": categoryColor,
            "circle-opacity": ["*", 0.14, railFade],
            "circle-stroke-color": categoryColor,
            "circle-stroke-width": 1.6,
            "circle-stroke-opacity": railFade,
          },
        });
        map.addLayer({
          id: "rail-events",
          type: "circle",
          source: "rail-events",
          filter: ["==", ["get", "exact"], true],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3.5, 12, 5.5, 15, 7.5],
            "circle-color": categoryColor,
            "circle-opacity": railFade,
            "circle-stroke-color": palette.land,
            "circle-stroke-width": 1.4,
            "circle-stroke-opacity": railFade,
          },
        });

        // Trains Luna inferred from the radio, on top: a badge with the train's number, colored by what it is.
        map.addSource("trains", { type: "geojson", data: empty });
        map.addLayer({
          id: "trains",
          type: "symbol",
          source: "trains",
          layout: {
            "icon-image": ["concat", "train-", ["get", "group"], ["case", ["get", "exact"], "", "-hollow"]],
            "icon-text-fit": "both",
            "icon-text-fit-padding": [1, 4, 1, 4],
            "text-field": ["get", "badge"],
            "text-font": ["Noto Sans Bold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 13, 10.5],
            "symbol-sort-key": ["get", "order"],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": ["case", ["get", "exact"], "#ffffff", "#3a3834"],
            "icon-opacity": trainFade,
            "text-opacity": trainFade,
          },
        });

        const showClip = (clip: RailClip, fly: boolean) => {
          const train = trains.find((candidate) => candidate.stops.some((stop) => stop.clip?.name === clip.name));
          const placed = train ? placeTrain(train, delayedNow()) : null;
          if (placed) return showTrain(placed, clip.name, fly);
          const placement = gazetteer ? placeClip(clip, gazetteer) : null;
          if (!placement) return;
          if (fly) map!.flyTo({ center: [placement.lon, placement.lat], zoom: Math.max(map!.getZoom(), 11.5), duration: 900 });
          openPopup([placement.lon, placement.lat], clipPopup(clip, placement.exact ? placement.place : `near ${placement.place}`), null);
        };

        map.on("click", (event) => {
          const feature = map!.queryRenderedFeatures(event.point, { layers: CLICKABLE })[0];
          if (!feature) return;
          const properties = feature.properties ?? {};
          if (feature.layer.id === "trains") {
            const train = trains.find((candidate) => candidate.key === properties.key);
            const placed = train ? placeTrain(train, delayedNow()) : null;
            if (placed) showTrain(placed, null, false);
          } else if (feature.layer.id.startsWith("rail-events")) {
            const clip = rail.find(String(properties.name));
            if (clip) showClip(clip, false);
          } else if (feature.layer.id.startsWith("ships")) {
            const vessel = vessels.get(Number(properties.mmsi));
            if (vessel) openPopup([vessel.lon, vessel.lat], shipPopup(vessel), { kind: "ship", mmsi: vessel.mmsi });
          } else {
            openPopup([event.lngLat.lng, event.lngLat.lat], railPopup(properties), null);
          }
        });
        for (const layer of CLICKABLE) {
          map.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
        }

        let loadingPlaces = false;
        let lastSelection = rail.get().selectedAt;
        const onRail = () => {
          const current = rail.get();
          if (current.status === "on" && !gazetteer && !loadingPlaces) {
            loadingPlaces = true;
            fetch("/rail/rail-lines.geojson")
              .then((response) => response.json())
              .then((data: GeoJSON.FeatureCollection) => {
                gazetteer = buildGazetteer(data);
                schedule();
              })
              .catch(() => (loadingPlaces = false));
          }
          if (current.selectedAt !== lastSelection) {
            lastSelection = current.selectedAt;
            const clip = current.selected ? rail.find(current.selected) : undefined;
            if (clip) showClip(clip, true);
          }
          schedule();
        };
        unsubscribeRail = rail.subscribe(onRail);
        onRail();

        events = new EventSource("/rail/ships");
        events.addEventListener("vessels", (event) => {
          for (const vessel of JSON.parse(event.data) as Vessel[]) vessels.set(vessel.mmsi, vessel);
          schedule();
        });
        // Re-fade ships, radio and trains as they age, and let trains go quiet.
        ager = setInterval(schedule, 30_000);
        ready = true;
        render();
      });
    })();

    return () => {
      disposed = true;
      unsubscribeRail();
      events?.close();
      clearInterval(ager);
      cancelAnimationFrame(frame);
      player.pause();
      map?.remove();
    };
  }, []);

  return (
    <div className="map-frame">
      <div ref={container} className="live-map" />
      {railStatus === "on" ? <Listen /> : null}
      <p className="map-delay">All data delayed 60 minutes</p>
    </div>
  );
}
