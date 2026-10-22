// GET /map/radio/{api/<route>,audio/<clip>,live}: the browser's only way to the home SDR's data.
// Requests go from this server to the rail hub on the oink droplet over DigitalOcean's private VPC network,
// with a bearer token the browser never sees. Nothing reaches the Raspberry Pi from here.
import { radioAuthorized } from "../auth";

const API_ROUTES = new Set(["health", "channels", "clips", "runs", "stream"]);
const CLIP = /^\d{4}\/\d{2}\/\d{2}\/AAR\d{2}_\d{8}_\d{6}\.mp3$/;
const PASS_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];

function target(path: string[], search: string) {
  if (path[0] === "api" && path.length === 2 && API_ROUTES.has(path[1])) return `/api/rail/${path[1]}${search}`;
  if (path[0] === "audio" && CLIP.test(path.slice(1).join("/"))) return `/audio/${path.slice(1).join("/")}`;
  if (path[0] === "live" && path.length === 1) return "/live/rail.mp3";
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await radioAuthorized())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const path = target((await params).path, new URL(request.url).search);
  if (!path) return Response.json({ error: "not found" }, { status: 404 });

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
  if (path.startsWith("/api/rail/stream")) {
    out.set("cache-control", "no-cache, no-transform");
    out.set("x-accel-buffering", "no");
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
