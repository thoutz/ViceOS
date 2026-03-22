import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import router from "./routes";
import { logger } from "./lib/logger";
import { tabIdentityMap } from "./middlewares/auth";
import { db } from "@workspace/db";
import { gameSessionsTable, mapsTable, campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import "./types";

const app: Express = express();

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io",
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET;
const isProd = process.env.NODE_ENV === "production";
if (isProd && !sessionSecret) {
  console.error("[SECURITY] SESSION_SECRET env var is required in production. Exiting.");
  process.exit(1);
}
if (!isProd && !sessionSecret) {
  console.warn("[SECURITY] SESSION_SECRET env var is not set. Using insecure default — set this in production.");
}
const sessionMiddleware = session({
  secret: sessionSecret || "tavern-os-dev-secret-only",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? "strict" : "lax",
  },
});

app.use(sessionMiddleware);

app.use("/api", router);

// Share session middleware with Socket.IO so we can read userId
io.engine.use(sessionMiddleware);

interface SocketData {
  userId: string;
  username: string;
  sessionId: string;
  campaignId: string;
  role: string; // "dm" | "player"
}

// Helper: verify campaign membership and return role, or null if not a member
async function verifyMembership(
  campaignId: string,
  userId: string
): Promise<{ role: string } | null> {
  const [member] = await db
    .select({ role: campaignMembersTable.role })
    .from(campaignMembersTable)
    .where(
      and(
        eq(campaignMembersTable.campaignId, campaignId),
        eq(campaignMembersTable.userId, userId)
      )
    );
  return member ?? null;
}

// Helper: verify the socket's stored sessionId matches the requested one
function socketOwnsSession(data: SocketData, sessionId: string, campaignId: string): boolean {
  return data.sessionId === sessionId && data.campaignId === campaignId;
}

