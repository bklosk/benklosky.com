# /map

A live map of ships and freight rail around Chicago. It sits right of the sidebar as a rounded frame that fills the window's height. On desktop `.composition--map` shifts the sidebar left of where article pages put it. Sources and their terms are tracked in [data.md](data.md).

## Files

| File | Role |
| --- | --- |
| [page.tsx](page.tsx) | Route and metadata. Renders `LiveMap`. |
| [live-map.tsx](live-map.tsx) | Client component. Creates the MapLibre map, adds the rail and ship layers, listens to `/map/ships`, and draws popups. |
| [map-style.ts](map-style.ts) | Hand-written basemap style on OpenFreeMap tiles, and the shared palette. |
| [map.css](map.css) | Frame, sidebar offset, and popup styles. |
| [ais.ts](ais.ts) | Server-only hub. Holds one aisstream.io WebSocket per server process, normalizes messages into `Vessel` records, and batches updates once a second. |
| [ships/route.ts](ships/route.ts) | `GET /map/ships`. Server-sent events: `status`, then a `vessels` snapshot, then `vessels` batches, with a keepalive every 20 seconds. |
| [vessel.ts](vessel.ts) | `Vessel` type and AIS ship-type grouping, shared by server and client. |
| [region.ts](region.ts) | The AIS subscription box and the opening view. |
| [../../../scripts/build-rail-lines.mjs](../../../scripts/build-rail-lines.mjs) | Rebuilds `public/map/rail-lines.geojson` from BTS. |

## How ships get to the page

```
aisstream.io ──WebSocket──▶ ais.ts (one per server) ──SSE──▶ /map/ships ──▶ EventSource in live-map.tsx
```

- The browser never sees the API key.
- The hub connects when the first visitor arrives and stays connected for 5 minutes after the last one leaves. Each new visitor gets the vessels the hub has heard in the last 30 minutes right away.
- If the key is missing, or aisstream keeps refusing the connection, the stream reports `unavailable`. The page doesn't show this; no ships appear and the rest of the map still works.
- A ship's dart rotates by heading, or by course when heading isn't reported. A ship slower than 0.5 knots is drawn as a dot. Ships fade over 30 minutes after their last position, and their color comes from the AIS ship type.

This relies on a long-lived Node or Bun server, which is how `bun run start` runs on DigitalOcean App Platform. On serverless hosting each instance would hold its own upstream connection and its own cache.

## Running locally

1. Put `AISSTREAM_API_KEY=...` in `.env` at the repo root. Get a free key at <https://aisstream.io>.
2. Run `bun run dev` and open <http://localhost:3000/map>.

Without a key, the rail layer and basemap still load and no ships appear.

## MapLibre worker

MapLibre 6 loads its web worker from a file next to its own module, which bundling moves. `live-map.tsx` calls `setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url))` so Turbopack emits the worker as a static asset. If tiles stop drawing after a MapLibre upgrade, check this first.

## Next steps

- Feed transcribed calls from the home RTL-SDR at `sdr.local` into the map as events. See the sdr.local section in [data.md](data.md).
- Add a Marey (stringline) view per subdivision, driven by the same timeline as the map.
