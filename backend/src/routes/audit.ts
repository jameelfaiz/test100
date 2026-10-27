// src/routes/audit.ts
import { Router, Request, Response } from "express";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/audit - fetch audit logs (restricted to supervisors)
router.get(
  "/logs",
  requireAuth,
  requireRole("VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "20", 10);
      const skip = (page - 1) * limit;

      const [total, logs] = await Promise.all([
        AuditLog.countDocuments({}).exec(),
        AuditLog.find({})
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return res.json({ page, limit, total, logs });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  }
);

export default router;
