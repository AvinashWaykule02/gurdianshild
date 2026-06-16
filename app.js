const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const prisma = require("./config/prisma"); // Ensure Prisma is initialized

// Fix BigInt serialization issue with Prisma
BigInt.prototype.toJSON = function () {
  return this.toString();
};
// ─────────────────────────────────────────────
// App init
// ─────────────────────────────────────────────
const app = express();

if (process.env.NODE_ENV !== "test") {
  require("./workers/auditWorker");
  require("./workers/repairWorker");
  require("./workers/verificationWorker");
}

// ─────────────────────────────────────────────
// SECURITY + MIDDLEWARE
// ─────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
const authRoutes = require("./routes/authRoute");
const transactionRoutes = require("./routes/transactionRoute");
const securityRoutes = require("./routes/securityRoute");
const incidentRoutes = require("./routes/incidentRoute");
const repairRoutes = require("./routes/repairRoute");

app.use("/api/auth", authRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/repair", repairRoutes);

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running fine 🚀",
  });
});

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[GLOBAL ERROR]", err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

module.exports = app;
