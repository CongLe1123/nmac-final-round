import { getCurrentRound, subscribe } from "@/lib/round";

export const dynamic = "force-dynamic";

export async function GET(req) {
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Ensure we never enqueue to a closed controller
      const safeEnqueue = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch (_err) {
          // If enqueue throws, mark closed to stop future writes
          closed = true;
        }
      };

      const send = (round) => {
        if (closed) return;
        const data = JSON.stringify({ round });
        safeEnqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send the initial state immediately
      send(getCurrentRound());

      // Subscribe for updates
      const unsubscribe = subscribe(send);

      // Heartbeat every 15s to keep connection alive
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
        } catch (_) {
          // ignore if already closed
        }
      };

      // When the stream is canceled by the client
      controller.oncancel = close;

      // Also listen for request aborts (e.g., client disconnects)
      try {
        req?.signal?.addEventListener("abort", close);
      } catch (_) {
        // ignore if signal is not available
      }
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
