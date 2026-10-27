// src/routes/pgrc.ts
import { Router, Request, Response } from "express";
import { Complaint } from "../models/Complaint";
import { Investigation } from "../models/Investigation";
import { Institution } from "../models/Institution";
import { AuditLog } from "../models/AuditLog";
import { requireAuth, requireRole } from "../middleware/auth";
import { User } from "../models/User";

const router = Router();

// Helper to find complaint by Mongo _id or complaintReference
async function findComplaintByIdOrRef(idOrRef: any) {
  const str = String(idOrRef || "");
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return await Complaint.findById(str);
  }
  return await Complaint.findOne({ complaintReference: str });
}

// 1. Dashboard metrics for PGRC employee (Real MongoDB counts)
router.get(
  "/dashboard",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (_req: Request, res: Response) => {
    try {
      const total = await Complaint.countDocuments();
      const newComplaints = await Complaint.countDocuments({
        $or: [{ status: "PENDING" }, { status: "NEW" }],
      });
      const onProcess = await Complaint.countDocuments({
        $or: [
          { status: "UNDER_INVESTIGATION" },
          { status: "ON_PROCESS" },
          { finalOutcome: "ON_PROCESS" },
        ],
      });
      const proven = await Complaint.countDocuments({
        $or: [{ status: "PROVEN" }, { finalOutcome: "PROVEN" }],
      });
      const notProven = await Complaint.countDocuments({
        $or: [
          { status: "NOT_PROVEN" },
          { finalOutcome: "NOT_PROVEN" },
          { finalOutcome: "UNSUBSTANTIATED" },
          { status: "RESOLVED", finalOutcome: { $ne: "PROVEN" } },
        ],
      });
      const escalated = await Complaint.countDocuments({
        $or: [{ status: "ESCALATED" }, { escalatedToVigilance: true }],
      });

      return res.json({
        total,
        newComplaints,
        pending: newComplaints,
        onProcess,
        proven,
        notProven,
        escalated,
      });
    } catch (err) {
      console.error("PGRC dashboard stats error:", err);
      return res.status(500).json({ message: "Failed to fetch PGRC dashboard statistics" });
    }
  }
);

// 2. List all complaints for PGRC review (with filtering & institution population)
router.get(
  "/complaints",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    try {
      const { status, filter, tab } = req.query as any;
      const query: any = {
        $or: [
          { assignedDepartment: "PGRC" },
          { category: "PGRC" },
          { assignedDepartment: { $exists: false } },
        ],
      };

      const selectedTab = (tab || status || filter || "").toUpperCase();
      if (selectedTab === "NEW") {
        query.status = { $in: ["NEW", "PENDING"] };
      } else if (selectedTab === "INVESTIGATION") {
        query.status = { $in: ["INVESTIGATION", "UNDER_INVESTIGATION", "ON_PROCESS"] };
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
          institutionName: inst?.name || "Institution " + (c.collegeId || c.institutionId),
          collegeId: c.collegeId || inst?.collegeId || "N/A",
          state: inst?.state || "N/A",
          district: inst?.district || "N/A",
        };
      });

      return res.json(enriched);
    } catch (err) {
      console.error("PGRC complaints list error:", err);
      return res.status(500).json({ message: "Failed to fetch complaints" });
    }
  }
);

// 3. View single complaint details
router.get(
  "/complaint/:id",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    try {
      const complaint = await findComplaintByIdOrRef(req.params.id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const inst = await Institution.findOne({
        $or: [{ _id: complaint.institutionId }, { collegeId: complaint.collegeId }],
      }).lean();

      // Check if an investigation is linked
      const investigation = await Investigation.findOne({ complaintId: complaint._id }).lean();

      return res.json({
        ...complaint.toObject(),
        institutionName: inst?.name || "Technical Institution",
        collegeId: complaint.collegeId || inst?.collegeId || "N/A",
        institutionDetails: inst,
        linkedInvestigation: investigation
          ? {
              investigationId: investigation.investigationId,
              status: investigation.status,
              finalOutcome: investigation.finalOutcome,
            }
          : null,
      });
    } catch (err) {
      console.error("PGRC complaint detail error:", err);
      return res.status(500).json({ message: "Failed to fetch complaint details" });
    }
  }
);

