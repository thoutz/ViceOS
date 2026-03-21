import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
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
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
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

  socket.on("join_session", (data: { sessionId: string; userId: string; username: string }) => {
    const room = `session:${data.sessionId}`;
    socket.join(room);
    socket.data.sessionId = data.sessionId;
    socket.data.userId = data.userId;
    socket.data.username = data.username;
    socket.to(room).emit("user_joined", { userId: data.userId, username: data.username });
    logger.info({ sessionId: data.sessionId, userId: data.userId }, "User joined session room");
  });

  socket.on("token_move", (data: { sessionId: string; tokenId: string; x: number; y: number }) => {
    const room = `session:${data.sessionId}`;
    socket.to(room).emit("token_moved", data);
  });

  socket.on("hp_update", (data: { sessionId: string; characterId: string; hp: number; maxHp: number }) => {
    const room = `session:${data.sessionId}`;
    io.to(room).emit("hp_updated", data);
  });

  socket.on("initiative_advance", (data: { sessionId: string; currentTurnIndex: number; roundNumber: number }) => {
    const room = `session:${data.sessionId}`;
    io.to(room).emit("turn_change", data);
  });

  socket.on("chat_message", (data: { sessionId: string; message: any }) => {
    const room = `session:${data.sessionId}`;
    io.to(room).emit("chat_message", data.message);
  });

  socket.on("fog_update", (data: { sessionId: string; mapId: string; fogData: any }) => {
    const room = `session:${data.sessionId}`;
    socket.to(room).emit("fog_updated", data);
  });

  socket.on("initiative_order_update", (data: { sessionId: string; initiativeOrder: any[] }) => {
    const room = `session:${data.sessionId}`;
    io.to(room).emit("initiative_order_updated", data);
  });

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
