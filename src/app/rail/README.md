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
| [rail.ts](rail.ts) | Radio clip types and placing clips on the map (yard and subdivision centers from the BTS layer). |
| [rail-store.ts](rail-store.ts) | Client store shared by the map and the table: checks the session, pages history, and listens to the event stream. |
| [rail-history.tsx](rail-history.tsx) | The radio log table under the map: search, channel filter, clip playback, sign out. |
| [radio/auth.ts](radio/auth.ts) | Server-only. The password check and the signed 30-day session cookie. |
| [radio/page.tsx](radio/page.tsx) | `/map/radio`, the sign-in form. `radio/login` and `radio/logout` set and clear the session. |
| [radio/[...path]/route.ts](radio/%5B...path%5D/route.ts) | `GET /map/radio/{api/*,audio/*,live}`. Checks the session, then relays to the rail hub over the VPC with a bearer token. |
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

## Radio from the home SDR (only for Ben, for now)

```
RTL-SDR ─▶ rtl_airband ─▶ rail-classify ─▶ rail-transcribe (Parakeet) ─▶ rail-ship ──tailnet──▶ rail hub (oink droplet)
                                         Raspberry Pi                                        SQLite WAL, Jev events, Luna runs,
                                                                                             Grafana, daily Spaces backup
browser ──▶ benklosky.com /map/radio/* (session cookie) ──VPC + bearer token──▶ rail hub read API ──tailnet──▶ Pi Icecast (live only)
```

- **The browser never reaches the Pi or the hub.** It calls this site's `/map/radio/*` routes. They check the session and relay to the hub's read API at its private VPC address (`RAIL_API_URL`) with `RAIL_API_TOKEN`. The hub's API listens only on the VPC and the tailnet.
- **Sign in** at `/map/radio` with `RADIO_PASSWORD`. That sets an httpOnly session cookie signed with `RADIO_SESSION_SECRET`, plus a readable `map_radio_hint` cookie. The hint only tells the page to look for the radio layer, so other visitors' browsers never call the radio routes. `/map` stays a static page.
- **Listen live** plays the Pi's Icecast mix of every AAR channel, relayed by the hub. Each clip plays its own MP3 from the hub, with Range support.
- **Map dots** are meaningful transmissions from the last hour, colored by event category and fading as they age. A filled dot sits on the yard or numbered street the event names. A hollow ring is placed only by its channel's home yard or subdivision. Channels with no label aren't drawn, but they do appear in the table.
- **The radio log** shows meaningful transmissions newest first. Search is SQLite full-text search on the hub. New clips arrive over server-sent events, and a row gets its event once Jev has read it.
- **Local dev** sets `RAIL_API_URL=http://oink:8091` in `.env` and reaches the hub over the tailnet. The hub and Pi code lives in `~/trading/rail-extract/hub` (see its README).

## Running locally

1. Put `AISSTREAM_API_KEY=...` in `.env` at the repo root. Get a free key at <https://aisstream.io>.
2. Run `bun run dev` and open <http://localhost:3000/map>.

Without a key, the rail layer and basemap still load and no ships appear.

## MapLibre worker

MapLibre 6 loads its web worker from a file next to its own module, which bundling moves. `live-map.tsx` calls `setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url))` so Turbopack emits the worker as a static asset. If tiles stop drawing after a MapLibre upgrade, check this first.

## Next steps

- Draw Luna's train runs as paths through the places they visit, not only per-clip dots.
- Add a Marey (stringline) view per subdivision, driven by the same timeline as the map.
