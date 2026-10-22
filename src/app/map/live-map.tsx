"use client";

import { useEffect, useRef, useState } from "react";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { mapStyle, palette } from "./map-style";
import { buildGazetteer, categoryColors, clipTime, humanize, placeClip, summary, type Gazetteer, type RailClip } from "./rail";
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

const kindColor = ["match", ["get", "kind"], ...Object.entries(kindColors).flat(), kindColors.other] as unknown as ExpressionSpecification;
// Ships fade as their last position ages.
const fade: ExpressionSpecification = ["interpolate", ["linear"], ["get", "age"], 0, 1, 10, 0.8, 30, 0.2];

const STALE_MS = 30 * 60_000;

function escape(text: string) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function ago(ms: number) {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  return minutes < 1 ? "just now" : `${minutes} min ago`;
}

// "CHICAGO (CN)" becomes "Chicago (CN)": railroad marks in parentheses stay capitalized.
function title(text: string) {
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
    .replace(/\(([^)]+)\)/g, (_, inner: string) => `(${inner.toUpperCase()})`);
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

function shipData(vessels: Map<number, Vessel>) {
  const now = Date.now();
  const points: GeoJSON.Feature[] = [];
  const trails: GeoJSON.Feature[] = [];
  for (const vessel of vessels.values()) {
    const kind = vesselKind(vessel.type);
    const age = (now - vessel.seen) / 60_000;
    const bearing = vessel.heading ?? vessel.course;
    points.push({
      type: "Feature",
      id: vessel.mmsi,
      geometry: { type: "Point", coordinates: [vessel.lon, vessel.lat] },
      properties: {
        mmsi: vessel.mmsi,
        kind,
        bearing: bearing ?? 0,
        moving: bearing !== null && (vessel.speed ?? 0) >= 0.5,
        age,
      },
    });
    if (vessel.track.length > 1) {
      trails.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: vessel.track },
        properties: { kind, age },
      });
    }
  }
  return {
    points: { type: "FeatureCollection", features: points } as GeoJSON.FeatureCollection,
    trails: { type: "FeatureCollection", features: trails } as GeoJSON.FeatureCollection,
  };
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
const RAIL_LAYERS = ["rail-events-area", "rail-events"];

