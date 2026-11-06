"use client";

import { useEffect, useRef } from "react";

export interface RealtimeMessage<T = unknown> {
  type: string;
  data: T;
}

export function useRealtime<T = Record<string, unknown>>(
  channel: string | null | undefined,
  onEvent: (event: string, data: T) => void
) {
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!channel || typeof window === "undefined") return;
    const targetChannel = channel;

    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    function connect() {
      try {
        eventSource = new EventSource(`/api/realtime?channel=${encodeURIComponent(targetChannel)}`);

        eventSource.addEventListener("vote", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current("vote", data);
          } catch {
            // ignore malformed message
          }
        });

        eventSource.addEventListener("comment", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current("comment", data);
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener("update", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current("update", data);
          } catch {
            // ignore
          }
        });

        eventSource.addEventListener("message", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current("message", data);
          } catch {
            // ignore
          }
        });

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Reconnect with backoff
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch {
        // SSE not supported or connection error
      }
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [channel]);
}
