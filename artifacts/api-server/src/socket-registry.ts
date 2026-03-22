import type { Server as SocketServer } from "socket.io";

let io: SocketServer | null = null;

export function setSocketIo(instance: SocketServer): void {
  io = instance;
}

export function getSocketIo(): SocketServer | null {
  return io;
}

/** Broadcast to everyone in a game session room (`session:${sessionId}`). */
export function emitToSessionRoom(sessionId: string, event: string, data: unknown): void {
  const server = io;
  if (!server) return;
  server.to(`session:${sessionId}`).emit(event, data);
}
