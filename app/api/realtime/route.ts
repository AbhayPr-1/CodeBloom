import { subscribeToRealtimeChannel, type RealtimeEventPayload } from "@/lib/realtime/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") || "global";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send initial connected confirmation
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ channel, status: "active" })}\n\n`)
      );

      // 2. Subscribe to realtime event bus
      const unsubscribe = subscribeToRealtimeChannel(channel, (payload: RealtimeEventPayload) => {
        try {
          const sseMessage = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
          controller.enqueue(encoder.encode(sseMessage));
        } catch {
          // Client disconnected
        }
      });

      // 3. Heartbeat ping to keep connection alive through cloud proxies
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(interval);
          unsubscribe();
        }
      }, 20_000);

      // 4. Handle client abort
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disables nginx buffering
    },
  });
}

