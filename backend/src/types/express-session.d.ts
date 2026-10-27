// src/types/express-session.d.ts
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    role?: string;
    csrfToken?: string;
  }
}
