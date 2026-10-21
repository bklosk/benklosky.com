# Map data sources

The data behind `/map`: what each source is, how the site gets it, and its terms. Update this file whenever a source is added, dropped, or changes how it's accessed.

| Source | What it gives | How the site gets it | Status |
| --- | --- | --- | --- |
| [aisstream.io](#aisstreamio) | Live ship positions and identities | Server WebSocket, relayed to browsers | Live on the map |
| [OpenMHz](#openmhz) | Recorded radio calls from trunked systems | Not integrated in code | In use for listening; API blocked for server clients |
| [BTS North American Rail Network](#bts-north-american-rail-network) | Freight rail track geometry and ownership | Snapshot built by a script | Live on the map |
| [OpenFreeMap](#openfreemap) | Basemap vector tiles and fonts | Browser loads tiles directly | Live on the map |
| [sdr.local](#sdrlocal-planned) | Radio audio from the home RTL-SDR | Not built yet | Planned replacement for third-party audio |

## aisstream.io

- **What:** Terrestrial AIS messages, worldwide, as a WebSocket stream. The map subscribes to the `REGION` box in [region.ts](region.ts), which covers Chicagoland, southern Lake Michigan, and the top of the Illinois Waterway.
- **Messages used:** `PositionReport`, `StandardClassBPositionReport`, and `ExtendedClassBPositionReport` give position, course, speed, and heading. `ShipStaticData` and `StaticDataReport` give name, type, destination, and length. Static messages broadcast about every 6 minutes, so a vessel's type and color can lag its first position.
- **Access:** `wss://stream.aisstream.io/v0/stream` with an API key sent in the subscription message. The key must stay server-side, so [ais.ts](ais.ts) holds one shared upstream connection per server process. [ships/route.ts](ships/route.ts) relays it to browsers as server-sent events at `/map/ships`.
- **Credentials:** `AISSTREAM_API_KEY`. Locally it lives in the gitignored `.env`. In production it's an encrypted run-time secret on the `benklosky-com` component of the DigitalOcean app `coral-app` (doctl context `default`).
- **Retention:** Nothing is stored. The relay keeps vessels heard in the last 30 minutes in memory, and up to 40 recent positions each for trails.
- **Limits:** The stream is free and best-effort, with no uptime guarantee. Coverage depends on volunteer shore stations, and is good on the lakefront and Chicago River. In a quiet hour the region may send only a few messages a minute.
- **Terms:** <https://aisstream.io>. AIS is broadcast for public reception.

## OpenMHz

- **What:** Recorded calls from trunked radio systems, uploaded by volunteers running trunk-recorder. Calls come with talkgroup, time, and an audio file.
- **Access:** Used by hand in the browser at <https://openmhz.com>. The site doesn't call it. On 2026-10-21, `https://api.openmhz.com/systems` returned a Cloudflare challenge (HTTP 403) to non-browser clients, so a server integration would need OpenMHz's permission or an API arrangement.
- **Coverage caveat:** OpenMHz only carries systems that feeders upload, and mostly trunked ones. Railroad road and yard channels are conventional, not trunked, so they mostly aren't there. Encrypted public safety talkgroups never are.
- **Terms:** Check before redistributing audio or transcripts. Published events and short excerpts are lower risk than rebroadcasting full audio.

## BTS North American Rail Network

- **What:** The NTAD North American Rail Network Lines dataset from the Bureau of Transportation Statistics. It has track geometry with owner, trackage rights, subdivision, yard name, network class, and track count.
- **Access:** [scripts/build-rail-lines.mjs](../../../scripts/build-rail-lines.mjs) queries the public ArcGIS FeatureServer and writes `public/map/rail-lines.geojson`. Run it again to refresh:

  ```bash
  node scripts/build-rail-lines.mjs
  ```

- **Filtering:** The script keeps active main, other, yard, industry, and siding track (network classes M, O, Y, I, S). It drops abandoned, railbanked, out-of-service, and transit segments. It also drops any segment used only by passenger operators (Metra/NIRC, South Shore/NICD, Amtrak, CTA), so the layer shows freight rail, not public transit. Metra-owned track that carries freight, such as CPKC on the Milwaukee District, stays.
- **Snapshot:** Each file records its `retrieved` date. The upstream dataset says it's updated periodically from FRA data.
- **Terms:** US government public data.

## OpenFreeMap

- **What:** Free OpenStreetMap vector tiles in the OpenMapTiles schema, plus glyphs for labels.
- **Access:** The browser loads `https://tiles.openfreemap.org/planet` and its fonts directly. No key needed. [map-style.ts](map-style.ts) is a hand-written style that draws only land, water, parks, roads, state lines, and labels. It leaves out the basemap's own railways.
- **Attribution:** OpenFreeMap asks for "OpenFreeMap · © OpenMapTiles · © OpenStreetMap" to be shown, and OpenStreetMap data is ODbL. The map currently shows no credit line; add one back on this page or in a site-wide footer if you want to meet that.
- **Terms:** <https://openfreemap.org>.

## sdr.local (planned)

- **What:** An RTL-SDR on a Raspberry Pi on the home network at `sdr.local`, tuned to marine and railroad VHF. It will replace third-party audio feeds as the source for transcribed calls.
- **Access:** Not built yet. `sdr.local` is an mDNS name, so it only resolves on the home LAN, and the production server can't reach it. The Pi should push outward, by posting transcribed events or short clips to an authenticated endpoint on the site, rather than having the site pull from it.
- **Publishing rules:** Publish derived events (train, location, time, event type) and keep raw audio private by default. Leave out crew names and personal details. Delay anything live. Never decode encrypted, cellular, or pager traffic.
