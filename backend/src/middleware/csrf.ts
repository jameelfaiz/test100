// src/middleware/csrf.ts
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Middleware that initializes CSRF token on session and sets client-readable XSRF-TOKEN cookie
 */
export function csrfCookieMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.session) {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(24).toString("hex");
    }
    // Set cookie so frontend applications can read it and send back in x-csrf-token header
    res.cookie("XSRF-TOKEN", req.session.csrfToken, {
      httpOnly: false, // Accessible by frontend JS for CSRF header inclusion
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  next();
}

/**
 * Enforces CSRF token validation on state-changing requests (POST, PUT, DELETE, PATCH)
 * for authenticated sessions.
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Safe read-only HTTP methods do not require CSRF token
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Exempt public complaint and tracking endpoints
  if (
    req.path.startsWith("/api/public") ||
    req.baseUrl.startsWith("/api/public") ||
    (req.originalUrl && req.originalUrl.startsWith("/api/public"))
  ) {
    return next();
  }

  // Exempt logout so user is never trapped in session
  if (
    req.path === "/logout" ||
    req.path.endsWith("/logout") ||
    req.originalUrl?.includes("/auth/logout")
  ) {
    return next();
  }

  // Exempt notification read-state updates so UI read status is reliably persisted
  if (
    (req.path.includes("/notifications") || req.originalUrl?.includes("/notifications")) &&
    (req.path.endsWith("/read") || req.path.endsWith("/read-all") || req.originalUrl?.includes("/read"))
  ) {
    return next();
  }


  // Exempt unauthenticated requests (like initial login or registration)
  if (!req.session?.userId) {
    return next();
  }

  const expectedToken = req.session?.csrfToken;
  const providedToken =
    (req.headers["x-csrf-token"] as string) ||
    (req.headers["x-xsrf-token"] as string) ||
    req.body?._csrf;

  if (!expectedToken || !providedToken) {
    return res.status(403).json({ message: "CSRF token missing" });
  }

  try {
    const expectedBuf = Buffer.from(expectedToken);
    const providedBuf = Buffer.from(providedToken);
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return res.status(403).json({ message: "Invalid CSRF token" });
    }
  } catch (_e) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }

  next();
}
