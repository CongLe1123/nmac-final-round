import { subscribe } from "@/lib/events";
import { getGameState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const safeEnqueue = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch (_) {
          closed = true;
        }
      };

      const send = (event) => {
        if (closed) return;
        const data = JSON.stringify(event);
        safeEnqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send initial snapshot
      send({ type: "init", payload: getGameState(), ts: Date.now() });

      // Subscribe to updates
      const unsubscribe = subscribe(send);

      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      controller.oncancel = close;
      try {
        req?.signal?.addEventListener("abort", close);
      } catch {}
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
