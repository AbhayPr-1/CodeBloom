import { describe, expect, it } from "vitest";

import {
  subscribeToRealtimeChannel,
  broadcastRealtimeEvent,
} from "@/lib/realtime/events";
import { GET as getRealtimeRoute } from "@/app/api/realtime/route";

describe("Phase 3: Realtime Social & Enhanced Content", () => {
  describe("Realtime Event Bus & Pub/Sub", () => {
    it("subscribes to a channel and receives broadcast event", async () => {
      const channel = `test:project:${Date.now()}`;
      let receivedEvent: { channel: string; event: string; data: Record<string, unknown> } | null = null;

      const unsubscribe = subscribeToRealtimeChannel(channel, (payload) => {
        receivedEvent = payload;
      });

      broadcastRealtimeEvent(channel, "vote", { projectId: "proj-1", score: 42 });

      expect(receivedEvent as unknown).not.toBeNull();
      const evt = receivedEvent as unknown as { channel: string; event: string; data: { score: number } };
      expect(evt.channel).toBe(channel);
      expect(evt.event).toBe("vote");
      expect(evt.data.score).toBe(42);

      // Unsubscribe and verify no more events
      unsubscribe();
      receivedEvent = null;
      broadcastRealtimeEvent(channel, "vote", { projectId: "proj-1", score: 43 });
      expect(receivedEvent).toBeNull();
    });

    it("isolates different channels from receiving unrelated broadcasts", () => {
      const channelA = "channel:alpha";
      const channelB = "channel:beta";
      let receivedB = false;

      const unsubB = subscribeToRealtimeChannel(channelB, () => {
        receivedB = true;
      });

      broadcastRealtimeEvent(channelA, "comment", { text: "Hello A" });
      expect(receivedB).toBe(false);

      unsubB();
    });
  });

  describe("Server-Sent Events Route (/api/realtime)", () => {
    it("returns a streaming response with text/event-stream headers", async () => {
      const req = new Request("http://localhost:3000/api/realtime?channel=project:signal-garden");
      const res = await getRealtimeRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");
      expect(res.headers.get("Cache-Control")).toContain("no-cache");
      expect(res.body).not.toBeNull();
    });

    it("streams initial connected confirmation event", async () => {
      const req = new Request("http://localhost:3000/api/realtime?channel=test-channel");
      const res = await getRealtimeRoute(req);

      const reader = res.body?.getReader();
      expect(reader).toBeDefined();

      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: connected");
      expect(text).toContain("test-channel");

      await reader!.cancel();
    });
  });
});

