import { EventEmitter } from "events";

// Global event bus for server-sent events across active streams
declare global {
  var _realtimeBus: EventEmitter | undefined;
}

function getEventBus(): EventEmitter {
  if (!global._realtimeBus) {
    global._realtimeBus = new EventEmitter();
    global._realtimeBus.setMaxListeners(200);
  }
  return global._realtimeBus;
}

export interface RealtimeEventPayload {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Subscribe a client SSE connection to a channel (e.g. "project:123" or "user:456").
 * Returns an unsubscribe callback.
 */
export function subscribeToRealtimeChannel(
  channel: string,
  onEvent: (payload: RealtimeEventPayload) => void
): () => void {
  const bus = getEventBus();
  const handler = (payload: RealtimeEventPayload) => {
    if (payload.channel === channel || payload.channel === "global") {
      onEvent(payload);
    }
  };

  bus.on("message", handler);
  return () => {
    bus.off("message", handler);
  };
}

/**
 * Broadcast an event to all subscribers listening to a channel.
 */
export function broadcastRealtimeEvent(
  channel: string,
  event: string,
  data: Record<string, unknown>
): void {
  const bus = getEventBus();
  const payload: RealtimeEventPayload = {
    channel,
    event,
    data,
    timestamp: new Date().toISOString(),
  };
  bus.emit("message", payload);
}

