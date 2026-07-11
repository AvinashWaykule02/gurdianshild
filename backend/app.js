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
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Ensure preflight requests are handled for all routes
// Note: `cors` middleware above handles preflight requests automatically.

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
const adminRoutes = require("./routes/adminRoute");

app.use("/api/auth", authRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/repair", repairRoutes);
app.use("/api/admin", adminRoutes);

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
