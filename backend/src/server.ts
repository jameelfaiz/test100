// src/server.ts
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import session from "express-session";

import MongoStore from "connect-mongo";
import { connectDB, getDBStatus } from "./db";
import { csrfCookieMiddleware, verifyCsrfToken } from "./middleware/csrf";
import authRouter from "./routes/auth";
import institutionRouter from "./routes/institution";

dotenv.config();
dotenv.config({ path: "../.env" });

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Production reverse proxy support (Render, Cloudflare, ALB)
app.set("trust proxy", 1);

// CORS – allow configured frontend origins and local development
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile, curl, health checks)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        (!isProduction && origin.startsWith("http://localhost:")) ||
        (process.env.ALLOWED_DOMAIN_SUFFIX && origin.endsWith(process.env.ALLOWED_DOMAIN_SUFFIX))
      ) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Session store using MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-please-change",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aicte_unified",
      collectionName: "sessions",
    }),
  })
);

// CSRF cookie generation & state-changing route verification
app.use(csrfCookieMiddleware);
app.use(verifyCsrfToken);

// Connect to MongoDB before starting server
connectDB().then(async (result) => {
  if (result.ok) {
    try {
      const { HandbookClause } = await import("./models/HandbookClause");
      const { seedHandbookDatabase } = await import("./seed/seedHandbook");
      const count = await HandbookClause.countDocuments();
      if (count === 0) {
        await seedHandbookDatabase();
      }
    } catch (e) {
      console.warn("Auto-seed handbook check:", e);
    }
  } else {
    console.error("Failed to connect to MongoDB – server will still start but DB‑dependent features will fail.");
  }
});

// Health endpoint now reports DB status separately
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    dbStatus: getDBStatus(),
  });
});

// Auth routes
app.use("/api/auth", authRouter);
// Institution routes
app.use("/api/institution", institutionRouter);
// FD employee routes
import fdRouter from "./routes/fd";
app.use("/api/fd", fdRouter);
// Vigilance employee routes
import vigilanceRouter from "./routes/vigilance";
import auditRouter from "./routes/audit";
import pgrcRouter from "./routes/pgrc";
app.use("/api/vigilance", vigilanceRouter);
app.use("/api/audit", auditRouter);
app.use("/api/pgrc", pgrcRouter);
import publicRouter from "./routes/public";
app.use("/api/public", publicRouter);
// Chatbot routes
import chatbotRouter from "./routes/chatbot";
app.use("/api/chatbot", chatbotRouter);
import { errorHandler } from "./middleware/errorHandler";
app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});
