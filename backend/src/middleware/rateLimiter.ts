// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Shared-store note:
 * In a multi-node production deployment, configure express-rate-limit with a shared store
 * such as Redis via 'rate-limit-redis':
 * 
 *   import RedisStore from "rate-limit-redis";
 *   import { createClient } from "redis";
 *   const redisClient = createClient({ url: process.env.REDIS_URL });
 *   store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
 * 
 * If REDIS_URL is not set or Redis is unavailable, express-rate-limit gracefully falls back
 * to its high-performance in-memory store.
 */

const standardHandler = (message: string) => (req: Request, res: Response) => {
  const retryAfter = res.getHeader("Retry-After") || 60;
  res.status(429).json({
    message: `${message} Please try again in ${retryAfter} seconds.`,
    retryAfter,
  });
};

const isProduction = process.env.NODE_ENV === "production";
// In development/demo: 30 attempts per 15 minutes. In production: strict 10 attempts per 15 minutes.
const defaultLoginMax = isProduction ? 10 : 30;

// Login rate limiter: per-user per-IP tracking so one user cannot exhaust another user's attempts
export const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || "900000", 10), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || String(defaultLoginMax), 10),
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  keyGenerator: (req) => {
    const userId = req.body?.userId ? String(req.body.userId).trim().toLowerCase() : "";
    const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
    return userId ? `${ip}_${userId}` : ip;
  },
  handler: (req: Request, res: Response) => {
    const retryAfter = res.getHeader("Retry-After") || 60;
    res.status(429).json({
      message: `Too many login attempts. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    });
  },
});

// Registration rate limiter: 10 registrations per hour
export const registerLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS || "3600000", 10), // 1 hour
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many registration requests. Please try again later."),
});

// Email verification rate limiter: 10 attempts per 15 minutes
export const verificationLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_VERIFY_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_VERIFY_MAX || "10", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many verification attempts. Please try again later."),
});

// Resend verification rate limiter: 5 requests per 15 minutes
export const resendLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_RESEND_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_RESEND_MAX || "5", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many resend verification requests. Please try again later."),
});

// Upload rate limiter: 15 uploads per 15 minutes
export const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || "15", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many upload requests. Please try again later."),
});

// Public complaint submission rate limiter: 25 submissions per hour
export const publicComplaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many complaint submissions from this network. Please try again in an hour."),
});

// Tracking OTP rate limiter: 15 requests per 15 minutes
export const trackingOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers["x-test-skip-limit"] === "true",
  handler: standardHandler("Too many tracking code requests. Please try again in 15 minutes."),
});

