# /rail

A map of freight rail, railroad radio, trains, and ships around Chicago, **all delayed by 60 minutes** (a one-line caption on the map says so). It used to live at `/map`, which now redirects here. It sits right of the sidebar as a rounded frame that fills the window's height. On desktop `.composition--map` shifts the sidebar left of where article pages put it. Sources and their terms are tracked in [data.md](data.md).

## Files

| File | Role |
| --- | --- |
| [page.tsx](page.tsx) | Route and metadata. Renders `LiveMap`. |
| [live-map.tsx](live-map.tsx) | Client component. Creates the MapLibre map, adds the rail, ship, radio and train layers, listens to `/rail/ships`, draws popups, and draws the selected ship's or train's trail. |
| [delay.ts](delay.ts) | The 60-minute delay (`DELAY_MS`), the delayed clock, and Chicago local-time helpers. Shared by server and client. |
| [../../instrumentation.ts](../../instrumentation.ts) | Starts the AIS relay when the server starts, so the delayed ship picture is ready before the first visitor. |
| [map-style.ts](map-style.ts) | Hand-written basemap style on OpenFreeMap tiles, and the shared palette. |
| [map.css](map.css) | Frame, sidebar offset, and popup styles. |
| [ais.ts](ais.ts) | Server-only hub. Holds one aisstream.io WebSocket per server process, keeps each vessel's fixes for the delay plus an hour of trail, and every 2 seconds publishes vessels whose hour-old position changed. |
| [ships/route.ts](ships/route.ts) | `GET /rail/ships`. Server-sent events: `status`, then a `vessels` snapshot, then `vessels` batches, with a keepalive every 20 seconds. |
| [vessel.ts](vessel.ts) | `Vessel` type and AIS ship-type grouping, shared by server and client. |
| [region.ts](region.ts) | The AIS subscription box and the opening view. |
| [rail.ts](rail.ts) | Radio clip and run types, placing clips on the map (yard and subdivision centers from the BTS layer), building trains from Luna's runs, and following Metra trains along their GTFS trips. |
| [rail-store.ts](rail-store.ts) | Client store shared by the map and the table: checks the hub, pages history, keeps 3 hours of clips and runs (and the Metra trips they matched) for the map, and listens to the event stream. |
| [rail-history.tsx](rail-history.tsx) | The radio log table under the map: search, channel filter, clip playback. |
| [radio/[...path]/route.ts](radio/%5B...path%5D/route.ts) | `GET /rail/radio/{api/*,audio/*}`. Relays to the rail hub over the VPC with a bearer token, and holds back anything newer than the delay line. |
| [radio-hub.ts](radio-hub.ts) | Server-only. One delayed clip feed per server process: polls the hub for clips crossing the delay line and fans them out to every visitor. |
| [../../../scripts/build-rail-lines.mjs](../../../scripts/build-rail-lines.mjs) | Rebuilds `public/rail/rail-lines.geojson` from BTS. |

## How ships get to the page

```
aisstream.io ──WebSocket──▶ ais.ts (one per server, 2 h of fixes) ──SSE, an hour late──▶ /rail/ships ──▶ EventSource in live-map.tsx
```

- The browser never sees the API key, and never sees a position less than an hour old.
- The hub connects when the server starts and stays connected. **After a deploy or restart, ships take an hour to appear**, because nothing older than the restart is in memory.
- Each new visitor gets every vessel as it was an hour ago right away, then updates as hour-old fixes come due.
- If the key is missing, or aisstream keeps refusing the connection, the stream reports `unavailable`. The page doesn't show this; no ships appear and the rest of the map still works.
- A ship's dart rotates by heading, or by course when heading isn't reported. A ship slower than 0.5 knots is drawn as a dot. Ships fade over 30 delayed minutes after their last position, and their color comes from the AIS ship type.
- A ship's trail (up to an hour, 40 points) is drawn only while its popup is open, in its ship-type color.

This relies on a long-lived Node or Bun server, which is how `bun run start` runs on DigitalOcean App Platform. On serverless hosting each instance would hold its own upstream connection and its own cache.

## Railroad radio from the home SDR

```
RTL-SDR ─▶ rtl_airband ─▶ rail-classify ─▶ rail-transcribe (Parakeet) ─▶ rail-ship ──tailnet──▶ rail hub (oink droplet)
                                         Raspberry Pi                                        SQLite WAL, Jev events, Luna runs,
                                                                                             Grafana, daily Spaces backup
browser ──▶ benklosky.com /rail/radio/* ──VPC + bearer token──▶ rail hub read API ──tailnet──▶ Pi Icecast (live only)
```

