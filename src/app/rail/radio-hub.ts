// One shared stream from the rail hub per server process, fanned out to every visitor of /rail/radio/api/stream.
// The hub allows only a few streams, so visitors must never each hold their own.
import type { RailClip } from "./rail";

type Listener = (clip: RailClip) => void;

const LINGER_MS = 5 * 60_000;

class RadioHub {
  private listeners = new Set<Listener>();
  private controller: AbortController | null = null;
  private attempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    if (this.lingerTimer) clearTimeout(this.lingerTimer);
    this.lingerTimer = null;
    if (!this.controller && !this.retryTimer) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.lingerTimer = setTimeout(() => this.disconnect(), LINGER_MS);
    };
  }

  private async connect() {
    const base = process.env.RAIL_API_URL;
    const token = process.env.RAIL_API_TOKEN;
    if (!base || !token) return;
    const controller = new AbortController();
    this.controller = controller;
    try {
      const response = await fetch(`${base}/api/rail/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok || !response.body) throw new Error(`stream: HTTP ${response.status}`);
      this.attempts = 0;
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (!frame.startsWith("event: clip")) continue;
          const data = frame.split("\n").find((line) => line.startsWith("data: "));
          if (!data) continue;
          try {
            const clip = JSON.parse(data.slice(6)) as RailClip;
            for (const listener of this.listeners) listener(clip);
          } catch {
            // Skip a malformed frame.
          }
        }
      }
    } catch {
      // Reconnect below unless we were told to stop.
    }
    if (this.controller !== controller) return;
    this.controller = null;
    if (this.listeners.size === 0) return;
    const delay = Math.min(60_000, 2_000 * 2 ** this.attempts++);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private disconnect() {
    this.lingerTimer = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const controller = this.controller;
    this.controller = null;
    controller?.abort();
  }
}

const globalForRadio = globalThis as unknown as { radioHub?: RadioHub };
export const radioHub = (globalForRadio.radioHub ??= new RadioHub());
