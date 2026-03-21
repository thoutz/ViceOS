import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

// Mock implementation of socket hook to prevent actual connection errors if backend isn't ready
// while still simulating the real-time API shape for the components to use.
export function useVttSocket(campaignId: string, sessionId: string) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to the same origin
    const socket = io(window.location.origin, {
      path: "/socket.io",
      reconnectionDelayMax: 10000,
    });
    
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_session", { campaignId, sessionId });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Invalidate queries when important events happen
    socket.on("token_moved", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/maps`] });
    });

    socket.on("chat_message", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/sessions/${sessionId}/messages`] });
    });

    socket.on("session_updated", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/sessions/${sessionId}`] });
    });

    socket.on("character_updated", () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/characters`] });
    });

    return () => {
      socket.disconnect();
    };
  }, [campaignId, sessionId, queryClient]);

  // Expose a safe emit function
  const emit = (event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, { campaignId, sessionId, ...data });
    }
  };

  return { isConnected, emit };
}
