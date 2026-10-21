// Server-sent events: the current fleet on connect, then batched updates as AIS messages arrive.
import { aisHub } from "../ais";

export function GET(request: Request) {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const unsubscribe = aisHub.subscribe((event) => {
        if ("status" in event) send("status", event.status);
        else send("vessels", event.vessels);
      });
      send("status", aisHub.status);
      send("vessels", aisHub.snapshot());
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
