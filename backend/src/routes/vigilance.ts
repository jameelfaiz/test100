// src/routes/vigilance.ts
import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, requireRole } from "../middleware/auth";
import { Complaint } from "../models/Complaint";
import { Investigation } from "../models/Investigation";
import { Institution } from "../models/Institution";
import { User } from "../models/User";
import { upload, validateFileSignature, UPLOAD_DIR } from "../middleware/upload";
import { uploadLimiter } from "../middleware/rateLimiter";

const router = Router();

function auditLog(req: Request, action: string) {
  const userId = req.session?.userId ?? "unknown";
  const role = req.session?.role ?? "unknown";
  console.log(`[AUDIT] ${new Date().toISOString()} | userId=${userId} | role=${role} | action=${action}`);
}

async function findInvestigationByIdOrRef(id: any) {
  const str = String(id || "");
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(str);
  return await Investigation.findOne({
    $or: [{ investigationId: str }, ...(isMongoId ? [{ _id: str }] : [])],
  });
}

// 1. Vigilance Dashboard statistics (Part 4.2)
router.get(
  "/dashboard",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    try {
      const totalInvestigations = await Investigation.countDocuments();
      const newInvestigations = await Investigation.countDocuments({ status: "OPEN" });
      const onProcess = await Investigation.countDocuments({
        $or: [
          { status: "IN_PROGRESS" },
          { status: "UNDER_REVIEW" },
          { status: "ON_PROCESS" },
          { finalOutcome: "ON_PROCESS" },
          { finalOutcome: "INCONCLUSIVE" },
        ],
      });
      const proven = await Investigation.countDocuments({
        $or: [
          { finalOutcome: "PROVEN" },
          { supervisorDecision: "PROVEN" },
        ],
      });
      const notProven = await Investigation.countDocuments({
        $or: [
          { finalOutcome: "NOT_PROVEN" },
          { finalOutcome: "UNSUBSTANTIATED" },
          { supervisorDecision: "UNSUBSTANTIATED" },
        ],
      });
      const pendingFindings = await Investigation.countDocuments({
        status: { $in: ["IN_PROGRESS", "UNDER_REVIEW"] },
        finalOutcome: { $exists: false },
      });

      const totalComplaints = await Complaint.countDocuments({ assignedDepartment: "VIGILANCE" });
      const escalatedComplaints = await Complaint.countDocuments({
        $or: [{ status: "ESCALATED" }, { escalatedToVigilance: true }],
      });

      auditLog(req, "Vigilance dashboard fetched");
      return res.json({
        totalInvestigations,
        newInvestigations,
        pending: newInvestigations,
        inProgress: onProcess,
        underReview: pendingFindings,
        onProcess,
        proven,
        notProven,
        pendingFindings,
        totalComplaints,
        escalatedComplaints,
      });
    } catch (err) {
      console.error("Vigilance dashboard stats error:", err);
      return res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  }
);

