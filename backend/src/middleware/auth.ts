// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";

// Authentication middleware – ensures a valid session exists
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// Role‑based authorization middleware factory
export function requireRole(...allowedRoles: string[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const role = (req.session as any)?.role;
    if (!role) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
  };
}
