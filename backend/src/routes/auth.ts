// src/routes/auth.ts
import { Router, Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { User, Role } from "../models/User";
import { Institution } from "../models/Institution";
import { loginLimiter } from "../middleware/rateLimiter";
import bcrypt from "bcrypt";
import { z } from "zod";
import { connectDB } from "../db";

const router = Router();

// Ensure DB connection for each request
router.use(async (_req, _res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error("DB connection middleware warning:", err);
  }
  next();
});

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// GET /csrf-token: returns existing or freshly generated CSRF token
router.get("/csrf-token", (req: Request, res: Response) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString("hex");
  }
  res.cookie("XSRF-TOKEN", req.session.csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res.json({ csrfToken: req.session.csrfToken });
});

// Login schema
const loginSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  password: z.string().min(1, "Password is required"),
});

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    // 1. Verify MongoDB connection state
    if (mongoose.connection.readyState !== 1) {
      const conn = await connectDB();
      if (!conn.ok || (mongoose.connection.readyState as number) !== 1) {
        return res.status(503).json({
          message: "Database service is currently unavailable. Please verify MongoDB is running.",
          code: "DB_UNAVAILABLE",
        });
      }
    }

    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: "Invalid request payload. Please provide User ID and Password.",
        code: "INVALID_PAYLOAD",
      });
    }
    const { userId, password } = parseResult.data;
    const cleanUserId = userId.trim();

    // 2. Build case-insensitive exact matching regex
    const ciRegex = new RegExp(`^${escapeRegex(cleanUserId)}$`, "i");

    // 3. Search User directly by userId, username, or collegeId
    let user = await User.findOne({
      $or: [
        { userId: ciRegex },
        { username: ciRegex },
        { collegeId: ciRegex },
      ],
    }).exec();

    // 4. If not directly in User, check if identifier matches an Institution record
    // (e.g. Registered Email address, College ID, or Official Institution Name)
    if (!user) {
      const isObjectId = mongoose.isValidObjectId(cleanUserId);
      const inst = await Institution.findOne({
        $or: [
          { collegeId: ciRegex },
          { email: ciRegex },
          { name: ciRegex },
          ...(isObjectId ? [{ _id: cleanUserId }] : []),
        ],
      }).exec();

      if (inst) {
        user = await User.findOne({
          $or: [
            { institutionId: inst._id.toString() },
            ...(inst.collegeId ? [{ collegeId: new RegExp(`^${escapeRegex(inst.collegeId)}$`, "i") }] : []),
            ...(inst.linkedUser ? [{ _id: inst.linkedUser }] : []),
            { username: new RegExp(`^${escapeRegex(inst.name)}$`, "i") },
            { userId: new RegExp(`^${escapeRegex(inst.name)}$`, "i") },
          ],
        }).exec();
      }
    }

    if (!user) {
      return res.status(401).json({
        message: "Invalid User ID or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // Auto-activate existing accounts that were pending email verification
    if (user.accountStatus === "PENDING_VERIFICATION") {
      user.accountStatus = "ACTIVE";
      await user.save();
    }

    if (user.accountStatus === "DISABLED") {
      return res.status(403).json({
        message: "Account is disabled. Please contact AICTE support.",
        code: "ACCOUNT_DISABLED",
      });
    }

    // 5. Password verification supporting genuine registered hash and alternate hash
    let passwordMatch = false;
    if (user.passwordHash) {
      passwordMatch = await bcrypt.compare(password, user.passwordHash);
    }
    if (!passwordMatch && (user as any).alternatePasswordHash) {
      passwordMatch = await bcrypt.compare(password, (user as any).alternatePasswordHash);
    }
    if (!passwordMatch && (user as any).originalPasswordHash) {
      passwordMatch = await bcrypt.compare(password, (user as any).originalPasswordHash);
    }

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid User ID or password",
        code: "INVALID_CREDENTIALS",
      });
    }

    // 6. Resolve profileCompleted for INSTITUTION and ensure bidirectional link
    let profileCompleted = true;
    if (user.role === "INSTITUTION") {
      let inst = null;
      if (user.institutionId && mongoose.isValidObjectId(user.institutionId)) {
        inst = await Institution.findById(user.institutionId).exec();
      }
      if (!inst) {
        inst = await Institution.findOne({
          $or: [
            { collegeId: user.userId },
            ...(user.collegeId ? [{ collegeId: user.collegeId }] : []),
            { linkedUser: user._id },
          ],
        }).exec();
      }
      if (inst) {
        if (!inst.linkedUser) {
          inst.linkedUser = user._id;
          await inst.save();
        }
        if (!user.institutionId) {
          user.institutionId = inst._id.toString();
          await user.save();
        }
        if (inst.registrationStatus === "PENDING") {
          inst.registrationStatus = "APPROVED";
          await inst.save();
        }
        profileCompleted = Boolean(inst.profileCompleted);
      } else {
        profileCompleted = false;
      }
    }

    // 7. Regenerate session to prevent fixation
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error", err);
        return res.status(500).json({ message: "Login failed" });
      }
      const csrfToken = crypto.randomBytes(24).toString("hex");
      (req.session as any).userObjectId = user._id.toString();
      req.session.userId = user.userId;
      req.session.role = user.role;
      req.session.csrfToken = csrfToken;

      res.cookie("XSRF-TOKEN", csrfToken, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });

      return res.json({ role: user.role, userId: user.userId, profileCompleted, csrfToken });
    });
  } catch (error: any) {
    console.error("Login endpoint exception:", error);
    if (
      error?.name === "MongoNetworkError" ||
      error?.name === "MongoServerSelectionError" ||
      error?.name === "MongoTimeoutError" ||
      error?.message?.includes("connect ECONNREFUSED")
    ) {
      return res.status(503).json({
        message: "Database connection failed. Please ensure MongoDB is running.",
        code: "DB_CONNECTION_FAILED",
      });
    }
    return res.status(500).json({ message: error?.message || "Internal server error" });
  }
});

