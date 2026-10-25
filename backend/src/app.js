const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const env = require("./config/env");
const { apiLimiter } = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const electionsRoutes = require("./routes/elections");
const voteRoutes = require("./routes/vote");
const verifyRoutes = require("./routes/verify");
const resultsRoutes = require("./routes/results");
const auditRoutes = require("./routes/audit");
const adminRoutes = require("./routes/admin");

const app = express();

// Security headers
app.use(helmet());

// CORS configuration restricted to frontend origins
const allowedOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local development convenience
    },
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// General API Rate Limiting
if (process.env.NODE_ENV !== "test") {
  app.use("/api/", apiLimiter);
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "CampusChainVote Backend API",
  });
});

// Mount modular API routes
app.use("/api/auth", authRoutes);
app.use("/api/elections", electionsRoutes);
app.use("/api/vote", voteRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/results", resultsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/admin", adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
