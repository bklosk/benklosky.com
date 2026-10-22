// GET /rail/radio/{api/<route>,audio/<clip>,live}: the browser's only way to the home SDR's data.
// Requests go from this server to the rail hub on the oink droplet over DigitalOcean's private VPC network,
// with a bearer token the browser never sees. Nothing reaches the Raspberry Pi from here.
import { radioHub } from "../../radio-hub";

const API_ROUTES = new Set(["health", "channels", "clips", "runs"]);
const CLIP = /^\d{4}\/\d{2}\/\d{2}\/AAR\d{2}_\d{8}_\d{6}\.mp3$/;
const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];

function target(path: string[], search: string) {
  if (path[0] === "api" && path.length === 2 && API_ROUTES.has(path[1])) return `/api/rail/${path[1]}${search}`;
  if (path[0] === "audio" && CLIP.test(path.slice(1).join("/"))) return `/audio/${path.slice(1).join("/")}`;
  if (path[0] === "live" && path.length === 1) return "/live/rail.mp3";
  return null;
}

// Every visitor shares one upstream stream (see radio-hub.ts).
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
  const path = target(segments, new URL(request.url).search);
  if (!path) return Response.json({ error: "not found" }, { status: 404 });
  if (!process.env.RAIL_API_URL || !process.env.RAIL_API_TOKEN) {
    return Response.json({ error: "radio not configured" }, { status: 503 });
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

  const out = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