// 2. Fetch full investigations for vigilance employee dashboard (with filtering)
router.get(
  "/investigations",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    try {
      const { status, filter } = req.query as any;
      const query: any = {};

      if (status || filter) {
        const f = (status || filter).toUpperCase();
        if (f === "OPEN" || f === "NEW") {
          query.status = "OPEN";
        } else if (f === "PROVEN") {
          query.$or = [{ finalOutcome: "PROVEN" }, { supervisorDecision: "PROVEN" }];
        } else if (f === "NOT_PROVEN") {
          query.$or = [
            { finalOutcome: "NOT_PROVEN" },
            { finalOutcome: "UNSUBSTANTIATED" },
            { supervisorDecision: "UNSUBSTANTIATED" },
          ];
        } else if (f === "ON_PROCESS" || f === "IN_PROGRESS") {
          query.$or = [
            { status: "IN_PROGRESS" },
            { status: "UNDER_REVIEW" },
            { status: "ON_PROCESS" },
            { finalOutcome: "ON_PROCESS" },
            { finalOutcome: "INCONCLUSIVE" },
          ];
        } else if (f === "COMPLETED") {
          query.status = "COMPLETED";
        }
      }

      const investigations = await Investigation.find(query)
        .populate("complaintId")
        .populate("assignedInvestigatorId")
        .sort({ createdAt: -1 })
        .lean();

      // Collect institutions
      const instIds = investigations.map((inv: any) => String(inv.institutionId || "")).filter(Boolean);
      const collegeIds = investigations.map((inv: any) => inv.collegeId).filter(Boolean);
      const validMongoIds = instIds.filter((id: string) => /^[0-9a-fA-F]{24}$/.test(id));

      const orConditions: any[] = [];
      if (validMongoIds.length > 0) orConditions.push({ _id: { $in: validMongoIds } });
      if (collegeIds.length > 0) orConditions.push({ collegeId: { $in: collegeIds } });

      const institutions = orConditions.length > 0 ? await Institution.find({ $or: orConditions }).lean() : [];

      const instMapById = new Map(institutions.map((i: any) => [i._id.toString(), i]));
      const instMapByCollegeId = new Map(institutions.map((i: any) => [i.collegeId, i]));

      const enriched = investigations.map((inv: any) => {
        const complaint = inv.complaintId || {};
        const inst =
          instMapById.get(inv.institutionId) ||
          (inv.collegeId ? instMapByCollegeId.get(inv.collegeId) : null) ||
          (complaint.institutionId ? instMapById.get(complaint.institutionId) : null) ||
          (complaint.collegeId ? instMapByCollegeId.get(complaint.collegeId) : null);

        return {
          ...inv,
          institutionName: inst?.name || "Institution " + (inv.collegeId || complaint.collegeId || "N/A"),
          collegeId: inv.collegeId || complaint.collegeId || inst?.collegeId || "N/A",
          complaintReference:
            inv.complaintReference ||
            complaint.complaintReference ||
            `COMP-INV-${inv.investigationId.slice(-6)}`,
          complaintCategory: complaint.category || "General / Misconduct",
          complaintSubject: complaint.subject || complaint.title || "Investigation Allegation",
          complaintDescription: complaint.description || "",
        };
      });

      auditLog(req, "Fetched full investigations list");
      return res.json(enriched);
    } catch (err) {
      console.error("Vigilance investigations list error:", err);
      return res.status(500).json({ message: "Failed to fetch full investigations" });
    }
  }
);

// 3. View single investigation details
router.get(
  "/investigation/:id",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    try {
      const inv = await findInvestigationByIdOrRef(req.params.id);
      if (!inv) return res.status(404).json({ message: "Investigation not found" });

      const populatedInv: any = await inv.populate([
        { path: "complaintId" },
        { path: "assignedInvestigatorId" },
      ]);

      const complaint: any = inv.complaintId || {};
      const inst = await Institution.findOne({
        $or: [
          { _id: inv.institutionId || complaint.institutionId },
          { collegeId: inv.collegeId || complaint.collegeId },
        ],
      }).lean();

      return res.json({
        ...inv,
        institutionName: inst?.name || "Technical Institution",
        collegeId: inv.collegeId || complaint.collegeId || inst?.collegeId || "N/A",
        institutionDetails: inst,
        complaintReference:
          inv.complaintReference ||
          complaint.complaintReference ||
          `COMP-INV-${inv.investigationId.slice(-6)}`,
        complaintSubject: complaint.subject || complaint.title || "Investigation Allegation",
        complaintDescription: complaint.description || "",
        complainant: complaint.complainant,
      });
    } catch (err) {
      console.error("Vigilance investigation detail error:", err);
      return res.status(500).json({ message: "Failed to fetch investigation" });
    }
  }
);

