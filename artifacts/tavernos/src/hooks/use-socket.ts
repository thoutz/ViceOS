import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import type { InitiativeCombatant } from "@/components/vtt/InitiativeBar";

interface FogRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Closed polygon as flat [x1,y1,x2,y2,...] in map space */
export interface FogPolygon {
  points: number[];
}

export interface FogData {
  revealed: FogRect[];
  hidden: FogRect[];
  hiddenPolygons?: FogPolygon[];
  revealedPolygons?: FogPolygon[];
}

interface TokenData {
  id: string;
  name: string;
  x: number;
  y: number;
  color?: string;
  /** Data URL for custom token image */
  imageData?: string;
  tokenSize?: "small" | "medium" | "large";
  hp?: number;
  maxHp?: number;
  ac?: number;
  characterId?: string;
  isNpc?: boolean;
}

export interface VttSocketEmitEvents {
  token_move: (data: { mapId: string; tokenId: string; x: number; y: number }) => void;
  token_place: (data: { mapId: string; token: TokenData }) => void;
  token_remove: (data: { mapId: string; tokenId: string }) => void;
  initiative_advance: (data: { direction: "next" | "prev" }) => void;
  initiative_order_update: (data: { initiativeOrder: InitiativeCombatant[] }) => void;
  chat_message: (data: { message: unknown }) => void;
  fog_update: (data: { mapId: string; fogData: FogData }) => void;
  hp_update: (data: { characterId: string; hp: number; maxHp: number }) => void;
}

export function useVttSocket(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId || !campaignId) return;

    const tabId = sessionStorage.getItem("tavernos_tab_id") ?? undefined;

    const socket = io(window.location.origin, {
      path: "/socket.io",
      reconnectionDelayMax: 10000,
      withCredentials: true,
      auth: tabId ? { tabId } : undefined,
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
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("token_placed", () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("token_removed", () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("chat_message", () => {
      void queryClient.invalidateQueries({
        queryKey: [`/api/campaigns/${campaignId}/sessions/${sessionId}/messages`],
      });
    });

    socket.on("chat_message_deleted", () => {
      void queryClient.invalidateQueries({
        queryKey: [`/api/campaigns/${campaignId}/sessions/${sessionId}/messages`],
      });
    });

    socket.on("turn_changed", (data: { currentTurnIndex: number; roundNumber: number }) => {
      queryClient.setQueryData(
        [`/api/campaigns/${campaignId}/sessions`],
        (old: Array<Record<string, unknown>> | undefined) =>
          old?.map((s) =>
            s.id === sessionId
              ? { ...s, currentTurnIndex: data.currentTurnIndex, roundNumber: data.roundNumber }
              : s
          )
      );
    });

    socket.on(
      "initiative_order_updated",
      (data: {
        initiativeOrder: InitiativeCombatant[];
        currentTurnIndex: number;
        roundNumber: number;
      }) => {
        queryClient.setQueryData(
          [`/api/campaigns/${campaignId}/sessions`],
          (old: Array<Record<string, unknown>> | undefined) =>
            old?.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    initiativeOrder: data.initiativeOrder,
                    currentTurnIndex: data.currentTurnIndex,
                    roundNumber: data.roundNumber,
                  }
                : s
            )
        );
      }
    );

    socket.on("hp_updated", () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters`] });
    });

    socket.on("fog_updated", () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("user_joined", () => {
      void queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters`] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [campaignId, sessionId, queryClient]);

  const emit = useCallback(
    <K extends keyof VttSocketEmitEvents>(
      event: K,
      data: Parameters<VttSocketEmitEvents[K]>[0]
    ) => {
      if (socketRef.current?.connected) {
        socketRef.current.emit(event, data);
      }
    },
    []
  );

  return { isConnected, emit };
}