function railEventData(clips: Iterable<RailClip>, gazetteer: Gazetteer | null): GeoJSON.FeatureCollection {
  const now = Date.now();
  const features: GeoJSON.Feature[] = [];
  if (gazetteer) {
    for (const clip of clips) {
      const placement = placeClip(clip, gazetteer);
      if (!placement) continue;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [placement.lon, placement.lat] },
        properties: {
          name: clip.name,
          category: clip.event?.event_category ?? "communication",
          exact: placement.exact,
          age: (now - clip.t) / 60_000,
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function clipPopup(clip: RailClip, place: string | null) {
  const event = clip.event;
  const heading = summary(clip) || "Transmission";
  const who = [humanize(event?.speaker_role), event?.addressee_role && event.addressee_role !== "unknown" ? `to ${humanize(event.addressee_role).toLowerCase()}` : null]
    .filter((part) => part && part !== "Unknown")
    .join(" ");
  return `
    <p class="map-popup-title">${escape(heading)}</p>
    <p>${escape(clip.label || clip.channel)} · ${escape(clip.freq ?? "")} MHz</p>
    <p class="map-popup-quote">“${escape(clip.text)}”</p>
    ${who ? `<p>${escape(who)}${event?.direction ? ` · ${escape(event.direction)}bound` : ""}</p>` : ""}
    ${clip.run_id ? `<p class="map-popup-muted">Run ${escape(clip.run_id)}</p>` : ""}
    <p class="map-popup-muted">${escape(clipTime(clip, true))}${place ? ` · ${escape(place)}` : ""}</p>
    ${clip.audio ? `<audio class="map-popup-audio" controls preload="none" src="${escape(rail.url(clip.audio))}"></audio>` : ""}`;
}

function LiveRadio() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (playing) {
      element.pause();
      element.removeAttribute("src");
      element.load();
      setPlaying(false);
    } else {
      // A fresh src each time joins the stream live instead of resuming a stale buffer.
      element.src = `${rail.url("/live")}?t=${Date.now()}`;
      element.play().then(() => setPlaying(true), () => setPlaying(false));
    }
  };
  return (
    <button type="button" className={`map-live${playing ? " map-live--on" : ""}`} onClick={toggle} aria-pressed={playing}>
      <span className="map-live-dot" aria-hidden />
      {playing ? "Listening live" : "Listen live"}
      <audio ref={audio} preload="none" onPause={() => setPlaying(false)} />
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
    let unsubscribeRail = () => {};

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

      let popup: Popup | null = null;
      let selected: number | null = null;
      const openPopup = (lngLat: [number, number], html: string, vessel: number | null) => {
        popup?.remove();
        selected = vessel;
        popup = new maplibre.Popup({ closeButton: false, maxWidth: "15rem", offset: 10, className: "map-popup" })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map!);
        popup.on("close", () => {
          if (selected === vessel) selected = null;
        });
      };

      const render = () => {
        frame = 0;
        if (!map?.isStyleLoaded()) return;
        const cutoff = Date.now() - STALE_MS;
        for (const [mmsi, vessel] of vessels) if (vessel.seen < cutoff) vessels.delete(mmsi);
        const data = shipData(vessels);
        (map.getSource("ships") as GeoJSONSource | undefined)?.setData(data.points);
        (map.getSource("ship-trails") as GeoJSONSource | undefined)?.setData(data.trails);
        const vessel = selected === null ? undefined : vessels.get(selected);
        if (vessel && popup) popup.setLngLat([vessel.lon, vessel.lat]).setHTML(shipPopup(vessel));
        (map.getSource("rail-events") as GeoJSONSource | undefined)?.setData(railEventData(rail.get().recent.values(), gazetteer));
      };
      const schedule = () => {
        frame ||= requestAnimationFrame(render);
      };

      map.on("load", async () => {
        if (!map) return;
        for (const [kind, color] of Object.entries(kindColors)) {
          map.addImage(`ship-${kind}`, shipIcon(color), { pixelRatio: 2 });
        }

        map.addSource("rail", { type: "geojson", data: "/map/rail-lines.geojson" });
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
        map.addSource("ship-trails", { type: "geojson", data: empty });
        map.addSource("ships", { type: "geojson", data: empty });
        map.addLayer({
          id: "ship-trails",
          type: "line",
          source: "ship-trails",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": kindColor,
            "line-opacity": ["*", 0.35, fade],
            "line-width": 1.2,
          },
        });
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

        // Radio events from the home SDR, drawn above the ships. Hollow rings are placed only by channel.
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

        const showClip = (clip: RailClip, fly: boolean) => {
          const placement = gazetteer ? placeClip(clip, gazetteer) : null;
          if (!placement) return;
          if (fly) map!.flyTo({ center: [placement.lon, placement.lat], zoom: Math.max(map!.getZoom(), 11.5), duration: 900 });
          openPopup([placement.lon, placement.lat], clipPopup(clip, placement.exact ? placement.place : `near ${placement.place}`), null);
        };
        for (const layer of RAIL_LAYERS) {
          map.on("click", layer, (event) => {
            const clip = rail.find(String(event.features?.[0]?.properties?.name));
            if (clip) showClip(clip, false);
          });
        }

        let loadingPlaces = false;
        let lastSelection = rail.get().selectedAt;
        const onRail = () => {
          const current = rail.get();
          if (current.status === "on" && !gazetteer && !loadingPlaces) {
            loadingPlaces = true;
            fetch("/map/rail-lines.geojson")
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

        const vesselAt = (event: MapLayerMouseEvent) => {
          const mmsi = Number(event.features?.[0]?.properties?.mmsi);
          return vessels.get(mmsi);
        };
        for (const layer of ["ships-still", "ships-moving"]) {
          map.on("click", layer, (event) => {
            const vessel = vesselAt(event);
            if (vessel) openPopup([vessel.lon, vessel.lat], shipPopup(vessel), vessel.mmsi);
          });
        }
        map.on("click", "rail-hit", (event) => {
          // Ships and radio events sit above the track, so let their handlers win.
          if (map!.queryRenderedFeatures(event.point, { layers: ["ships-still", "ships-moving", ...RAIL_LAYERS] }).length) return;
          const feature = event.features?.[0];
          if (feature) openPopup([event.lngLat.lng, event.lngLat.lat], railPopup(feature.properties), null);
        });
        for (const layer of ["ships-still", "ships-moving", "rail-hit", ...RAIL_LAYERS]) {
          map.on("mouseenter", layer, () => (map!.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map!.getCanvas().style.cursor = ""));
        }

        events = new EventSource("/map/ships");
        events.addEventListener("vessels", (event) => {
          for (const vessel of JSON.parse(event.data) as Vessel[]) vessels.set(vessel.mmsi, vessel);
          schedule();
        });
        // Re-fade ships as their last position ages.
        ager = setInterval(schedule, 30_000);
        render();
      });
    })();

    return () => {
      disposed = true;
      unsubscribeRail();
      events?.close();
      clearInterval(ager);
      cancelAnimationFrame(frame);
      map?.remove();
    };
  }, []);

  return (
    <div className="map-frame">
      <div ref={container} className="live-map" />
      {railStatus === "on" ? <LiveRadio /> : null}
    </div>
  );
}