// 4. Create a new investigation for a complaint
router.post(
  "/investigation",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { complaintId } = req.body;
    if (!complaintId) {
      return res.status(400).json({ message: "complaintId required" });
    }
    const investigationId = `INV-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }
      const existing = await Investigation.findOne({ complaintId: complaint._id });
      if (existing) {
        return res.status(400).json({
          message: `Investigation already exists for this complaint (${existing.investigationId})`,
        });
      }
      const prevStatus = complaint.status;
      complaint.status = "ESCALATED";
      await complaint.save();

      const investigation = new Investigation({
        investigationId,
        complaintId: complaint._id,
        complaintReference: complaint.complaintReference,
        institutionId: complaint.institutionId,
        collegeId: complaint.collegeId,
        status: "OPEN",
      });
      await investigation.save();
      auditLog(req, `Created investigation ${investigationId} for complaint ${complaintId}`);

      await AuditLog.create({
        action: "create_investigation",
        employeeId: req.session?.userId || "unknown",
        role: req.session?.role || "VIGILANCE_EMPLOYEE",
        investigationId,
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: "OPEN",
        details: `Investigation created for complaint ${complaintId}`,
      });

      return res.status(201).json({ message: "Investigation created", investigation });
    } catch (err: any) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Investigation already exists for this complaint" });
      }
      console.error(err);
      return res.status(500).json({ message: "Failed to create investigation" });
    }
  }
);

// 5. Assign an investigator
router.post(
  "/investigation/:id/assign",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { investigatorUserId } = req.body;
    if (!investigatorUserId) {
      return res.status(400).json({ message: "investigatorUserId required" });
    }
    try {
      const investigation = await findInvestigationByIdOrRef(id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });

      const investigator = await User.findOne({
        userId: investigatorUserId,
        role: { $in: ["VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"] },
      });
      if (!investigator) {
        return res.status(404).json({ message: "Investigator not found or not Vigilance personnel" });
      }

      const prevStatus = investigation.status;
      investigation.assignedInvestigatorId = investigator._id;
      investigation.assignedInvestigator = investigator.userId;
      investigation.assignedInvestigatorName = investigator.username || investigator.userId;
      investigation.status = "IN_PROGRESS";

      investigation.investigationNotes = investigation.investigationNotes || [];
      investigation.investigationNotes.push({
        note: `Assigned to investigator ${investigator.userId}.`,
        author: req.session?.userId || "Vigilance",
        date: new Date(),
      });

      await investigation.save();
      auditLog(req, `Assigned investigator ${investigatorUserId} to investigation ${id}`);

      await AuditLog.create({
        action: "assign_investigator",
        employeeId: req.session!.userId,
        role: req.session!.role,
        investigationId: id,
        complaintId: investigation.complaintId?.toString(),
        previousStatus: prevStatus,
        newStatus: "IN_PROGRESS",
        details: `Investigator ${investigatorUserId} assigned`,
      });

      return res.json({ message: "Investigator assigned", investigation });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to assign investigator" });
    }
  }
);

// 6. Add investigation note / remarks
router.post(
  "/investigation/:id/notes",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { note } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    try {
      const investigation = await findInvestigationByIdOrRef(req.params.id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });

      investigation.investigationNotes = investigation.investigationNotes || [];
      investigation.investigationNotes.push({
        note: String(note).trim(),
        author: req.session?.userId || "Vigilance Officer",
        date: new Date(),
      });

      await investigation.save();
      return res.json({ message: "Note added successfully", notes: investigation.investigationNotes });
    } catch (err) {
      console.error("Add investigation note error:", err);
      return res.status(500).json({ message: "Failed to add note" });
    }
  }
);

// 7. Submit / Prepare findings by investigator
router.post(
  "/investigation/:id/findings",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { findings, findingSummary, status } = req.body;
    const text = findings || findingSummary;
    if (!text) return res.status(400).json({ message: "findings / findingSummary required" });

    try {
      const investigation = await findInvestigationByIdOrRef(id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });

      const prevStatus = investigation.status;
      investigation.findings = text;
      investigation.findingSummary = text;
      investigation.status = status || "UNDER_REVIEW";

      investigation.investigationNotes = investigation.investigationNotes || [];
      investigation.investigationNotes.push({
        note: `Findings submitted for review: ${text.slice(0, 100)}...`,
        author: req.session?.userId || "Vigilance Officer",
        date: new Date(),
      });

      await investigation.save();
      auditLog(req, `Vigilance employee submitted findings for investigation ${id}`);

      return res.json({ message: "Findings saved successfully", investigation });
    } catch (err) {
      console.error("Submit findings error:", err);
      return res.status(500).json({ message: "Failed to submit findings" });
    }
  }
);

// Helper for finalizing investigation
async function executeFinalizeInvestigation(
  id: string,
  rawDecision: string,
  findingSummary: string | undefined,
  rationale: string | undefined,
  userId: string,
  userRole: string,
  res: Response
) {
  const normRaw = (rawDecision || "").toUpperCase();
  let normalizedDecision: "PROVEN" | "NOT_PROVEN" | "ON_PROCESS" = "ON_PROCESS";

  if (normRaw === "PROVEN") {
    normalizedDecision = "PROVEN";
  } else if (normRaw === "NOT_PROVEN" || normRaw === "UNSUBSTANTIATED") {
    normalizedDecision = "NOT_PROVEN";
  } else if (normRaw === "ON_PROCESS" || normRaw === "INCONCLUSIVE") {
    normalizedDecision = "ON_PROCESS";
  } else {
    return res.status(400).json({
      message: "Invalid outcome value. Must be PROVEN, NOT_PROVEN, or ON_PROCESS",
    });
  }

  try {
    const investigation = await findInvestigationByIdOrRef(id);
    if (!investigation) return res.status(404).json({ message: "Investigation not found" });

    const prevStatus = investigation.status;
    investigation.status = normalizedDecision === "ON_PROCESS" ? "ON_PROCESS" : "COMPLETED";
    investigation.finalOutcome = normalizedDecision;
    investigation.supervisorDecision = normalizedDecision;
    if (findingSummary) {
      investigation.findingSummary = findingSummary;
    }
    investigation.finalizedBy = userId;
    investigation.finalizedAt = new Date();

    investigation.investigationNotes = investigation.investigationNotes || [];
    investigation.investigationNotes.push({
      note: `Final Finding Authorized: ${normalizedDecision}. ${findingSummary || ""}${
        rationale ? ` | Rationale: ${rationale}` : ""
      }`,
      author: userId,
      date: new Date(),
    });

    await investigation.save();

    // Synchronize with linked complaint if present
    if (investigation.complaintId) {
      const complaint = await Complaint.findById(
        (investigation.complaintId as any)._id || investigation.complaintId
      );
      if (complaint) {
        complaint.finalOutcome = normalizedDecision;
        complaint.status =
          normalizedDecision === "PROVEN"
            ? "PROVEN"
            : normalizedDecision === "NOT_PROVEN"
            ? "NOT_PROVEN"
            : "ON_PROCESS";
        complaint.findingSummary = findingSummary || investigation.findingSummary;
        complaint.finalizedBy = userId;
        complaint.finalizedAt = new Date();
        await complaint.save();
      }
    }

    await AuditLog.create({
      action: "finalize_investigation",
      employeeId: userId,
      role: userRole,
      investigationId: investigation.investigationId,
      complaintId: investigation.complaintId ? (investigation.complaintId as any)._id?.toString() : undefined,
      previousStatus: prevStatus,
      newStatus: investigation.status,
      details: `Investigation finalized with outcome: ${normalizedDecision}`,
    });

    return res.json({
      message: "Investigation finalized successfully",
      investigation,
      normalizedOutcome: normalizedDecision,
    });
  } catch (err) {
    console.error("Finalize investigation error:", err);
    return res.status(500).json({ message: "Failed to finalize investigation" });
  }
}

// 8. Finalize authorized finding (PROVEN, NOT_PROVEN, ON_PROCESS) - Parts 4.6 & 4.7
router.post(
  "/investigation/:id/finalize",
  requireAuth,
  requireRole("VIGILANCE_SUPERVISOR", "VIGILANCE_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { outcome, decision, findingSummary, rationale } = req.body;
    return await executeFinalizeInvestigation(
      String(id),
      outcome || decision,
      findingSummary,
      rationale,
      req.session?.userId || "Vigilance Officer",
      req.session?.role || "VIGILANCE_EMPLOYEE",
      res
    );
  }
);

// Backward compatibility: Approve endpoint
router.post(
  "/investigation/:id/approve",
  requireAuth,
  requireRole("VIGILANCE_SUPERVISOR", "VIGILANCE_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { decision, findingSummary, rationale } = req.body;
    return await executeFinalizeInvestigation(
      String(id),
      decision,
      findingSummary,
      rationale,
      req.session?.userId || "Vigilance Supervisor",
      req.session?.role || "VIGILANCE_SUPERVISOR",
      res
    );
  }
);

// 9. Add evidence to an investigation
router.post(
  "/investigation/:id/evidence",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { evidencePath } = req.body;
    if (!evidencePath) return res.status(400).json({ message: "evidencePath required" });
    if (
      evidencePath.includes("..") ||
      evidencePath.startsWith("/") ||
      evidencePath.includes("\\") ||
      /^[a-zA-Z]:/.test(evidencePath)
    ) {
      return res.status(400).json({ message: "Invalid evidence path" });
    }
    try {
      const investigation = await findInvestigationByIdOrRef(id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });

      investigation.evidencePath = evidencePath;
      investigation.evidenceReferences = investigation.evidenceReferences || [];
      investigation.evidenceReferences.push(evidencePath);
      await investigation.save();

      return res.json({ message: "Evidence added", investigation });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to add evidence" });
    }
  }
);

// 10. Secure file upload for evidence
router.post(
  "/investigation/:id/upload-evidence",
  uploadLimiter,
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  upload.single("file"),
  validateFileSignature,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    try {
      const investigation = await findInvestigationByIdOrRef(id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });

      investigation.evidencePath = file.filename;
      investigation.evidenceReferences = investigation.evidenceReferences || [];
      investigation.evidenceReferences.push(file.filename);
      await investigation.save();

      return res.status(200).json({
        message: "Evidence file uploaded successfully",
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to save evidence upload" });
    }
  }
);

// 11. Secure authenticated download endpoint
router.get(
  "/investigation/:id/download-evidence",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const investigation = await findInvestigationByIdOrRef(id);
      if (!investigation) return res.status(404).json({ message: "Investigation not found" });
      const evidencePath = investigation.evidencePath;
      if (!evidencePath) return res.status(404).json({ message: "No evidence attached" });

      const safeFilename = path.basename(evidencePath);
      const filePath = path.join(UPLOAD_DIR, safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Evidence file not found on disk" });
      }

      auditLog(req, `Evidence downloaded for investigation ${id}`);
      return res.download(filePath, safeFilename);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to download evidence" });
    }
  }
);

// 12. Notifications for Vigilance
router.get(
  "/notifications",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (_req: Request, res: Response) => {
    try {
      const openInvs = await Investigation.find({ status: "OPEN" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const notifs = openInvs.map((inv: any) => ({
        id: `NOTIF-${inv._id}`,
        title: `New Investigation Case: ${inv.investigationId}`,
        message: `Status: Open — Investigation pending investigator assignment`,
        timestamp: inv.createdAt,
        read: false,
      }));

      return res.json({ notifications: notifs });
    } catch (err) {
      return res.json({ notifications: [] });
    }
  }
);

// List Vigilance Complaints with tab filtering
router.get(
  "/complaints",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    try {
      const { tab, status, filter } = req.query as any;
      const query: any = {
        $or: [
          { assignedDepartment: "VIGILANCE" },
          { category: "VIGILANCE" },
          { escalatedToVigilance: true },
        ],
      };

      const selectedTab = (tab || status || filter || "").toUpperCase();
      if (selectedTab === "NEW") {
        query.status = { $in: ["NEW", "PENDING", "OPEN"] };
      } else if (selectedTab === "INVESTIGATION") {
        query.status = { $in: ["INVESTIGATION", "UNDER_INVESTIGATION", "ON_PROCESS", "IN_PROGRESS", "UNDER_REVIEW"] };
      } else if (selectedTab === "PROVEN") {
        query.$or = [{ status: "PROVEN" }, { finalOutcome: "PROVEN" }];
      } else if (selectedTab === "UNPROVEN") {
        query.$or = [
          { status: "UNPROVEN" },
          { status: "NOT_PROVEN" },
          { finalOutcome: "NOT_PROVEN" },
          { finalOutcome: "UNSUBSTANTIATED" },
          { status: "RESOLVED", finalOutcome: { $ne: "PROVEN" } },
        ];
      }

      const complaints = await Complaint.find(query).sort({ createdAt: -1 }).lean();

      // Collect institutions safely
      const validMongoIds = complaints
        .map((c: any) => String(c.institutionId || ""))
        .filter((id: string) => /^[0-9a-fA-F]{24}$/.test(id));
      const collegeIds = complaints
        .map((c: any) => c.collegeId || c.institutionId)
        .filter(Boolean);

      const orConditions: any[] = [];
      if (validMongoIds.length > 0) orConditions.push({ _id: { $in: validMongoIds } });
      if (collegeIds.length > 0) orConditions.push({ collegeId: { $in: collegeIds } });

      const institutions = orConditions.length > 0 ? await Institution.find({ $or: orConditions }).lean() : [];

      const instMapById = new Map(institutions.map((i: any) => [i._id.toString(), i]));
      const instMapByCollegeId = new Map(institutions.map((i: any) => [i.collegeId, i]));

      const enriched = complaints.map((c: any) => {
        const inst =
          instMapById.get(c.institutionId) ||
          (c.collegeId ? instMapByCollegeId.get(c.collegeId) : null);

        return {
          ...c,
          institutionName: inst?.name || c.institutionNameSnapshot || "Institution " + (c.collegeId || c.institutionId),
          collegeId: c.collegeId || inst?.collegeId || "N/A",
          state: inst?.state || "N/A",
          district: inst?.district || "N/A",
        };
      });

      return res.json(enriched);
    } catch (err) {
      console.error("Vigilance complaints list error:", err);
      return res.status(500).json({ message: "Failed to fetch complaints" });
    }
  }
);

// Manual Decision Endpoint for Vigilance complaints
router.post(
  "/complaint/:id/decision",
  requireAuth,
  requireRole("VIGILANCE_EMPLOYEE", "VIGILANCE_SUPERVISOR"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { decision, reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "A decision reason/cause is mandatory." });
    }
    if (!["PROVEN", "UNPROVEN", "INVESTIGATION"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision. Must be PROVEN, UNPROVEN, or INVESTIGATION." });
    }

    try {
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(String(id));
      let complaint = isMongoId ? await Complaint.findById(id) : null;
      if (!complaint) {
        complaint = await Complaint.findOne({ complaintReference: id });
      }
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (complaint.assignedDepartment && complaint.assignedDepartment !== "VIGILANCE" && complaint.category !== "VIGILANCE") {
        return res.status(403).json({ message: "Vigilance officers cannot modify complaints belonging to other departments." });
      }

      const prevStatus = complaint.status;
      const officer = req.session?.userId || "vig_emp";
      const now = new Date();

      if (decision === "INVESTIGATION") {
        complaint.status = "INVESTIGATION";
        complaint.investigationStatus = "INVESTIGATION";
        complaint.finalOutcome = "ON_PROCESS";
        complaint.publicStatusMessage = `Complaint accepted for official vigilance investigation. Cause: ${reason.trim()}`;
      } else if (decision === "PROVEN") {
        complaint.status = "PROVEN";
        complaint.finalOutcome = "PROVEN";
        complaint.publicStatusMessage = `Vigilance investigation concluded: Corruption / financial irregularity established. Cause: ${reason.trim()}`;
      } else if (decision === "UNPROVEN") {
        complaint.status = "UNPROVEN";
        complaint.finalOutcome = "NOT_PROVEN";
        complaint.publicStatusMessage = `Vigilance investigation concluded: Allegations unsubstantiated. Finding: ${reason.trim()}`;
      }

      complaint.reason = reason.trim();
      complaint.findingSummary = reason.trim();
      complaint.decisionBy = officer;
      complaint.decisionAt = now;
      complaint.finalizedBy = officer;
      complaint.finalizedAt = now;

      complaint.statusHistory = complaint.statusHistory || [];
      complaint.statusHistory.push({
        status: complaint.status,
        reason: reason.trim(),
        updatedBy: officer,
        updatedAt: now,
      });

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: `Vigilance Decision: ${decision}. Reason: ${reason.trim()}`,
        author: officer,
        date: now,
      });

      complaint.auditHistory = complaint.auditHistory || [];
      complaint.auditHistory.push({
        action: `DECISION_${decision}`,
        performedBy: officer,
        timestamp: now,
        details: reason.trim(),
      });

      await complaint.save();

      await AuditLog.create({
        action: `vigilance_decision_${decision.toLowerCase()}`,
        employeeId: officer,
        role: "VIGILANCE_EMPLOYEE",
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: complaint.status,
        details: `Vigilance Officer decided ${decision} for complaint ${complaint.complaintReference || complaint._id}: ${reason.trim()}`,
      });

      return res.json({
        success: true,
        message: `Vigilance complaint marked as ${decision} successfully.`,
        complaint,
      });
    } catch (err: any) {
      console.error("Vigilance decision error:", err);
      return res.status(500).json({ message: "Failed to record decision" });
    }
  }
);

export default router;
