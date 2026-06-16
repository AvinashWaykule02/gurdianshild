const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const ledgerEventBus = require("../events/ledgerEventBus");
const { EVENT_LIST } = require("../events/eventTypes");

let io;

const ADMIN_ROLES = ["admin", "SUPER_ADMIN", "SENIOR_MANAGER", "high_authority"];

function broadcast(eventType, payload) {
  if (!io) return;

  const { userId } = payload;
  if (userId && userId !== "SYSTEM") {
    io.to(`user:${userId}`).emit(eventType, payload);
    io.to("admin").emit(eventType, payload);
  } else {
    io.emit(eventType, payload);
  }
}

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || process.env.CLIENT_URL || "*",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) return next();

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.role = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
      if (ADMIN_ROLES.includes(socket.role)) {
        socket.join("admin");
      }
    }

    socket.on("ping", () => socket.emit("pong", { time: Date.now() }));
  });

  EVENT_LIST.forEach((eventType) => {
    ledgerEventBus.on(eventType, (payload) => broadcast(eventType, payload));
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

module.exports = { initSocketServer, getIO };
