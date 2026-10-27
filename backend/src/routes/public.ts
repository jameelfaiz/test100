// src/routes/public.ts
import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Institution } from "../models/Institution";
import { Complaint } from "../models/Complaint";
import { AuditLog } from "../models/AuditLog";
import { publicComplaintLimiter, trackingOtpLimiter } from "../middleware/rateLimiter";
import { upload, UPLOAD_DIR } from "../middleware/upload";

const router = Router();

const TOKEN_SECRET = process.env.SESSION_SECRET || "aicte_secure_portal_key_2026";

export function generateFileToken(fileName: string, expiresInMs = 30 * 60 * 1000): string {
  const expiresAt = Date.now() + expiresInMs;
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`${fileName}:${expiresAt}`)
    .digest("hex");
  return `${expiresAt}.${signature}`;
}

export function verifyFileToken(fileName: string, token: string): boolean {
  if (!token) return false;
  const [expiresAtStr, signature] = token.split(".");
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
  const expectedSig = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(`${fileName}:${expiresAt}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSig, "hex"));
  } catch {
    return false;
  }
}

// 1. Fetch registered institutions list for public dropdown
router.get("/institutions", async (_req: Request, res: Response) => {
  try {
    const institutions = await Institution.find(
      {},
      "name collegeId state district address"
    ).sort({ name: 1 });
    return res.json(institutions);
  } catch (err) {
    console.error("Public institutions error:", err);
    return res.status(500).json({ message: "Failed to fetch institutions" });
  }
});

// Helper to generate unique, cryptographically unpredictable complaint reference
async function generateUniqueReference(prefix: "PGRC" | "VIG"): Promise<string> {
  let isUnique = false;
  let reference = "";
  while (!isUnique) {
    const randomSuffix = crypto.randomInt(100000, 1000000).toString();
    reference = `${prefix}-2026-${randomSuffix}`;
    const exists = await Complaint.exists({ complaintReference: reference });
    if (!exists) {
      isUnique = true;
    }
  }
  return reference;
}

// 2. Submit Public PGRC Complaint (Facilities, Infrastructure, Management)
router.post(
  "/complaints/pgrc",
  publicComplaintLimiter,
  upload.single("document"),
  async (req: Request, res: Response) => {
    try {
      const {
        complainantName,
        email,
        complainantEmail,
        mobile,
        complainantMobile,
        phone,
        institutionId,
        description,
        title,
        subject,
      } = req.body;

      const finalName = (complainantName || "").trim();
      const finalEmail = (email || complainantEmail || "").trim().toLowerCase();
      const finalMobile = (mobile || complainantMobile || phone || "").trim();
      const finalDesc = (description || "").trim();
      const finalInstId = (institutionId || "").trim();
      const finalSubject = (subject || title || "Public Grievance regarding Facilities & Management").trim();

      if (!finalName) {
        return res.status(400).json({ message: "Complainant Full Name is required" });
      }
      if (!finalEmail || !finalEmail.includes("@")) {
        return res.status(400).json({ message: "A valid Email Address is required" });
      }
      if (!finalMobile) {
        return res.status(400).json({ message: "Mobile Number is required" });
      }
      if (!finalInstId) {
        return res.status(400).json({ message: "Institution selection is required" });
      }
      if (!finalDesc || finalDesc.length < 10) {
        return res.status(400).json({ message: "Complaint description must be at least 10 characters long" });
      }

      // Find genuine institution
      const inst = await Institution.findOne({
        $or: [
          { _id: finalInstId.match(/^[0-9a-fA-F]{24}$/) ? finalInstId : null },
          { collegeId: finalInstId },
          { name: finalInstId },
        ],
      });

      if (!inst) {
        return res.status(400).json({ message: "Selected institution not found in official registry" });
      }

      // Generate unique, unpredictable complaint reference on the backend
      const complaintReference = await generateUniqueReference("PGRC");

      // Attachment handling
      const attachments: any[] = [];
      if (req.file) {
        const ext = path.extname(req.file.originalname).replace(".", "").toUpperCase() || "PDF";
        attachments.push({
          name: req.file.originalname,
          fileName: req.file.filename,
          fileUrl: `/api/public/files/${req.file.filename}`,
          type: ext,
          size: `${Math.round(req.file.size / 1024)} KB`,
          uploadDate: new Date(),
        });
      }

      const complaint = new Complaint({
        complaintReference,
        institutionId: inst._id.toString(),
        collegeId: inst.collegeId,
        institutionNameSnapshot: inst.name,
        complainant: {
          name: finalName,
          email: finalEmail,
          mobile: finalMobile,
          phone: finalMobile,
        },
        category: "PGRC",
        title: finalSubject,
        subject: finalSubject,
        description: finalDesc,
        source: "PUBLIC",
        assignedDepartment: "PGRC",
        status: "NEW",
        publicStatusMessage: "Complaint registered and queued for official review.",
        attachments,
        evidencePath: attachments[0]?.fileUrl || "",
        statusHistory: [
          {
            status: "NEW",
            reason: "Public grievance submitted online",
            updatedBy: "PUBLIC_COMPLAINANT",
            updatedAt: new Date(),
          },
        ],
        auditHistory: [
          {
            action: "PUBLIC_PGRC_SUBMISSION",
            performedBy: finalEmail,
            timestamp: new Date(),
            details: `PGRC Grievance ${complaintReference} registered against ${inst.name}`,
          },
        ],
      });

      await complaint.save();

      // Audit log
      await AuditLog.create({
        action: "public_pgrc_complaint",
        employeeId: "PUBLIC_COMPLAINANT",
        role: "GUEST",
        complaintId: complaint._id.toString(),
        newStatus: "NEW",
        details: `PGRC Complaint ${complaintReference} submitted for ${inst.name}`,
      });

      return res.status(201).json({
        success: true,
        complaintId: complaintReference,
        complaintReference,
        trackingId: complaintReference,
        status: "Submitted",
        institutionName: inst.name,
        category: "PGRC",
        message: "Complaint Registered Successfully!",
      });
    } catch (err: any) {
      console.error("PGRC public complaint error:", err);
      return res.status(500).json({ message: "Failed to submit PGRC complaint. Please try again." });
    }
  }
);

// 3. Submit Public Vigilance Complaint (Corruption, Financial Irregularities, Fraud)
router.post(
  "/complaints/vigilance",
  publicComplaintLimiter,
  upload.single("document"),
  async (req: Request, res: Response) => {
    try {
      const {
        complainantName,
        email,
        complainantEmail,
        mobile,
        complainantMobile,
        phone,
        institutionId,
        description,
        title,
        subject,
      } = req.body;

      const finalName = (complainantName || "").trim();
      const finalEmail = (email || complainantEmail || "").trim().toLowerCase();
      const finalMobile = (mobile || complainantMobile || phone || "").trim();
      const finalDesc = (description || "").trim();
      const finalInstId = (institutionId || "").trim();
      const finalSubject = (subject || title || "Vigilance Report on Financial Irregularities / Misconduct").trim();

      if (!finalName) {
        return res.status(400).json({ message: "Complainant Full Name is required" });
      }
      if (!finalEmail || !finalEmail.includes("@")) {
        return res.status(400).json({ message: "A valid Email Address is required" });
      }
      if (!finalMobile) {
        return res.status(400).json({ message: "Mobile Number is required" });
      }
      if (!finalInstId) {
        return res.status(400).json({ message: "Institution selection is required" });
      }
      if (!finalDesc || finalDesc.length < 10) {
        return res.status(400).json({ message: "Complaint description must be at least 10 characters long" });
      }

      // Find genuine institution
      const inst = await Institution.findOne({
        $or: [
          { _id: finalInstId.match(/^[0-9a-fA-F]{24}$/) ? finalInstId : null },
          { collegeId: finalInstId },
          { name: finalInstId },
        ],
      });

      if (!inst) {
        return res.status(400).json({ message: "Selected institution not found in official registry" });
      }

      // Generate unique, unpredictable complaint reference on the backend
      const complaintReference = await generateUniqueReference("VIG");

      // Attachment handling
      const attachments: any[] = [];
      if (req.file) {
        const ext = path.extname(req.file.originalname).replace(".", "").toUpperCase() || "PDF";
        attachments.push({
          name: req.file.originalname,
          fileName: req.file.filename,
          fileUrl: `/api/public/files/${req.file.filename}`,
          type: ext,
          size: `${Math.round(req.file.size / 1024)} KB`,
          uploadDate: new Date(),
        });
      }

      const complaint = new Complaint({
        complaintReference,
        institutionId: inst._id.toString(),
        collegeId: inst.collegeId,
        institutionNameSnapshot: inst.name,
        complainant: {
          name: finalName,
          email: finalEmail,
          mobile: finalMobile,
          phone: finalMobile,
        },
        category: "VIGILANCE",
        title: finalSubject,
        subject: finalSubject,
        description: finalDesc,
        source: "PUBLIC",
        assignedDepartment: "VIGILANCE",
        status: "NEW",
        publicStatusMessage: "Complaint registered and queued for Vigilance review.",
        attachments,
        evidencePath: attachments[0]?.fileUrl || "",
        statusHistory: [
          {
            status: "NEW",
            reason: "Public vigilance complaint submitted online",
            updatedBy: "PUBLIC_COMPLAINANT",
            updatedAt: new Date(),
          },
        ],
        auditHistory: [
          {
            action: "PUBLIC_VIGILANCE_SUBMISSION",
            performedBy: finalEmail,
            timestamp: new Date(),
            details: `Vigilance Complaint ${complaintReference} registered against ${inst.name}`,
          },
        ],
      });

      await complaint.save();

      // Audit log
      await AuditLog.create({
        action: "public_vigilance_complaint",
        employeeId: "PUBLIC_COMPLAINANT",
        role: "GUEST",
        complaintId: complaint._id.toString(),
        newStatus: "NEW",
        details: `Vigilance Complaint ${complaintReference} submitted for ${inst.name}`,
      });

      return res.status(201).json({
        success: true,
        complaintId: complaintReference,
        complaintReference,
        trackingId: complaintReference,
        status: "Submitted",
        institutionName: inst.name,
        category: "VIGILANCE",
        message: "Complaint Registered Successfully!",
      });
    } catch (err: any) {
      console.error("Vigilance public complaint error:", err);
      return res.status(500).json({ message: "Failed to submit Vigilance complaint. Please try again." });
    }
  }
);

// Helper for status mapping
function mapToPublicStatus(rawStatus: string, finalOutcome?: string): string {
  const s = (rawStatus || "").toUpperCase();
  const o = (finalOutcome || "").toUpperCase();

  if (s === "NEW" || s === "PENDING") {
    return "Submitted";
  }
  if (s === "ON_PROCESS" || s === "ESCALATED") {
    return "Under Review";
  }
  if (s === "INVESTIGATION" || s === "UNDER_INVESTIGATION") {
    return "Investigation";
  }
  if (s === "PROVEN" || o === "PROVEN") {
    return "Proven";
  }
  if (
    s === "UNPROVEN" ||
    s === "NOT_PROVEN" ||
    o === "NOT_PROVEN" ||
    o === "UNSUBSTANTIATED"
  ) {
    return "Unproven";
  }
  if (s === "RESOLVED" || s === "CLOSED") {
    return "Closed";
  }
  return "Submitted";
}

// 4. Track Public Complaint Status (Secured by Unique Tracking Reference and Registered Email)
router.post("/complaints/track", trackingOtpLimiter, async (req: Request, res: Response) => {
  const { complaintReference, complaintId, email, department } = req.body;
  const cleanRef = String(complaintReference || complaintId || "").trim().toUpperCase();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanDept = String(department || "").trim().toUpperCase();

  if (!cleanRef || !cleanEmail || !cleanEmail.includes("@")) {
    return res.status(400).json({
      message: "Both Complaint Tracking Number and registered Email Address are required.",
    });
  }

  try {
    const complaint = await Complaint.findOne({ complaintReference: cleanRef });
    if (!complaint) {
      return res.status(404).json({
        message: "No complaint record found matching the provided Tracking Number and Email Address.",
      });
    }

    const storedEmail = (complaint.complainant?.email || "").trim().toLowerCase();
    if (storedEmail !== cleanEmail) {
      return res.status(404).json({
        message: "No complaint record found matching the provided Tracking Number and Email Address.",
      });
    }

    // Optional department check
    const compDept = (complaint.assignedDepartment || complaint.category || "PGRC").toUpperCase();
    if (cleanDept && compDept !== cleanDept) {
      return res.status(404).json({
        message: "No complaint record found matching the provided Tracking Number and Email Address.",
      });
    }

    // Find institution snapshot
    const inst =
      (await Institution.findById(complaint.institutionId)) ||
      (await Institution.findOne({ collegeId: complaint.collegeId }));

    const publicStatus = mapToPublicStatus(complaint.status, complaint.finalOutcome);

    // Only return minimal, public-safe tracking details.
    // Never expose confidential investigation notes, internal employee remarks,
    // uploaded evidence files, or sensitive complainant PII.
    return res.json({
      success: true,
      complaintReference: complaint.complaintReference,
      department: compDept,
      subject: complaint.subject || complaint.title || "Complaint",
      institutionName: inst?.name || complaint.institutionNameSnapshot || "Registered Institution",
      submissionDate: complaint.createdAt,
      status: publicStatus,
      rawStatus: complaint.status,
      lastUpdated: complaint.updatedAt,
      publicRemarks:
        complaint.publicStatusMessage ||
        `Complaint is currently in '${publicStatus}' stage in the official AICTE Registry.`,
    });
  } catch (err: any) {
    console.error("Complaint tracking error:", err);
    return res.status(500).json({ message: "Failed to retrieve complaint tracking details." });
  }
});

// 5. Secure file preview for complaint evidence (Requires authorized session or valid token)
router.get("/files/:fileName", async (req: Request, res: Response) => {
  const fileNameParam = Array.isArray(req.params.fileName) ? req.params.fileName[0] : req.params.fileName;
  const safeName = path.basename(fileNameParam || "");
  const filePath = path.join(UPLOAD_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  // User must be an authenticated employee or possess a valid expiring token
  const hasEmployeeAuth = Boolean(
    req.session && (req.session as any).userId && (req.session as any).role
  );
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const isTokenValid = token ? verifyFileToken(safeName, token) : false;

  if (!hasEmployeeAuth && !isTokenValid) {
    return res.status(403).json({
      message: "Access forbidden: valid authorized session or secure expiring token required to view evidence.",
    });
  }

  const ext = path.extname(safeName).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
  };
  const mimeType = mimeMap[ext] || "application/octet-stream";

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  return res.sendFile(filePath);
});

// Backward compatibility redirects
router.post("/complaint", publicComplaintLimiter, async (req: Request, res: Response) => {
  return res.redirect(
    307,
    req.body.category === "VIGILANCE"
      ? "/api/public/complaints/vigilance"
      : "/api/public/complaints/pgrc"
  );
});

router.post("/track", trackingOtpLimiter, async (req: Request, res: Response) => {
  const { complaintReference, verificationFactor, email } = req.body;
  req.body.email = email || verificationFactor;
  req.body.complaintReference = complaintReference;
  return res.redirect(307, "/api/public/complaints/track");
});

export default router;
