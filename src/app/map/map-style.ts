import type { StyleSpecification } from "maplibre-gl";

// A quiet basemap on OpenFreeMap's OpenMapTiles vector tiles, so the rail and ships carry the page.
// The basemap's own railways are left out on purpose; the rail layer comes from BTS instead.
export const palette = {
  land: "#f8f7f4",
  water: "#dfe5e6",
  waterLine: "#cfd8da",
  park: "#eff0e8",
  road: "#ebe8e1",
  roadMajor: "#e3dfd6",
  boundary: "#cbc6bc",
  label: "#8b867d",
  waterLabel: "#8c9fa3",
  rail: "#2b2925",
};

const font = ["Noto Sans Regular"];

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    base: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>',
    },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": palette.land } },
    {
      id: "park",
      type: "fill",
      source: "base",
      "source-layer": "park",
      minzoom: 8,
      paint: { "fill-color": palette.park },
    },
    // Under the water, so state lines stop at the shore.
    {
      id: "boundary",
      type: "line",
      source: "base",
      "source-layer": "boundary",
      filter: ["==", ["get", "admin_level"], 4],
      paint: { "line-color": palette.boundary, "line-width": 0.8, "line-dasharray": [3, 2] },
    },
    {
      id: "water",
      type: "fill",
      source: "base",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": palette.water },
    },
    {
      id: "waterway",
      type: "line",
      source: "base",
      "source-layer": "waterway",
      filter: ["match", ["get", "class"], ["river", "canal"], true, false],
      paint: {
        "line-color": palette.waterLine,
        "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 8, 0.6, 14, 3],
      },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "base",
      "source-layer": "transportation",
      minzoom: 12,
      filter: ["match", ["get", "class"], ["minor", "service"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.road,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.5, 16, 4],
      },
    },
    {
      id: "roads-major",
      type: "line",
      source: "base",
      "source-layer": "transportation",
      minzoom: 8,
      filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk"], true, false],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.road,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 8, 0.4, 12, 1.2, 16, 6],
      },
    },
    {
      id: "roads-motorway",
      type: "line",
      source: "base",
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["==", ["get", "class"], "motorway"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": palette.roadMajor,
        "line-width": ["interpolate", ["exponential", 1.5], ["zoom"], 6, 0.5, 12, 2, 16, 8],
      },
    },
    {
      id: "water-label",
      type: "symbol",
      source: "base",
      "source-layer": "water_name",
      filter: ["all", ["==", ["geometry-type"], "Point"], ["match", ["get", "class"], ["ocean", "sea", "lake"], true, false]],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": font,
        "text-size": 12,
        "text-letter-spacing": 0.2,
        "text-transform": "uppercase",
      },
      paint: { "text-color": palette.waterLabel },
    },
    {
      id: "place-label",
      type: "symbol",
      source: "base",
      "source-layer": "place",
      filter: [
        "any",
        ["==", ["get", "class"], "city"],
        ["all", ["==", ["get", "class"], "town"], [">=", ["zoom"], 9]],
        ["all", ["match", ["get", "class"], ["village", "suburb"], true, false], [">=", ["zoom"], 11.5]],
      ],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": font,
        "text-size": ["match", ["get", "class"], "city", 13, 11],
        "text-letter-spacing": 0.04,
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: {
        "text-color": palette.label,
        "text-halo-color": palette.land,
        "text-halo-width": 1.4,
      },
    },
  ],
};