// 4. Accept Complaint for review
router.post(
  "/complaint/:id/accept",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    try {
      const complaint = await findComplaintByIdOrRef(req.params.id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const prevStatus = complaint.status;
      complaint.status = "UNDER_INVESTIGATION";
      complaint.investigationStatus = "UNDER_INVESTIGATION";
      if (!complaint.assignedEmployee) {
        complaint.assignedEmployee = req.session?.userId || "PGRC Officer";
      }

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: `Complaint accepted for investigation by ${req.session?.userId || "PGRC Officer"}.`,
        author: req.session?.userId || "PGRC Officer",
        date: new Date(),
      });

      await complaint.save();

      await AuditLog.create({
        action: "accept_complaint",
        employeeId: req.session?.userId || "unknown",
        role: "PGRC_EMPLOYEE",
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: "UNDER_INVESTIGATION",
        details: `Complaint ${complaint.complaintReference || complaint._id} accepted for review`,
      });

      return res.json({ message: "Complaint accepted for review", complaint });
    } catch (err) {
      console.error("Accept complaint error:", err);
      return res.status(500).json({ message: "Failed to accept complaint" });
    }
  }
);

// 5. Assign Complaint to employee
router.post(
  "/complaint/:id/assign",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { assignedEmployee } = req.body;
    if (!assignedEmployee) {
      return res.status(400).json({ message: "assignedEmployee is required" });
    }

    try {
      const complaint = await findComplaintByIdOrRef(req.params.id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      complaint.assignedEmployee = String(assignedEmployee).trim();
      if (complaint.status === "PENDING" || complaint.status === "NEW") {
        complaint.status = "UNDER_INVESTIGATION";
        complaint.investigationStatus = "UNDER_INVESTIGATION";
      }

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: `Assigned to investigator ${assignedEmployee}.`,
        author: req.session?.userId || "PGRC Officer",
        date: new Date(),
      });

      await complaint.save();

      await AuditLog.create({
        action: "assign_complaint",
        employeeId: req.session?.userId || "unknown",
        role: "PGRC_EMPLOYEE",
        complaintId: complaint._id.toString(),
        details: `Complaint assigned to ${assignedEmployee}`,
      });

      return res.json({ message: "Complaint assigned successfully", complaint });
    } catch (err) {
      console.error("Assign complaint error:", err);
      return res.status(500).json({ message: "Failed to assign complaint" });
    }
  }
);

// 6. Add investigation note / remarks
router.post(
  "/complaint/:id/notes",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { note } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    try {
      const complaint = await findComplaintByIdOrRef(req.params.id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: String(note).trim(),
        author: req.session?.userId || "PGRC Officer",
        date: new Date(),
      });

      await complaint.save();

      return res.json({ message: "Note added successfully", notes: complaint.investigationNotes });
    } catch (err) {
      console.error("Add complaint note error:", err);
      return res.status(500).json({ message: "Failed to add note" });
    }
  }
);

// 7. Update investigation progress
router.post(
  "/complaint/:id/progress",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { progressRemarks, status } = req.body;

    try {
      const complaint = await findComplaintByIdOrRef(req.params.id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (status) {
        complaint.status = status;
        complaint.investigationStatus = status;
      }
      if (progressRemarks) {
        complaint.investigationNotes = complaint.investigationNotes || [];
        complaint.investigationNotes.push({
          note: `Investigation progress update: ${progressRemarks}`,
          author: req.session?.userId || "PGRC Officer",
          date: new Date(),
        });
      }

      await complaint.save();
      return res.json({ message: "Progress updated successfully", complaint });
    } catch (err) {
      console.error("Update progress error:", err);
      return res.status(500).json({ message: "Failed to update progress" });
    }
  }
);