- **Public, no sign-in.** The browser never reaches the Pi or the hub. It calls this site's `/rail/radio/*` routes, which relay to the hub's read API at its private VPC address (`RAIL_API_URL`) with `RAIL_API_TOKEN`. The hub API listens only on the VPC and the tailnet.
- **An hour late, enforced on the server.** The relay clamps every `clips` query to `before=<an hour ago>`, refuses clip audio whose file name is newer than that, answers `health` with only `{ok}`, and doesn't relay the hub's live mix. For a Luna window the delay line is still inside, `runs` keeps only the transmissions before the line and drops the run's summaries (narrative, status, issues, authorities), which were written with the whole window in view.
- **No police or EMS radio.** `isPrivate` in [rail.ts](rail.ts) leaves out AAR17 (Amtrak Police at Union Station), clips Jev calls `police_security` or `non_rail` (outside agencies), and clips flagged `police_ems_or_pii` (police or EMS dealing with a member of the public, or their name, age, address or phone number; older clips used `sensitive`). The relay drops them from clip lists, search, the delayed stream, audio fetched by name, and run timelines.
- **One upstream feed.** [radio-hub.ts](radio-hub.ts) polls the hub every 5 seconds for clips that just crossed the delay line and fans them out to every visitor. By then Jev has read each clip and Luna has put it in a run. The hub's own live event stream is no longer used by the site.
- **Listen** plays each transmission as it crosses the delay line, an hour after it was heard. Each clip plays its own MP3 from the hub, with Range support.
- **Trains** are Luna's runs, merged across half-hour windows by `run_id` into one train per channel and run. A train's badge shows its number and is colored by what it is: passenger blue, freight orange, track work green, gray if unknown. A train sits where its last transmission that named a place put it. A hollow badge never named a place and sits near its channel's home. A train leaves the map 45 delayed minutes after it was last heard. Clicking a badge shows every transmission in the run, newest first, with Luna's note, the transcript and audio, and draws its trail.
- **Metra trains on their GTFS trips.** On channels Metra trains use, the hub matches a passenger run's train number to a trip in Metra's published GTFS schedule (`runs.gtfs_trip`; see the hub README). The map then places the train along that trip's shape at its scheduled position, shifted by how late the radio has it. The radio sets the shift from the last stop a transmission placed it at. Its trail is the trip so far. It stays on the map while its timetable has it running.
- **Road crossings.** Luna lists public-interest incidents for each half-hour window (see the hub README). The relay passes only road-crossing ones (blocked, gates or lights malfunctioning, a train striking something), held to the delay line, from public channels. Each is a crossbuck at the named crossing when it can be placed (numbered streets and the grid streets in `STREET_LON`/`STREET_LAT`, snapped to the channel's track), otherwise near the channel's home. It shows while open (up to two hours with no end heard) and fades for an hour after it clears; the popup gives the times, how long it lasted, and Luna's one-line description.
- **Map dots** are meaningful transmissions from the last hour that no train on the map carries, colored by event category and fading as they age. A filled dot sits on the yard or numbered street the event names. A hollow ring is placed only by its channel's home yard or subdivision. Channels with no label aren't drawn, but they do appear in the table.
- **The radio log** shows meaningful transmissions newest first. Search is SQLite full-text search on the hub. New clips arrive over server-sent events as they cross the delay line. Clicking a row that belongs to a train on the map opens that train with the row highlighted.
- **Without the hub** (no `RAIL_API_URL`/`RAIL_API_TOKEN`, or it's unreachable), the radio parts don't render and the map works as before.
- **Local dev** sets `RAIL_API_URL=http://oink:8091` and `RAIL_API_TOKEN` in `.env` and reaches the hub over the tailnet. The hub and Pi code lives in `~/trading/rail-extract/hub` (see its README).

## Running locally

1. Put `AISSTREAM_API_KEY=...` in `.env` at the repo root. Get a free key at <https://aisstream.io>.
2. Run `bun run dev` and open <http://localhost:3000/rail>.

Without a key, the rail layer and basemap still load and no ships appear.

## MapLibre worker

MapLibre 6 loads its web worker from a file next to its own module, which bundling moves. `live-map.tsx` calls `setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url))` so Turbopack emits the worker as a static asset. If tiles stop drawing after a MapLibre upgrade, check this first.

## Next steps

- Marine radio: the SDR has one dongle, tuned to the 160–161.6 MHz AAR band, so marine VHF (156–157 MHz) isn't recorded. A second dongle on marine channels 13/14/16 would let transmissions that name a vessel attach to its AIS ship.
- Add South Shore (NICTD) and Amtrak GTFS the same way as Metra.
- Add a Marey (stringline) view per subdivision, driven by the same timeline as the map.
