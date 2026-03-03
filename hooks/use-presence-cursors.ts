"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CursorState {
  userId: string;
  name: string;
  initials: string;
  color: string;
  x: number;
  y: number;
  page: string;
}

// Re-export from central color system
export { getHexFromTailwind } from "@/lib/colors";

export function usePresenceCursors(
  projectId: string | null,
  userId: string | null,
  userMeta: { name: string; initials: string; color: string } | null,
  page: string
) {
  const [cursors, setCursors] = useState<CursorState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcast = useRef(0);

  // Store latest values in refs so broadcast never needs to be recreated
  const userIdRef = useRef(userId);
  const userMetaRef = useRef(userMeta);
  const pageRef = useRef(page);
  userIdRef.current = userId;
  userMetaRef.current = userMeta;
  pageRef.current = page;

  // Stable broadcast function — never changes identity
  const broadcast = useCallback(
    (x: number, y: number) => {
      if (!channelRef.current || !userIdRef.current || !userMetaRef.current) return;

      const now = Date.now();
      if (now - lastBroadcast.current < 30) {
        if (throttleRef.current) clearTimeout(throttleRef.current);
        throttleRef.current = setTimeout(() => broadcast(x, y), 30);
        return;
      }
      lastBroadcast.current = now;

      channelRef.current.send({
        type: "broadcast",
        event: "cursor",
        payload: {
          userId: userIdRef.current,
          name: userMetaRef.current.name,
          initials: userMetaRef.current.initials,
          color: userMetaRef.current.color,
          x,
          y,
          page: pageRef.current,
        } satisfies CursorState,
      });
    },
    [] // stable — reads from refs
  );

  useEffect(() => {
    if (!projectId || !userId) return;

    const supabase = createClient();
    const channel = supabase.channel(`cursors:${projectId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const cursor = payload as CursorState;
        if (cursor.userId === userId) return;

        setCursors((prev) => {
          const existing = prev.findIndex((c) => c.userId === cursor.userId);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = cursor;
            return next;
          }
          return [...prev, cursor];
        });
      })
      .on("broadcast", { event: "leave" }, ({ payload }) => {
        const { userId: leftId } = payload as { userId: string };
        setCursors((prev) => prev.filter((c) => c.userId !== leftId));
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.send({
        type: "broadcast",
        event: "leave",
        payload: { userId },
      });
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (throttleRef.current) clearTimeout(throttleRef.current);
    };
  }, [projectId, userId]);

  return { cursors, broadcast };
}