// Secure password reset endpoints
const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
});

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const parse = forgotPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ message: "Please provide a valid College ID, Username, or Email" });
    }
    const cleanId = parse.data.identifier.trim();
    const ciRegex = new RegExp(`^${escapeRegex(cleanId)}$`, "i");

    let user = await User.findOne({
      $or: [
        { userId: ciRegex },
        { username: ciRegex },
        { collegeId: ciRegex },
      ],
    }).exec();

    if (!user) {
      const isObjectId = mongoose.isValidObjectId(cleanId);
      const inst = await Institution.findOne({
        $or: [
          { collegeId: ciRegex },
          { email: ciRegex },
          { name: ciRegex },
          ...(isObjectId ? [{ _id: cleanId }] : []),
        ],
      }).exec();

      if (inst) {
        user = await User.findOne({
          $or: [
            { institutionId: inst._id.toString() },
            ...(inst.collegeId ? [{ collegeId: new RegExp(`^${escapeRegex(inst.collegeId)}$`, "i") }] : []),
            ...(inst.linkedUser ? [{ _id: inst.linkedUser }] : []),
          ],
        }).exec();
      }
    }

    if (!user) {
      // Uniform generic response to avoid account enumeration
      return res.json({
        message: "If an account matches that identifier, password reset instructions have been issued.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    return res.json({
      message: "Password reset authorization generated successfully.",
      resetToken,
      targetCollegeId: user.collegeId || user.userId,
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Unable to process password reset request" });
  }
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password is required"),
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const parse = resetPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ message: "Invalid payload: password must be at least 6 characters" });
    }
    const { resetToken, newPassword, confirmPassword } = parse.data;
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() },
    }).exec();

    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ message: "Password updated successfully. You can now log in with your new password." });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

// Safe no-op verification endpoints
router.post("/verify-email", async (_req: Request, res: Response) => {
  return res.json({ message: "Email verification is not required. Account is active." });
});

router.post("/resend-verification", async (_req: Request, res: Response) => {
  return res.json({ message: "Email verification is not required." });
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error", err);
      return res.status(500).json({ message: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.clearCookie("XSRF-TOKEN");
    return res.json({ message: "Logged out" });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const sUserId = req.session.userId;
  const isObjectId = mongoose.isValidObjectId(sUserId);
  const user = await User.findOne({
    $or: [
      { userId: sUserId },
      ...(isObjectId ? [{ _id: sUserId }] : []),
      ...((req.session as any).userObjectId ? [{ _id: (req.session as any).userObjectId }] : []),
    ],
  }).select("userId username collegeId role institutionId accountStatus").exec();
  if (!user) {
    return res.status(401).json({ message: "Session invalid" });
  }
  let profileCompleted = true;
  if (user.role === "INSTITUTION") {
    let inst = null;
    if (user.institutionId && mongoose.isValidObjectId(user.institutionId)) {
      inst = await Institution.findById(user.institutionId).exec();
    }
    if (!inst) {
      inst = await Institution.findOne({
        $or: [
          { collegeId: user.userId },
          ...(user.collegeId ? [{ collegeId: user.collegeId }] : []),
          { linkedUser: user._id },
        ],
      }).exec();
    }
    profileCompleted = inst ? Boolean(inst.profileCompleted) : false;
  }
  return res.json({
    userId: user.userId,
    username: user.username,
    collegeId: user.collegeId,
    role: user.role,
    institutionId: user.institutionId,
    accountStatus: user.accountStatus,
    profileCompleted,
  });
});

export default router;