io.on("connection", (socket) => {
  // Resolve userId: prefer per-tab identity (for multi-tab testing) over shared session
  const req = socket.request as express.Request;
  const tabId = (socket.handshake.auth as Record<string, string> | undefined)?.tabId;
  let serverUserId: string | undefined = req.session?.userId;
  let serverUsername: string | undefined = req.session?.username;

  if (tabId) {
    const tabUser = tabIdentityMap.get(tabId);
    if (tabUser) {
      serverUserId = tabUser.userId;
      serverUsername = tabUser.username;
    }
  }

  if (!serverUserId) {
    logger.warn({ socketId: socket.id }, "Unauthenticated socket connection rejected");
    socket.disconnect(true);
    return;
  }

  logger.info({ socketId: socket.id, userId: serverUserId }, "Socket connected");

  socket.on(
    "join_session",
    async (data: { sessionId: string; campaignId: string; username: string }) => {
      if (!data.sessionId || !data.campaignId) {
        socket.emit("error", { message: "Missing sessionId or campaignId" });
        return;
      }

      const member = await verifyMembership(data.campaignId, serverUserId);
      if (!member) {
        socket.emit("error", { message: "Not a member of this campaign" });
        return;
      }

      // Verify that the sessionId actually belongs to the claimed campaignId
      const [sessionRow] = await db
        .select({ id: gameSessionsTable.id })
        .from(gameSessionsTable)
        .where(
          and(
            eq(gameSessionsTable.id, data.sessionId),
            eq(gameSessionsTable.campaignId, data.campaignId)
          )
        );
      if (!sessionRow) {
        socket.emit("error", { message: "Session does not belong to this campaign" });
        return;
      }

      const room = `session:${data.sessionId}`;
      socket.join(room);

      // Store auth context on socket — prefer server-resolved identity over client-supplied username
      const resolvedUsername = serverUsername || data.username;
      (socket.data as SocketData).userId = serverUserId;
      (socket.data as SocketData).username = resolvedUsername;
      (socket.data as SocketData).sessionId = data.sessionId;
      (socket.data as SocketData).campaignId = data.campaignId;
      (socket.data as SocketData).role = member.role;

      socket.to(room).emit("user_joined", { userId: serverUserId, username: resolvedUsername });
      logger.info({ sessionId: data.sessionId, userId: serverUserId, role: member.role }, "User joined session room");
    }
  );

  socket.on(
    "token_move",
    async (data: { mapId: string; tokenId: string; x: number; y: number }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;

      const room = `session:${sd.sessionId}`;

      // Only DMs may move tokens
      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can move tokens" });
        return;
      }

      socket.to(room).emit("token_moved", {
        mapId: data.mapId,
        tokenId: data.tokenId,
        x: data.x,
        y: data.y,
      });

      if (data.mapId) {
        try {
          const [map] = await db
            .select()
            .from(mapsTable)
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
          if (map) {
            const tokens = (map.tokens as Array<{ id: string; x: number; y: number }>) || [];
            const updated = tokens.map((t) =>
              t.id === data.tokenId ? { ...t, x: data.x, y: data.y } : t
            );
            await db
              .update(mapsTable)
              .set({ tokens: updated })
              .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
          }
        } catch (err) {
          logger.error({ err }, "Failed to persist token move");
        }
      }
    }
  );

  socket.on(
    "token_place",
    async (data: {
      mapId: string;
      token: {
        id: string;
        name: string;
        x: number;
        y: number;
        color?: string;
        imageData?: string;
        tokenSize?: "small" | "medium" | "large";
        hp?: number;
        maxHp?: number;
        ac?: number;
        characterId?: string;
        isNpc?: boolean;
      };
    }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;
      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can place tokens" });
        return;
      }
      const room = `session:${sd.sessionId}`;
      try {
        const [map] = await db
          .select()
          .from(mapsTable)
          .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
        if (map) {
          const tokens = (map.tokens as Array<Record<string, unknown>>) || [];
          const updated = [...tokens, data.token];
          await db
            .update(mapsTable)
            .set({ tokens: updated })
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
          io.to(room).emit("token_placed", { mapId: data.mapId, token: data.token });
        }
      } catch (err) {
        logger.error({ err }, "Failed to place token");
      }
    }
  );

  socket.on(
    "token_remove",
    async (data: { mapId: string; tokenId: string }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;
      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can remove tokens" });
        return;
      }
      const room = `session:${sd.sessionId}`;
      try {
        const [map] = await db
          .select()
          .from(mapsTable)
          .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
        if (map) {
          const tokens = (map.tokens as Array<{ id: string }>) || [];
          const updated = tokens.filter((t) => t.id !== data.tokenId);
          await db
            .update(mapsTable)
            .set({ tokens: updated })
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
          io.to(room).emit("token_removed", { mapId: data.mapId, tokenId: data.tokenId });
        }
      } catch (err) {
        logger.error({ err }, "Failed to remove token");
      }
    }
  );

  socket.on(
    "hp_update",
    (data: { characterId: string; hp: number; maxHp: number }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId) return;
      const room = `session:${sd.sessionId}`;
      io.to(room).emit("hp_updated", {
        characterId: data.characterId,
        hp: data.hp,
        maxHp: data.maxHp,
      });
    }
  );

  socket.on(
    "initiative_advance",
    async (data: { direction: "next" | "prev" }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;

      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can advance initiative" });
        return;
      }

      const room = `session:${sd.sessionId}`;
      try {
        const [currentSession] = await db
          .select()
          .from(gameSessionsTable)
          .where(
            and(
              eq(gameSessionsTable.id, sd.sessionId),
              eq(gameSessionsTable.campaignId, sd.campaignId)
            )
          );
        if (!currentSession) return;

        const order = (currentSession.initiativeOrder as unknown[]) || [];
        if (order.length === 0) return;

        let nextIndex = currentSession.currentTurnIndex;
        let nextRound = currentSession.roundNumber;

        if (data.direction === "next") {
          nextIndex = (currentSession.currentTurnIndex + 1) % order.length;
          if (nextIndex === 0) nextRound = currentSession.roundNumber + 1;
        } else {
          nextIndex = currentSession.currentTurnIndex - 1;
          if (nextIndex < 0) {
            nextIndex = order.length - 1;
            nextRound = Math.max(1, currentSession.roundNumber - 1);
          }
        }

        await db
          .update(gameSessionsTable)
          .set({ currentTurnIndex: nextIndex, roundNumber: nextRound })
          .where(eq(gameSessionsTable.id, sd.sessionId));

        io.to(room).emit("turn_changed", {
          sessionId: sd.sessionId,
          currentTurnIndex: nextIndex,
          roundNumber: nextRound,
          currentCombatant: order[nextIndex],
        });
      } catch (err) {
        logger.error({ err }, "Failed to advance initiative");
      }
    }
  );

  socket.on(
    "initiative_order_update",
    async (data: { initiativeOrder: unknown[] }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;

      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can update initiative order" });
        return;
      }

      const room = `session:${sd.sessionId}`;
      try {
        const [updated] = await db
          .update(gameSessionsTable)
          .set({ initiativeOrder: data.initiativeOrder, currentTurnIndex: 0, roundNumber: 1 })
          .where(
            and(
              eq(gameSessionsTable.id, sd.sessionId),
              eq(gameSessionsTable.campaignId, sd.campaignId)
            )
          )
          .returning();

        if (updated) {
          io.to(room).emit("initiative_order_updated", {
            sessionId: sd.sessionId,
            initiativeOrder: updated.initiativeOrder,
            currentTurnIndex: updated.currentTurnIndex,
            roundNumber: updated.roundNumber,
          });
        }
      } catch (err) {
        logger.error({ err }, "Failed to update initiative order");
      }
    }
  );

  socket.on(
    "chat_message",
    (data: { message: unknown }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId) return;
      const room = `session:${sd.sessionId}`;
      io.to(room).emit("chat_message", data.message);
    }
  );

  socket.on(
    "fog_update",
    async (data: { mapId: string; fogData: unknown }) => {
      const sd = socket.data as SocketData;
      if (!sd.sessionId || !sd.campaignId) return;

      if (sd.role !== "dm") {
        socket.emit("error", { message: "Only the DM can update fog of war" });
        return;
      }

      const room = `session:${sd.sessionId}`;
      socket.to(room).emit("fog_updated", {
        mapId: data.mapId,
        fogData: data.fogData,
      });

      if (data.mapId) {
        try {
          await db
            .update(mapsTable)
            .set({ fogData: data.fogData })
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, sd.campaignId)));
        } catch (err) {
          logger.error({ err }, "Failed to persist fog update");
        }
      }
    }
  );

  socket.on("disconnect", () => {
    const sd = socket.data as Partial<SocketData>;
    if (sd.sessionId) {
      socket.to(`session:${sd.sessionId}`).emit("user_left", {
        userId: sd.userId,
        username: sd.username,
      });
    }
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

export { httpServer, io };
export default app;
