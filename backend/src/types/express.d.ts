import * as session from "express-session";

declare global {
  namespace Express {
    interface Request {
      session?: session.Session & Partial<session.SessionData> & {
        userId?: string;
        role?: string;
      };
    }
  }
}
export {};
