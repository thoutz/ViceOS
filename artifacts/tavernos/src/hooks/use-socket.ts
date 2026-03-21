import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

export interface VttSocketEvents {
  token_move: (data: { mapId: string; tokenId: string; x: number; y: number }) => void;
  initiative_advance: (data: { direction: "next" | "prev" }) => void;
  initiative_order_update: (data: { initiativeOrder: any[] }) => void;
  chat_message: (data: { message: any }) => void;
  fog_update: (data: { mapId: string; fogData: any }) => void;
  hp_update: (data: { characterId: string; hp: number; maxHp: number }) => void;
}

export function useVttSocket(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId || !campaignId) return;

    const socket = io(window.location.origin, {
      path: "/socket.io",
      reconnectionDelayMax: 10000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_session", { campaignId, sessionId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("token_moved", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("chat_message", () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/campaigns/${campaignId}/sessions/${sessionId}/messages`],
      });
    });

    socket.on("turn_changed", (data: { sessionId: string; currentTurnIndex: number; roundNumber: number }) => {
      queryClient.setQueryData(
        [`/api/campaigns/${campaignId}/sessions/${sessionId}`],
        (old: any) => old ? { ...old, currentTurnIndex: data.currentTurnIndex, roundNumber: data.roundNumber } : old
      );
    });

    socket.on("initiative_order_updated", (data: { initiativeOrder: any[]; currentTurnIndex: number }) => {
      queryClient.setQueryData(
        [`/api/campaigns/${campaignId}/sessions/${sessionId}`],
        (old: any) => old ? { ...old, initiativeOrder: data.initiativeOrder, currentTurnIndex: data.currentTurnIndex } : old
      );
    });

    socket.on("hp_updated", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters`] });
    });

    socket.on("fog_updated", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("user_joined", (data: { userId: string; username: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters`] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaignId, sessionId, queryClient]);

  const emit = useCallback(
    <K extends keyof VttSocketEvents>(event: K, data: Parameters<VttSocketEvents[K]>[0]) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, { campaignId, sessionId, ...data });
      }
    },
    [campaignId, sessionId]
  );

  return { isConnected, emit };
}
