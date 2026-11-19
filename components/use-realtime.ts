"use client";

import { useEffect, useRef } from "react";

export interface RealtimeMessage<T = unknown> {
  type: string;
  data: T;
}

type EventCallback = (event: string, data: Record<string, unknown>) => void;

// Multiplexed singleton SSE manager to ensure ONLY 1 HTTP/1.1 socket is ever consumed
const listeners = new Map<string, Set<EventCallback>>();
let activeChannels = new Set<string>();
let activeEventSource: EventSource | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let syncTimer: NodeJS.Timeout | null = null;

function syncConnection() {
  if (typeof window === "undefined") return;

  const neededChannels = Array.from(listeners.keys()).filter((ch) => (listeners.get(ch)?.size || 0) > 0);
  if (neededChannels.length === 0) {
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }
    activeChannels.clear();
    return;
  }

  const neededKey = neededChannels.slice().sort().join(",");
  const currentKey = Array.from(activeChannels).slice().sort().join(",");
  if (activeEventSource && neededKey === currentKey) {
    return;
  }

  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }

  activeChannels = new Set(neededChannels);
  try {
    const es = new EventSource(`/api/realtime?channel=${encodeURIComponent(neededChannels.join(","))}`);
    activeEventSource = es;

    const dispatch = (eventType: string, data: Record<string, unknown>) => {
      const targetChannel = typeof data?.channel === "string"
        ? data.channel
        : typeof data?.projectId === "string"
        ? `project:${data.projectId}`
        : null;
      if (targetChannel && listeners.has(targetChannel)) {
        listeners.get(targetChannel)?.forEach((cb) => {
          try { cb(eventType, data); } catch {}
        });
      } else {
        listeners.forEach((set) => {
          set.forEach((cb) => {
            try { cb(eventType, data); } catch {}
          });
        });
      }
    };

    ["vote", "comment", "update", "message"].forEach((evt) => {
      es.addEventListener(evt, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          dispatch(evt, parsed);
        } catch {}
      });
    });

    es.onerror = () => {
      if (activeEventSource === es) {
        es.close();
        activeEventSource = null;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(syncConnection, 5000);
      }
    };
  } catch {}
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncConnection, 50);
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

    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }

    const wrapper: EventCallback = (event: string, data: Record<string, unknown>) => {
      handlerRef.current(event, data as T);
    };

    listeners.get(channel)!.add(wrapper);
    scheduleSync();

    return () => {
      const set = listeners.get(channel);
      if (set) {
        set.delete(wrapper);
        if (set.size === 0) {
          listeners.delete(channel);
        }
      }
      scheduleSync();
    };
  }, [channel]);
}