// 8. Escalate a PGRC complaint to Vigilance (Part 3.5)
router.post(
  "/complaint/:id/escalate",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason, escalationReason } = req.body;
    const finalReason = (reason || escalationReason || "").trim();

    if (!finalReason) {
      return res.status(400).json({ message: "Escalation reason is required" });
    }

    try {
      const complaint = await findComplaintByIdOrRef(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      // Prevent duplicate investigations for the same complaint
      const existingInv = await Investigation.findOne({ complaintId: complaint._id });
      if (existingInv) {
        return res.status(400).json({
          message: `Investigation already exists for this complaint (${existingInv.investigationId})`,
        });
      }

      const prevStatus = complaint.status;
      complaint.status = "ESCALATED";
      complaint.escalatedToVigilance = true;
      complaint.escalationReason = finalReason;

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: `Escalated to Vigilance: ${finalReason}`,
        author: req.session?.userId || "PGRC Officer",
        date: new Date(),
      });

      await complaint.save();

      // Create linked Vigilance investigation with shared complaint reference
      const investigationId = `INV-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      const investigation = new Investigation({
        investigationId,
        complaintId: complaint._id,
        complaintReference: complaint.complaintReference,
        institutionId: complaint.institutionId,
        collegeId: complaint.collegeId,
        status: "OPEN",
        evidencePath: complaint.evidencePath || "",
        evidenceReferences: complaint.evidenceReferences || [],
        investigationNotes: [
          {
            note: `Escalated from PGRC by ${req.session?.userId || "PGRC Officer"}. Reason: ${finalReason}`,
            author: req.session?.userId || "PGRC Officer",
            date: new Date(),
          },
        ],
      });
      await investigation.save();

      // Persistent audit log
      await AuditLog.create({
        action: "escalate_complaint",
        employeeId: req.session?.userId || "unknown",
        role: "PGRC_EMPLOYEE",
        investigationId: investigation.investigationId,
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: "ESCALATED",
        details: `Complaint ${complaint.complaintReference} escalated to Vigilance. Reason: ${finalReason}`,
      });

      return res.status(201).json({
        success: true,
        investigationId: investigation.investigationId,
        complaintId: complaint._id,
        complaintReference: complaint.complaintReference,
        message: "Escalated to Vigilance successfully",
      });
    } catch (err: any) {
      if (err.code === 11000) {
        return res.status(400).json({ message: "Investigation already exists for this complaint" });
      }
      console.error("PGRC escalation error:", err);
      return res.status(500).json({ message: "Failed to escalate complaint" });
    }
  }
);

// 9. Finalize Finding (PROVEN, NOT_PROVEN, ON_PROCESS) - Part 3.4
router.post(
  "/complaint/:id/finalize",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { outcome, findingSummary, rationale } = req.body;

    const allowed = ["PROVEN", "NOT_PROVEN", "ON_PROCESS"];
    if (!outcome || !allowed.includes(outcome)) {
      return res.status(400).json({
        message: "Valid outcome is required: PROVEN, NOT_PROVEN, or ON_PROCESS",
      });
    }
    if (!findingSummary || !String(findingSummary).trim()) {
      return res.status(400).json({ message: "Finding summary is required before finalization" });
    }

    try {
      const complaint = await findComplaintByIdOrRef(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      const prevStatus = complaint.status;
      complaint.finalOutcome = outcome as any;
      complaint.findingSummary = String(findingSummary).trim();
      complaint.finalizedBy = req.session?.userId || "PGRC Officer";
      complaint.finalizedAt = new Date();

      if (outcome === "PROVEN") {
        complaint.status = "PROVEN";
      } else if (outcome === "NOT_PROVEN") {
        complaint.status = "NOT_PROVEN";
      } else {
        complaint.status = "ON_PROCESS";
      }

      complaint.investigationNotes = complaint.investigationNotes || [];
      complaint.investigationNotes.push({
        note: `Final Finding recorded: ${outcome}. Summary: ${findingSummary}${
          rationale ? ` | Rationale: ${rationale}` : ""
        }`,
        author: req.session?.userId || "PGRC Officer",
        date: new Date(),
      });

      await complaint.save();

      await AuditLog.create({
        action: "finalize_pgrc_finding",
        employeeId: req.session?.userId || "unknown",
        role: "PGRC_EMPLOYEE",
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: complaint.status,
        details: `Finding finalized as ${outcome}: ${findingSummary.slice(0, 100)}`,
      });

      return res.json({
        message: `Complaint outcome finalized as ${outcome}`,
        complaint,
      });
    } catch (err) {
      console.error("Finalize finding error:", err);
      return res.status(500).json({ message: "Failed to finalize finding" });
    }
  }
);

// Manual Decision Endpoint (Proven / Unproven / Investigation) with mandatory reason
router.post(
  "/complaint/:id/decision",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
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
      const complaint = await findComplaintByIdOrRef(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      if (complaint.assignedDepartment && complaint.assignedDepartment !== "PGRC" && complaint.category !== "PGRC") {
        return res.status(403).json({ message: "PGRC officers cannot modify complaints belonging to other departments." });
      }

      const prevStatus = complaint.status;
      const officer = req.session?.userId || "pgrc_emp";
      const now = new Date();

      if (decision === "INVESTIGATION") {
        complaint.status = "INVESTIGATION";
        complaint.investigationStatus = "INVESTIGATION";
        complaint.finalOutcome = "ON_PROCESS";
        complaint.publicStatusMessage = `Complaint accepted for official investigation. Cause: ${reason.trim()}`;
      } else if (decision === "PROVEN") {
        complaint.status = "PROVEN";
        complaint.finalOutcome = "PROVEN";
        complaint.publicStatusMessage = `Investigation concluded: Allegations verified and established. Cause: ${reason.trim()}`;
      } else if (decision === "UNPROVEN") {
        complaint.status = "UNPROVEN";
        complaint.finalOutcome = "NOT_PROVEN";
        complaint.publicStatusMessage = `Investigation concluded: Allegations not substantiated. Finding: ${reason.trim()}`;
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
        note: `Decision recorded: ${decision}. Reason: ${reason.trim()}`,
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
        action: `pgrc_decision_${decision.toLowerCase()}`,
        employeeId: officer,
        role: "PGRC_EMPLOYEE",
        complaintId: complaint._id.toString(),
        previousStatus: prevStatus,
        newStatus: complaint.status,
        details: `PGRC Officer decided ${decision} for complaint ${complaint.complaintReference || complaint._id}: ${reason.trim()}`,
      });

      return res.json({
        success: true,
        message: `Complaint marked as ${decision} successfully.`,
        complaint,
      });
    } catch (err: any) {
      console.error("PGRC decision error:", err);
      return res.status(500).json({ message: "Failed to record decision" });
    }
  }
);

// Notifications for PGRC
router.get(
  "/notifications",
  requireAuth,
  requireRole("PGRC_EMPLOYEE"),
  async (_req: Request, res: Response) => {
    try {
      const newComplaints = await Complaint.find({ status: "PENDING" })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      const notifs = newComplaints.map((c: any) => ({
        id: `NOTIF-${c._id}`,
        title: `New Grievance Submitted: ${c.complaintReference || c._id}`,
        message: `Category: ${c.category} - ${c.title || c.subject}`,
        timestamp: c.createdAt,
        read: false,
      }));

      return res.json({ notifications: notifs });
    } catch (err) {
      return res.json({ notifications: [] });
    }
  }
);

export default router;
