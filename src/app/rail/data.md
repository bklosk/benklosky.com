# Map data sources

The data behind `/rail`: what each source is, how the site gets it, and its terms. Update this file whenever a source is added, dropped, or changes how it's accessed.

| Source | What it gives | How the site gets it | Status |
| --- | --- | --- | --- |
| [aisstream.io](#aisstreamio) | Live ship positions and identities | Server WebSocket, relayed to browsers | Live on the map |
| [OpenMHz](#openmhz) | Recorded radio calls from trunked systems | Not integrated in code | In use for listening; API blocked for server clients |
| [BTS North American Rail Network](#bts-north-american-rail-network) | Freight rail track geometry and ownership | Snapshot built by a script | Live on the map |
| [OpenFreeMap](#openfreemap) | Basemap vector tiles and fonts | Browser loads tiles directly | Live on the map |
| [Metra GTFS](#metra-gtfs) | Metra's published schedule: trips, stops, times, shapes | The rail hub downloads it daily | Used by Luna and the map |
| [sdr.local](#sdrlocal-home-rtl-sdr) | Railroad radio from the home RTL-SDR: audio, transcripts, events, runs | Public on /rail | Ben's own receiver |

## aisstream.io

- **What:** Terrestrial AIS messages, worldwide, as a WebSocket stream. The map subscribes to the `REGION` box in [region.ts](region.ts), which covers Chicagoland, southern Lake Michigan, and the top of the Illinois Waterway.
- **Messages used:** `PositionReport`, `StandardClassBPositionReport`, and `ExtendedClassBPositionReport` give position, course, speed, and heading. `ShipStaticData` and `StaticDataReport` give name, type, destination, and length. Static messages broadcast about every 6 minutes, so a vessel's type and color can lag its first position.
- **Access:** `wss://stream.aisstream.io/v0/stream` with an API key sent in the subscription message. The key must stay server-side, so [ais.ts](ais.ts) holds one shared upstream connection per server process. [ships/route.ts](ships/route.ts) relays it to browsers as server-sent events at `/rail/ships`.
- **Credentials:** `AISSTREAM_API_KEY`. Locally it lives in the gitignored `.env`. In production it's an encrypted run-time secret on the `benklosky-com` component of the DigitalOcean app `coral-app` (doctl context `default`).
- **Retention:** Nothing is stored on disk. The relay keeps each vessel's fixes for the last 2 hours in memory (the hour of delay plus an hour of trail), thinned to one every 30 seconds for a vessel that isn't moving, and publishes positions an hour late.
- **Limits:** The stream is free and best-effort, with no uptime guarantee. Coverage depends on volunteer shore stations, and is good on the lakefront and Chicago River. In a quiet hour the region may send only a few messages a minute.
- **Terms:** <https://aisstream.io>. AIS is broadcast for public reception.

## OpenMHz

- **What:** Recorded calls from trunked radio systems, uploaded by volunteers running trunk-recorder. Calls come with talkgroup, time, and an audio file.
- **Access:** Used by hand in the browser at <https://openmhz.com>. The site doesn't call it. On 2026-10-21, `https://api.openmhz.com/systems` returned a Cloudflare challenge (HTTP 403) to non-browser clients, so a server integration would need OpenMHz's permission or an API arrangement.
- **Coverage caveat:** OpenMHz only carries systems that feeders upload, and mostly trunked ones. Railroad road and yard channels are conventional, not trunked, so they mostly aren't there. Encrypted public safety talkgroups never are.
- **Terms:** Check before redistributing audio or transcripts. Published events and short excerpts are lower risk than rebroadcasting full audio.

## BTS North American Rail Network

- **What:** The NTAD North American Rail Network Lines dataset from the Bureau of Transportation Statistics. It has track geometry with owner, trackage rights, subdivision, yard name, network class, and track count.
- **Access:** [scripts/build-rail-lines.mjs](../../../scripts/build-rail-lines.mjs) queries the public ArcGIS FeatureServer and writes `public/rail/rail-lines.geojson`. Run it again to refresh:

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

## Metra GTFS

- **What:** Metra's static GTFS schedule: routes, stops, trips with train numbers in their ids (`ME_ME214_V1_D` is Metra Electric train 214), stop times, calendars, and route shapes. About 650 KB zipped; Metra updates it every week or two.
- **Access:** `https://schedules.metrarail.com/gtfs/schedule.zip`, no key. The rail hub's `gtfs.py` downloads it at most once every 20 hours, when `railx.py runs` starts, into `/srv/rail/gtfs.db`. The site reads trips through the hub's `/api/rail/metra`, relayed at `/rail/radio/api/metra`.
- **Use:** Luna sees the Metra trains scheduled on a channel's line around each half-hour window, to tell a train number from a misheard one. Runs whose train number matches a scheduled trip are stored with it, and the map follows those trains along their trips. It isn't delayed, since it's a published timetable and not live data.
- **Not used:** Metra's GTFS-realtime feeds, which need an API key.
- **Terms:** Metra publishes the feed openly for developers. Its site blocks scripted requests (HTTP 403), so the terms page wasn't checked from here; read it before using the data beyond this map.

## sdr.local (home RTL-SDR)

- **What:** An RTL-SDR on a Raspberry Pi at home (`sdr` on the tailnet) recording the 97 AAR railroad channels.
  - The Pi transcribes each transmission with Parakeet and pushes transcripts and meaningful clips to the rail hub on the `oink` droplet (nyc1) over Tailscale.
  - On the hub, TypeSafe Jev extracts an event from each meaningful clip, and OpenAI `gpt-6-luna` summarizes each half hour of a channel into train runs.
  - Everything lives in the hub's SQLite database, `/srv/rail/rail.db`.
- **Access:** Public on `/rail`, with no sign-in.
  - The site's server reads the hub's API over DigitalOcean's VPC with a bearer token. The hub API isn't on the public internet.
  - Browsers only see `/rail/radio/*`: transcripts, extracted events, runs, and clip audio, all an hour late. The live mix isn't relayed.
  - The Pi keeps a 16-day outbox of transcripts and serves its live Icecast stream only to the tailnet.
- **Retention:**
  - The hub keeps transcripts, events and runs indefinitely, and meaningful clips' audio.
  - Every night it copies meaningful clips and per-day transcript JSONL to the `benklosky-data` Space under `sdr-rail/`.
  - It also keeps a single latest database snapshot at `sdr-rail/db/rail.db.gz`.
- **Publishing rules (published since 2026-10-22):** Publish derived events (train, location, time, event type) and keep raw audio private by default. Leave out crew names and personal details. Delay anything live: since 2026-10-22 everything on `/rail` is an hour late, enforced on the server. Police and EMS radio isn't published: Amtrak Police (AAR17), outside agencies, and clips Jev flags `police_ems_or_pii` are left out by the relay. Never decode encrypted, cellular, or pager traffic.
