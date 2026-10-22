// One delayed feed of new clips per server process, fanned out to every visitor of /rail/radio/api/stream.
// Everything on /rail runs an hour behind, so instead of relaying the hub's live stream this polls the hub for
// clips that have just crossed the delay line. By then Jev has read them and Luna has put them in runs.
import { chicagoIso, DELAY_MS } from "./delay";
import { isPrivateClip, type RailClip } from "./rail";

type Listener = (clip: RailClip) => void;

const POLL_MS = 5_000;
// Each poll looks back this far, so a clip that reached the hub a little late still goes out.
const OVERLAP_MS = 5 * 60_000;

class RadioHub {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sent = new Map<string, number>();
  private primed = false;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (!this.timer) this.schedule(0);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size > 0) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.sent.clear();
      this.primed = false;
    };
  }

  private schedule(delay: number) {
    this.timer = setTimeout(async () => {
      await this.poll();
      if (this.listeners.size > 0) this.schedule(POLL_MS);
    }, delay);
  }

  private async poll() {
    const base = process.env.RAIL_API_URL;
    const token = process.env.RAIL_API_TOKEN;
    if (!base || !token) return;
    const line = Date.now() - DELAY_MS;
    const params = new URLSearchParams({
      after: chicagoIso(line - OVERLAP_MS),
      before: chicagoIso(line),
      limit: "300",
      meaningful: "1",
    });
    let clips: RailClip[];
    try {
      const response = await fetch(`${base}/api/rail/clips?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok) return;
      clips = ((await response.json()) as { clips: RailClip[] }).clips;
    } catch {
      return;
    }
    clips.sort((a, b) => a.t - b.t);
    for (const clip of clips) {
      if (this.sent.has(clip.name)) continue;
      this.sent.set(clip.name, clip.t);
      // Visitors load what's already past the line themselves; only send what crosses it from now on.
      if (this.primed && !isPrivateClip(clip)) for (const listener of this.listeners) listener(clip);
    }
    this.primed = true;
    for (const [name, t] of this.sent) if (t < line - 2 * OVERLAP_MS) this.sent.delete(name);
  }
}

const globalForRadio = globalThis as unknown as { radioHub?: RadioHub };
export const radioHub = (globalForRadio.radioHub ??= new RadioHub());
