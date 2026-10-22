// GET /rail/radio/{api/<route>,audio/<clip>}: the browser's only way to the home SDR's data.
// Requests go from this server to the rail hub on the oink droplet over DigitalOcean's private VPC network,
// with a bearer token the browser never sees. Nothing reaches the Raspberry Pi from here.
// Everything here is held back an hour (see delay.ts): clips, runs and audio newer than the delay line aren't served,
// and the hub's live mix isn't relayed at all. Metra's published schedule (api/metra) isn't live data, so it isn't.
// Police and EMS radio and other private transmissions (isPrivate in rail.ts) are left out of every response.
import { delayLine } from "../../delay";
import { isPrivate, isPrivateClip, type RailClip, type RailRun } from "../../rail";
import { radioHub } from "../../radio-hub";

const API_ROUTES = new Set(["health", "channels", "clips", "runs", "metra"]);
const AUDIO = /^\d{4}\/\d{2}\/\d{2}\/(AAR\d{2})_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mp3$/;
const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];

function target(path: string[], params: URLSearchParams) {
  if (path[0] === "api" && path.length === 2 && API_ROUTES.has(path[1])) {
    if (path[1] === "clips") {
      const before = params.get("before");
      const line = delayLine();
      if (!before || before > line) params.set("before", line);
    }
    return `/api/rail/${path[1]}?${params}`;
  }
  const clip = path.slice(1).join("/");
  const match = path[0] === "audio" ? clip.match(AUDIO) : null;
  if (match) {
    const [, , year, month, day, hour, minute, second] = match;
    if (`${year}-${month}-${day}T${hour}:${minute}:${second}` < delayLine()) return `/audio/${clip}`;
  }
  return null;
}

// Whether a clip, named by its audio file, is private. The hub is asked once per clip; the answer is kept a while.
const privacy = new Map<string, { private: boolean; at: number }>();

async function privateAudio(channel: string, iso: string, name: string) {
  const known = privacy.get(name);
  if (known && Date.now() - known.at < 10 * 60_000) return known.private;
  const second = (delta: number) => new Date(Date.parse(`${iso}Z`) + delta).toISOString().slice(0, 19);
  const params = new URLSearchParams({ channel, after: second(-1000), before: second(1000), meaningful: "0", limit: "10" });
  const response = await fetch(`${process.env.RAIL_API_URL}/api/rail/clips?${params}`, {
    headers: { Authorization: `Bearer ${process.env.RAIL_API_TOKEN}` },
    cache: "no-store",
  });
  if (!response.ok) return true;
  const clip = ((await response.json()) as { clips: RailClip[] }).clips.find((candidate) => candidate.name === name);
  const answer = !clip || isPrivateClip(clip);
  if (privacy.size > 5000) privacy.clear();
  privacy.set(name, { private: answer, at: Date.now() });
  return answer;
}

function windowEnd(start: string) {
  return new Date(Date.parse(`${start}Z`) + 30 * 60_000).toISOString().slice(0, 19);
}

// Luna writes a run for each half-hour window. A window the delay line is still inside keeps only the transmissions
// before the line, and drops the summaries, which were written with the rest of the window in view.
function delayRuns(runs: RailRun[]) {
  const line = delayLine();
  return runs.flatMap((run) => {
    // Runs are told through their transmissions, so a private transmission's entry goes, and a run left with none.
    const shown = run.timeline.filter((event) => !isPrivate(run.channel, event.clip_kind, event.flags));
    if (!shown.length) return [];
    if (shown.length < run.timeline.length) run = { ...run, timeline: shown };
    if (windowEnd(run.window_start) <= line) return [run];
    const timeline = run.timeline.filter((event) => event.ts && event.ts < line);
    if (!timeline.length) return [];
    const said = timeline.map((event) => event.detail ?? "").join(" ").toLowerCase();
    const heard = (items: string[]) => items.filter((item) => said.includes(item.toLowerCase()));
    return [
      {
        ...run,
        timeline,
        first_seen: timeline[0].ts,
        last_seen: timeline[timeline.length - 1].ts,
        locations: heard(run.locations),
        tracks: heard(run.tracks),
        authorities: [],
        issues: [],
        status_at_end: null,
        narrative: null,
      },
    ];
  });
}

// Every visitor shares one upstream feed (see radio-hub.ts).
function stream(request: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const body = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const unsubscribe = radioHub.subscribe((clip) => write(`event: clip\ndata: ${JSON.stringify(clip)}\n\n`));
      write("event: ready\ndata: {}\n\n");
      // Keeps proxies from closing a quiet connection.
      const heartbeat = setInterval(() => write(": keepalive\n\n"), 20_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        cleanup = () => {};
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const segments = (await params).path;
  if (segments.join("/") === "api/stream") return stream(request);
  const path = target(segments, new URL(request.url).searchParams);
  if (!path) return Response.json({ error: "not found" }, { status: 404 });
  if (!process.env.RAIL_API_URL || !process.env.RAIL_API_TOKEN) {
    return Response.json({ error: "radio not configured" }, { status: 503 });
  }
  if (segments[0] === "audio") {
    const [, channel, year, month, day, hour, minute, second] = segments.slice(1).join("/").match(AUDIO)!;
    const name = segments[segments.length - 1];
    if (await privateAudio(channel, `${year}-${month}-${day}T${hour}:${minute}:${second}`, name).catch(() => true)) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.RAIL_API_TOKEN}` };
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  let upstream: Response;
  try {
    upstream = await fetch(`${process.env.RAIL_API_URL}${path}`, { headers, signal: request.signal, cache: "no-store" });
  } catch {
    return Response.json({ error: "rail hub unreachable" }, { status: 502 });
  }

  // The hub's health names its newest clip and event, which would give away what's happening now.
  if (segments[1] === "health") return Response.json({ ok: upstream.ok }, { status: upstream.status });
  if (segments[1] === "runs" && upstream.ok) {
    const { runs } = (await upstream.json()) as { runs: RailRun[] };
    return Response.json({ runs: delayRuns(runs) }, { headers: { "cache-control": "no-store" } });
  }
  if (segments[1] === "clips" && upstream.ok) {
    // The cursor comes from the hub's full page, so paging still works when private clips are left out.
    const page = (await upstream.json()) as { clips: RailClip[]; next_before: string | null };
    return Response.json(
      { ...page, clips: page.clips.filter((clip) => !isPrivateClip(clip)) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const out = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
