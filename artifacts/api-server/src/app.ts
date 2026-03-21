import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { gameSessionsTable, mapsTable } from "@workspace/db/schema";
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

app.use(
  session({
    secret: process.env.SESSION_SECRET || "tavern-os-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  })
);

app.use("/api", router);

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  socket.on(
    "join_session",
    (data: { sessionId: string; campaignId: string; userId: string; username: string }) => {
      const room = `session:${data.sessionId}`;
      socket.join(room);
      socket.data.sessionId = data.sessionId;
      socket.data.campaignId = data.campaignId;
      socket.data.userId = data.userId;
      socket.data.username = data.username;
      socket.to(room).emit("user_joined", { userId: data.userId, username: data.username });
      logger.info({ sessionId: data.sessionId, userId: data.userId }, "User joined session room");
    }
  );

  socket.on(
    "token_move",
    async (data: { sessionId: string; campaignId: string; mapId: string; tokenId: string; x: number; y: number }) => {
      const room = `session:${data.sessionId}`;
      socket.to(room).emit("token_moved", data);

      if (data.mapId && data.campaignId) {
        try {
          const [map] = await db
            .select()
            .from(mapsTable)
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, data.campaignId)));
          if (map) {
            const tokens = (map.tokens as any[]) || [];
            const updated = tokens.map((t: any) =>
              t.id === data.tokenId ? { ...t, x: data.x, y: data.y } : t
            );
            await db
              .update(mapsTable)
              .set({ tokens: updated })
              .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, data.campaignId)));
          }
        } catch (err) {
          logger.error({ err }, "Failed to persist token move");
        }
      }
    }
  );

  socket.on(
    "hp_update",
    (data: { sessionId: string; characterId: string; hp: number; maxHp: number }) => {
      const room = `session:${data.sessionId}`;
      io.to(room).emit("hp_updated", data);
    }
  );

  socket.on(
    "initiative_advance",
    async (data: { sessionId: string; campaignId: string; direction: "next" | "prev" }) => {
      const room = `session:${data.sessionId}`;
      try {
        const [session] = await db
          .select()
          .from(gameSessionsTable)
          .where(
            and(
              eq(gameSessionsTable.id, data.sessionId),
              eq(gameSessionsTable.campaignId, data.campaignId)
            )
          );
        if (!session) return;

        const order = (session.initiativeOrder as any[]) || [];
        if (order.length === 0) return;

        let nextIndex = session.currentTurnIndex;
        let nextRound = session.roundNumber;

        if (data.direction === "next") {
          nextIndex = (session.currentTurnIndex + 1) % order.length;
          if (nextIndex === 0) nextRound = session.roundNumber + 1;
        } else {
          nextIndex = session.currentTurnIndex - 1;
          if (nextIndex < 0) {
            nextIndex = order.length - 1;
            nextRound = Math.max(1, session.roundNumber - 1);
          }
        }

        const [updated] = await db
          .update(gameSessionsTable)
          .set({ currentTurnIndex: nextIndex, roundNumber: nextRound })
          .where(eq(gameSessionsTable.id, data.sessionId))
          .returning();

        io.to(room).emit("turn_changed", {
          sessionId: data.sessionId,
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
    async (data: { sessionId: string; campaignId: string; initiativeOrder: any[] }) => {
      const room = `session:${data.sessionId}`;
      try {
        await db
          .update(gameSessionsTable)
          .set({ initiativeOrder: data.initiativeOrder, currentTurnIndex: 0 })
          .where(
            and(
              eq(gameSessionsTable.id, data.sessionId),
              eq(gameSessionsTable.campaignId, data.campaignId)
            )
          );
        io.to(room).emit("initiative_order_updated", {
          sessionId: data.sessionId,
          initiativeOrder: data.initiativeOrder,
          currentTurnIndex: 0,
        });
      } catch (err) {
        logger.error({ err }, "Failed to update initiative order");
      }
    }
  );

  socket.on(
    "chat_message",
    (data: { sessionId: string; message: any }) => {
      const room = `session:${data.sessionId}`;
      io.to(room).emit("chat_message", data.message);
    }
  );

  socket.on(
    "fog_update",
    async (data: { sessionId: string; campaignId: string; mapId: string; fogData: any }) => {
      const room = `session:${data.sessionId}`;
      socket.to(room).emit("fog_updated", data);

      if (data.mapId && data.campaignId) {
        try {
          await db
            .update(mapsTable)
            .set({ fogData: data.fogData })
            .where(and(eq(mapsTable.id, data.mapId), eq(mapsTable.campaignId, data.campaignId)));
        } catch (err) {
          logger.error({ err }, "Failed to persist fog update");
        }
      }
    }
  );

  socket.on("disconnect", () => {
    const { sessionId, userId, username } = socket.data;
    if (sessionId) {
      socket.to(`session:${sessionId}`).emit("user_left", { userId, username });
    }
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

export { httpServer, io };
export default app;
