"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface CardEditingState {
  userId: string;
  name: string;
  initials: string;
  color: string;
  avatar?: string;
  cardId: string;
}

export function useCardPresence(
  projectId: string | null,
  userId: string | null,
  userMeta: { name: string; initials: string; color: string; avatar?: string } | null
) {
  const [editors, setEditors] = useState<CardEditingState[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editingCardRef = useRef<string | null>(null);
  const staleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const resetStaleTimer = useCallback((editorUserId: string) => {
    const existing = staleTimers.current.get(editorUserId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setEditors((prev) => prev.filter((e) => e.userId !== editorUserId));
      staleTimers.current.delete(editorUserId);
    }, 15000);
    staleTimers.current.set(editorUserId, timer);
  }, []);

  const broadcastEditing = useCallback(
    (cardId: string) => {
      if (!channelRef.current || !userId || !userMeta) return;

      editingCardRef.current = cardId;

      const payload: CardEditingState = {
        userId,
        name: userMeta.name,
        initials: userMeta.initials,
        color: userMeta.color,
        avatar: userMeta.avatar,
        cardId,
      };

      channelRef.current.send({
        type: "broadcast",
        event: "editing",
        payload,
      });

      // Clear any existing heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Re-send every 10s as heartbeat
      heartbeatRef.current = setInterval(() => {
        if (!channelRef.current || !editingCardRef.current) return;
        channelRef.current.send({
          type: "broadcast",
          event: "editing",
          payload: { ...payload, cardId: editingCardRef.current },
        });
      }, 10000);
    },
    [userId, userMeta]
  );

  const broadcastStopEditing = useCallback(() => {
    if (!channelRef.current || !userId) return;

    editingCardRef.current = null;

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    channelRef.current.send({
      type: "broadcast",
      event: "stop-editing",
      payload: { userId },
    });
  }, [userId]);

  useEffect(() => {
    if (!projectId || !userId) return;

    const supabase = createClient();
    const channel = supabase.channel(`card-editing:${projectId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "editing" }, ({ payload }) => {
        const editor = payload as CardEditingState;
        if (editor.userId === userId) return;

        setEditors((prev) => {
          const existing = prev.findIndex((e) => e.userId === editor.userId);
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = editor;
            return next;
          }
          return [...prev, editor];
        });

        resetStaleTimer(editor.userId);
      })
      .on("broadcast", { event: "stop-editing" }, ({ payload }) => {
        const { userId: leftId } = payload as { userId: string };
        setEditors((prev) => prev.filter((e) => e.userId !== leftId));
        const timer = staleTimers.current.get(leftId);
        if (timer) {
          clearTimeout(timer);
          staleTimers.current.delete(leftId);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Send stop-editing on unmount
      if (editingCardRef.current) {
        channel.send({
          type: "broadcast",
          event: "stop-editing",
          payload: { userId },
        });
      }

      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      // Clear all stale timers
      for (const timer of staleTimers.current.values()) {
        clearTimeout(timer);
      }
      staleTimers.current.clear();

      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, userId, resetStaleTimer]);

  return { editors, broadcastEditing, broadcastStopEditing };
}
