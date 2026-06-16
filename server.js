require("dotenv").config();
const app = require("./app");
const prisma = require("./config/prisma"); // 👈 ADD THIS
const publisherJob = require("./crone-jobs/outboxSchedule");

const { initSocketServer } = require("./realtime/socketServer");

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  try {
    // ─────────────────────────────
    // 1. CONNECT PRISMA FIRST
    // ─────────────────────────────
    await prisma.$connect();
    console.log("✅ Prisma connected");

    // ─────────────────────────────
    // 2. START EXPRESS SERVER
    // ─────────────────────────────
    server = app.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);

      // ─────────────────────────────
      // 3. INITIALIZE SOCKET.IO
      // ─────────────────────────────
      initSocketServer(server);

      try {
        await publisherJob.start();
        console.log("📦 Outbox publisher started");
      } catch (err) {
        console.error("[StartupJob] Failed to start:", err.message);
        process.exit(1);
      }
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();


// ─────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down...`);

  try {
    publisherJob.stop();
    console.log("🛑 Publisher job stopped");
  } catch (err) {
    console.error("[Shutdown Error] Job stop failed:", err.message);
  }

  try {
    await prisma.$disconnect(); // 👈 IMPORTANT
    console.log("🧠 Prisma disconnected");
  } catch (err) {
    console.error("[Shutdown Error] Prisma disconnect failed:", err.message);
  }

  server.close(() => {
    console.log("[Server] HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));