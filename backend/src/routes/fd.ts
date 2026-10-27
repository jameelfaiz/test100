// src/routes/fd.ts
import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { Institution } from "../models/Institution";
import { Application } from "../models/Application";
import { Payment } from "../models/Payment";
import { DocumentVerification } from "../models/DocumentVerification";
import { ReleaseRequest } from "../models/ReleaseRequest";
import { Complaint } from "../models/Complaint";
import { ComplaintLetter } from "../models/ComplaintLetter";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import {
  calculatePgrcClearance,
  calculateVigilanceClearance,
  calculateOverallReleaseDecision,
  resolveInstitutionIdentifiers,
} from "../services/clearanceService";
import { connectDB } from "../db";
import fs from "fs";
import path from "path";
import { UPLOAD_DIR } from "../middleware/upload";
import mongoose from "mongoose";
import { isEmailConfigured, sendMaturityReminderEmail } from "../services/emailService";
import { generateApprovalLetterPdf } from "../services/pdfService";

export const MANDATORY_DOCUMENTS = [
  { id: "land_docs", code: "DOC-01", name: "Land Ownership Documents / Registered Sale/Lease Deed", description: "Clear title deed registered in the name of the Applicant Society/Trust." },
  { id: "land_use", code: "DOC-02", name: "Land Conversion / Land Use Certificate", description: "Certificate from competent authority converting land to educational use." },
  { id: "building_plan", code: "DOC-03", name: "Approved Building Plan", description: "Sanctioned master plan approved by Town Planning Authority / Municipal Corporation." },
  { id: "occupancy_cert", code: "DOC-04", name: "Building Completion / Occupancy Certificate", description: "Valid Occupancy Certificate issued by the local development authority." },
  { id: "structural_stability", code: "DOC-05", name: "Structural Stability Certificate", description: "Issued by a registered structural engineer certifying National Building Code compliance." },
  { id: "fire_noc", code: "DOC-06", name: "Fire & Life Safety NOC", description: "Valid No Objection Certificate issued by State Fire Services." },
  { id: "barrier_free", code: "DOC-07", name: "Barrier-Free Environment & Ramp/Lift Certificate", description: "Architectural certification for Differently-Abled accessibility norms." },
  { id: "potable_water", code: "DOC-08", name: "Potable Water & Sanitation Certificate", description: "Health & Public Engineering department certificate verifying water testing." },
  { id: "aicte_affidavit", code: "DOC-09", name: "AICTE Prescribed E-Affidavit (Affidavit-1)", description: "Duly notarized e-affidavit on non-judicial stamp paper as per APH norms." },
  { id: "trust_registration", code: "DOC-10", name: "Trust / Society Registration Certificate & MoA", description: "Registered constitution, bylaws, and Memorandum of Association." },
  { id: "audited_financials", code: "DOC-11", name: "Audited Financial Statements (Last 3 Years)", description: "Balance sheet, P&L, and audit reports certified by Chartered Accountant." },
  { id: "faculty_cadre", code: "DOC-12", name: "Faculty Cadre Ratio & Staff Joining Reports", description: "List of qualified faculty, salary statements, and selection committee minutes." }
];

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const router = Router();

// Ensure DB connection
router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// Simple audit logger
function auditLog(req: Request, action: string) {
  const userId = req.session?.userId ?? "unknown";
  const role = req.session?.role ?? "unknown";
  console.log(`[AUDIT] ${new Date().toISOString()} | userId=${userId} | role=${role} | action=${action}`);
}

// Helper to safely query either by ObjectId or custom string ID without throwing CastError
function idOrQuery(id: any, customField: string) {
  const strId = Array.isArray(id) ? id[0] : String(id);
  if (mongoose.isValidObjectId(strId)) {
    return { $or: [{ _id: strId }, { [customField]: strId }] };
  }
  return { [customField]: strId };
}

// Helper to format currency
const fmt = (n: number) => new Intl.NumberFormat("en-IN").format(n || 0);

// No hardcoded fallback documents — only real MongoDB data is served

// ==============================================================================
// 1. DASHBOARD & OVERVIEW
// ==============================================================================
router.get("/dashboard", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  try {
    const totalInstitutions = await Institution.countDocuments();
    const totalApplications = await Application.countDocuments();
    const pendingApplications = await Application.countDocuments({ status: { $in: ["SUBMITTED", "UNDER_REVIEW"] } });
    const verifiedApplications = await Application.countDocuments({ status: "APPROVED" });
    const rejectedApplications = await Application.countDocuments({ status: "REJECTED" });
    const pendingReleaseRequests = await ReleaseRequest.countDocuments({ status: { $in: ["PENDING", "SUBMITTED", "Pending"] } });

    // Calculate Alive FDRs from verified, active deposits
    const verifiedPayments = await Payment.find({ status: "VERIFIED", isActive: { $ne: false } });
    const aliveFdrsCount = verifiedPayments.length;
    const aliveTotalAmount = verifiedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    auditLog(req, "FD dashboard fetched");
    return res.json({
      totalInstitutions,
      totalApplications,
      pendingApplications,
      verifiedApplications,
      rejectedApplications,
      pendingReleaseRequests,
      aliveFdrsCount,
      aliveTotalAmount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch dashboard" });
  }
});

// List all institutions
router.get("/institutions", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const institutions = await Institution.find();
    auditLog(req, "FD listed institutions");
    return res.json(institutions);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to list institutions" });
  }
});

// Get institution details
router.get("/institution/:id", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const inst = await Institution.findById(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    auditLog(req, `FD fetched institution ${req.params.id}`);
    return res.json(inst);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error fetching institution" });
  }
});

// ==============================================================================
// 2. APPROVAL SEEKING APPLICATIONS
// ==============================================================================
router.get("/applications", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 });
      console.log('FD GET /applications - count:', apps.length);
    const institutions = await Institution.find();

    // Comprehensive institution map supporting collegeId, lowercase collegeId, name, and _id
    const instMap = new Map<string, any>();
    institutions.forEach(i => {
      if (i.collegeId) {
        instMap.set(i.collegeId, i);
        instMap.set(i.collegeId.toLowerCase().trim(), i);
      }
      if (i.name) {
        instMap.set(i.name, i);
        instMap.set(i.name.toLowerCase().trim(), i);
      }
      instMap.set(i._id.toString(), i);
    });

    // Load all DocumentVerifications for live status synchronization
    const allVerifications = await DocumentVerification.find();
    const verifMap = new Map<string, any>();
    allVerifications.forEach(v => {
      verifMap.set(`${v.applicationId.toString()}:${v.documentPath}`, v);
    });

    const result = apps.map(app => {
      const inst = instMap.get(app.collegeId) ||
                   instMap.get(String(app.collegeId || "").toLowerCase().trim()) ||
                   instMap.get(app._id.toString());

      const rawDocs = (app.categoryDocuments && app.categoryDocuments.length > 0)
        ? app.categoryDocuments
        : (app.documentItems && app.documentItems.length > 0)
          ? app.documentItems
          : (app.documents || []);

      let documents: any[] = [];
      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        documents = rawDocs.map((d: any, idx: number) => {
          const fileName = typeof d === "string"
            ? d
            : (d.fileName || d.documentPath || d.name || `doc_${idx + 1}`);

          // Match category from MANDATORY_DOCUMENTS
          const catId = typeof d === "object" ? (d.category || d.id) : null;
          let cat = catId ? MANDATORY_DOCUMENTS.find(c => c.id === catId || c.code === catId) : null;

          const v = verifMap.get(`${app._id.toString()}:${fileName}`) ||
                    allVerifications.find(item => item.applicationId.toString() === app._id.toString() && item.documentPath === fileName);

          if (!cat && v?.remarks && v.remarks.startsWith("Category:")) {
            const parsedCat = v.remarks.replace("Category:", "").trim();
            cat = MANDATORY_DOCUMENTS.find(c => c.id === parsedCat || c.code === parsedCat);
          }
          if (!cat && idx < MANDATORY_DOCUMENTS.length) {
            cat = MANDATORY_DOCUMENTS[idx];
          }

          const docCode = cat?.code || `DOC-${String(idx + 1).padStart(2, "0")}`;
          const docTitle = cat ? `${cat.code}: ${cat.name}` : (typeof d === "object" && d.name ? d.name : `Document ${idx + 1}`);

          // File stats from disk
          let formattedSize = typeof d === "object" && d.size ? d.size : "—";
          let fileType = "PDF";
          if (fileName) {
            const ext = path.extname(fileName).toLowerCase();
            if (ext === ".jpg" || ext === ".jpeg") fileType = "JPEG";
            else if (ext === ".png") fileType = "PNG";
            else if (ext === ".pdf") fileType = "PDF";

            try {
              const fullPath = path.join(UPLOAD_DIR, fileName);
              if (fs.existsSync(fullPath)) {
                formattedSize = formatBytes(fs.statSync(fullPath).size);
              }
            } catch {
              // ignore
            }
          }

          // Verification decision
          let status: "Verified" | "Not Verified" | "Pending" = "Pending";
          let remarks = "";
          if (d.status === "Verified" || d.status === "Not Verified") {
            status = d.status;
            remarks = d.remarks || "";
          } else if (v) {
            if (v.status === "VERIFIED" || v.verified === true) {
              status = "Verified";
            } else if (v.status === "NOT_VERIFIED" || (v.reviewed === true && !v.verified) || (!v.verified && v.remarks && !v.remarks.startsWith("Category:"))) {
              status = "Not Verified";
              remarks = v.remarks && !v.remarks.startsWith("Category:") ? v.remarks : "";
            } else {
              status = "Pending";
            }
          }

          return {
            id: d.id || `${app.applicationId}-DOC-${idx + 1}`,
            code: docCode,
            category: cat?.id || `category_${idx + 1}`,
            name: docTitle,
            categoryName: cat?.name || "Mandatory Document",
            fileName,
            originalName: (typeof d === "object" && d.originalName) ? d.originalName : fileName,
            fileUrl: `/api/institution/files/${fileName}`,
            previewUrl: `/api/institution/files/${fileName}`,
            type: fileType,
            size: formattedSize,
            uploadDate: (typeof d === "object" && d.uploadDate) ? d.uploadDate : (app.submissionDate || app.createdAt),
            status,
            remarks,
            verifiedBy: (typeof d === "object" && d.verifiedBy) ? d.verifiedBy : (v?.employeeId || null),
            verifiedAt: (typeof d === "object" && d.verifiedAt) ? d.verifiedAt : (v?.updatedAt || null),
          };
        });
      }

      return {
        _id: app._id,
        id: app.applicationId,
        refNumber: `AICTE/${inst?.collegeId || app.collegeId}/${app.applicationId}`,
        institutionId: inst?.collegeId || app.collegeId,
        collegeId: inst?.collegeId || app.collegeId,
        institutionName: inst?.name || app.collegeId,
        collegeName: inst?.name || app.collegeId,
        programme: app.programme || app.title || "Technical Programme",
        intake: app.intake || 60,
        applicationDate: app.submissionDate || app.createdAt,
        status: app.status,
        result: app.result || (app.status === "APPROVED" ? "LoA" : (app.status === "REJECTED" ? "LoD" : null)),
        letterGenerated: app.letterGenerated || app.status === "APPROVED" || app.status === "REJECTED",
        letterText: app.letterText || "",
        letterSent: Boolean(app.letterSent),
        letterSentDate: app.letterSentDate,
        depositDetails: app.depositDetails || null,
        depositDetailsSent: Boolean(app.depositDetailsSent),
        applicationType: app.applicationType || null,
        documents,
        institution: inst,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch applications" });
  }
});

// Update single document verification in Application
router.post("/application/:id/verify-document", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { docId, status, remarks } = req.body;
  if (!docId || !status) {
    return res.status(400).json({ message: "docId and status are required" });
  }
  if (status !== "Verified" && status !== "Not Verified") {
    return res.status(400).json({ message: "status must be 'Verified' or 'Not Verified'" });
  }
  if (status === "Not Verified" && (!remarks || !String(remarks).trim())) {
    return res.status(400).json({ message: "Deficiency remarks are mandatory when marking document as Not Verified" });
  }
  try {
    const app = await Application.findOne(idOrQuery(req.params.id, "applicationId"));
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Retrieve or populate full documents list
    let documents = app.documentItems || [];
    if ((!documents || documents.length === 0) && app.documents && app.documents.length > 0) {
      documents = app.documents.map((d: any, idx: number) => {
        const fileName = typeof d === "string" ? d : (d.fileName || d.name || `Document ${idx + 1}`);
        const cat = MANDATORY_DOCUMENTS[idx];
        return {
          id: `${app.applicationId}-DOC-${idx + 1}`,
          code: cat?.code || `DOC-${String(idx + 1).padStart(2, "0")}`,
          name: cat ? `${cat.code}: ${cat.name}` : fileName,
          fileName,
          type: "PDF",
          size: "1.2 MB",
          uploadDate: app.submissionDate || app.createdAt,
          status: "Pending",
          remarks: "",
        };
      });
    }

    let targetDoc: any = null;
    documents = documents.map((d: any) => {
      if (d.id === docId || d.fileName === docId || d.code === docId) {
        targetDoc = d;
        return {
          ...d,
          status,
          remarks: status === "Not Verified" ? String(remarks).trim() : "",
          verifiedBy: req.session.userId,
          verifiedAt: new Date(),
        };
      }
      return d;
    });

    if (!targetDoc) {
      return res.status(404).json({ message: "Document not found in application" });
    }

    app.documentItems = documents;
    await app.save();

    // Update or create DocumentVerification record in MongoDB
    try {
      const user = await User.findOne({ userId: req.session.userId });
      const empId = user ? user._id : (req.session as any).userObjectId;
      const docPath = targetDoc.fileName || targetDoc.documentPath || targetDoc.name;
      const isReject = status === "Not Verified";
      const newStatus = isReject ? "NOT_VERIFIED" : "VERIFIED";
      const cleanRemarks = isReject ? String(remarks).trim() : "";
      const now = new Date();

      // Find existing DocumentVerification for this document
      let docVerif = await DocumentVerification.findOne({
        applicationId: app._id,
        $or: [
          { documentId: targetDoc.id || docId },
          { documentPath: docPath },
          { documentPath: targetDoc.name },
          { documentPath: targetDoc.id },
          ...(targetDoc.code ? [{ category: targetDoc.code }] : []),
          ...(targetDoc.category ? [{ category: targetDoc.category }] : []),
        ],
      });

      if (docVerif) {
        // If there was an existing decision or remark that is now changing, preserve in history
        if (docVerif.status !== newStatus || (docVerif.remarks && docVerif.remarks !== cleanRemarks)) {
          if (!docVerif.history) docVerif.history = [];
          docVerif.history.push({
            decision: docVerif.status || (docVerif.verified ? "VERIFIED" : "NOT_VERIFIED"),
            status: docVerif.status || (docVerif.verified ? "VERIFIED" : "NOT_VERIFIED"),
            remarks: docVerif.remarks || "",
            employeeId: docVerif.employeeId,
            employeeUserId: docVerif.employeeUserId,
            date: docVerif.decisionDate || docVerif.updatedAt || new Date(),
            documentPath: docVerif.documentPath,
            documentName: docVerif.documentName || targetDoc.name,
          });
        }
        docVerif.institutionId = app.collegeId;
        docVerif.collegeId = app.collegeId;
        docVerif.applicationRef = app.applicationId;
        docVerif.documentId = targetDoc.id || docId;
        docVerif.documentName = targetDoc.name || targetDoc.fileName || targetDoc.category;
        docVerif.documentPath = docPath;
        docVerif.verified = !isReject;
        docVerif.status = newStatus;
        docVerif.reviewed = true;
        docVerif.remarks = cleanRemarks;
        docVerif.employeeId = empId;
        docVerif.employeeUserId = req.session.userId;
        docVerif.decisionDate = now;
        await docVerif.save();
      } else {
        docVerif = await DocumentVerification.create({
          applicationId: app._id,
          institutionId: app.collegeId,
          collegeId: app.collegeId,
          applicationRef: app.applicationId,
          documentId: targetDoc.id || docId,
          documentName: targetDoc.name || targetDoc.fileName || targetDoc.category,
          documentPath: docPath,
          originalName: targetDoc.originalName || targetDoc.fileName,
          category: targetDoc.category || targetDoc.code,
          verified: !isReject,
          status: newStatus,
          reviewed: true,
          remarks: cleanRemarks,
          employeeId: empId,
          employeeUserId: req.session.userId,
          decisionDate: now,
          history: [],
        });
      }

      // Create persistent institution notification
      if (isReject) {
        // Check if an unchanged notification already exists for this document & remark
        const existingNotif = await Notification.findOne({
          collegeId: app.collegeId,
          type: "DOCUMENT_NOT_VERIFIED",
          "metadata.docId": targetDoc.id || docId,
          "metadata.remarks": cleanRemarks,
        });

        if (!existingNotif) {
          await Notification.create({
            collegeId: app.collegeId,
            applicationId: app.applicationId,
            title: "Document Verification Deficiency",
            message: `Your submitted document ${targetDoc.name || targetDoc.fileName || "Submitted Document"} requires attention. Please review the FD employee's remarks.`,
            type: "DOCUMENT_NOT_VERIFIED",
            link: "/institution/receive/complaint-letters",
            isRead: false,
            metadata: {
              docId: targetDoc.id || docId,
              docName: targetDoc.name || targetDoc.fileName,
              status: "NOT_VERIFIED",
              remarks: cleanRemarks,
              decisionDate: now,
            },
          });
        }
      } else {
        await Notification.create({
          collegeId: app.collegeId,
          applicationId: app.applicationId,
          title: "Document Verified",
          message: `Document "${targetDoc.name}" for application ${app.applicationId} has been verified.`,
          type: "DOCUMENT_VERIFIED",
          link: "/institution/receive/complaint-letters",
          isRead: false,
          metadata: { docId: targetDoc.id || docId, docName: targetDoc.name, status: "VERIFIED" },
        });
      }
    } catch (dErr) {
      console.warn("DocumentVerification / Notification record error:", dErr);
    }

    auditLog(req, `FD verified document ${docId} on app ${app.applicationId} -> ${status} by ${req.session.userId}`);
    return res.json({ message: `Document status updated to ${status}`, documents, application: app });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update document verification" });
  }
});

// Secure FD preview/serving alias endpoint
router.get("/files/:filename", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename));
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }
  return res.sendFile(filePath);
});

// Generate LoA / EoA / LoD / EoD for application
router.post("/application/:id/generate-letter", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { type, letterText } = req.body; // type: "LoA" | "EoA" | "LoD" | "EoD"
  if (!type || !["LoA", "EoA", "LoD", "EoD"].includes(type)) {
    return res.status(400).json({ message: "type must be LoA, EoA, LoD, or EoD" });
  }
  try {
    const app = await Application.findOne(idOrQuery(req.params.id, "applicationId"));
    if (!app) return res.status(404).json({ message: "Application not found" });

    // Letter Type Validation:
    // - LOA application -> Generate LoA (or deficiency LoD)
    // - EOA application -> Generate EoA (or deficiency EoD)
    // - Unknown historical application type -> Require authorized clarification before generating either letter
    const appType = app.applicationType ? String(app.applicationType).toUpperCase() : null;

    if (!appType) {
      return res.status(400).json({
        message: "Cannot generate decision letter: This application has an unspecified/unknown application type. Authorized clarification of application type (LoA vs EoA) is required before generating a letter."
      });
    }

    if (appType === "LOA" && (type === "EoA" || type === "EoD")) {
      return res.status(400).json({
        message: `Validation Error: This application was submitted as Letter of Approval (LoA). You cannot generate an Extension of Approval (${type}) letter for an LoA application.`
      });
    }

    if (appType === "EOA" && (type === "LoA" || type === "LoD")) {
      return res.status(400).json({
        message: `Validation Error: This application was submitted as Extension of Approval (EoA). You cannot generate a Letter of Approval (${type}) letter for an EoA application.`
      });
    }

    const inst = await Institution.findOne({ collegeId: app.collegeId });
    const docs = app.documentItems || [];

    if (!docs || docs.length === 0) {
      return res.status(400).json({ message: "No documents submitted for this application." });
    }

    // Condition for Approval letters (LoA / EoA): All mandatory documents must be Verified
    if (type === "LoA" || type === "EoA") {
      const unverified = docs.filter((d: any) => d.status !== "Verified");
      if (unverified.length > 0) {
        return res.status(400).json({
          message: `Cannot generate ${type}. All mandatory submitted documents must be verified first. (${unverified.length} pending or unverified documents remain)`
        });
      }
    }

    // Condition for Deficiency letters (LoD / EoD):
    // All documents must have been reviewed, and at least one must be Not Verified with remarks
    let notVerifiedDocs: any[] = [];
    if (type === "LoD" || type === "EoD") {
      const pendingDocs = docs.filter((d: any) => d.status === "Pending");
      if (pendingDocs.length > 0) {
        return res.status(400).json({
          message: `Cannot generate ${type} while documents are still pending review. Please review all documents first.`
        });
      }
      notVerifiedDocs = docs.filter((d: any) => d.status === "Not Verified");
      if (notVerifiedDocs.length === 0) {
        return res.status(400).json({
          message: `Cannot generate ${type} because all documents are verified. Approval letter should be generated instead.`
        });
      }
      const missingRemarks = notVerifiedDocs.filter((d: any) => !d.remarks || !d.remarks.trim());
      if (missingRemarks.length > 0) {
        return res.status(400).json({
          message: "All Not Verified documents must include deficiency remarks before generating deficiency letter."
        });
      }
    }

    const refNumber = app.letterReferenceNumber || `AICTE/AB/2026-27/${app.collegeId}/${app.applicationId}`;
    const currentDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

    let defaultLetterText = "";
    if (type === "LoA" || type === "EoA") {
      const letterTitle = type === "LoA" ? "LETTER OF APPROVAL (LoA)" : "EXTENSION OF APPROVAL (EoA)";
      defaultLetterText = `================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
(A STATUTORY BODY OF THE GOVERNMENT OF INDIA)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
Website: www.aicte-india.org
================================================================================
[PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]

Letter Ref. No.: ${refNumber}
Date of Issue: ${currentDate}

To,
The Principal / Director,
${inst?.name || "Institution Name"},
College ID: ${app.collegeId}
Address: ${inst?.address || "Address on Record"}, ${inst?.district || ""}, ${inst?.state || ""}

Subject: Grant of ${letterTitle} for Academic Year 2026-2027

Sir / Madam,

In terms of the provisions under the All India Council for Technical Education (Grant of Approvals for Technical Institutions) Regulations, and based on the comprehensive verification of all mandatory documents submitted by the institution, I am directed to convey the official approval of the Council to:

  • Institution Name    : ${inst?.name || app.collegeId}
  • Permanent ID        : ${app.collegeId}
  • Application ID      : ${app.applicationId}
  • Category / Title    : ${app.title || "Technical Education"}
  • Programme           : ${app.programme || "Engineering and Technology"}
  • Approved Intake     : ${app.intake || 60} Seats
  • Academic Year       : 2026-2027

TERMS AND CONDITIONS OF APPROVAL:
1. The institution shall strictly adhere to the norms and standards prescribed by AICTE from time to time.
2. The approval is subject to condition that the institution shall maintain mandatory Joint Fixed Deposit Receipt (FDR) / Endowment deposits as specified by the Finance Division.
3. The Finance Division will issue specific Deposit Instructions detailing required deposit amount and bank account details.
4. No excess admission shall be made by the institution over and above the approved intake under any circumstances.
5. In case of any violation, AICTE reserves the right to withdraw the approval as per regulations.

[PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]

Yours faithfully,
Competent Authority / Section Officer
Finance Division (FD) & Approval Bureau
All India Council for Technical Education`;
    } else {
      const letterTitle = type === "LoD" ? "LETTER OF DEFICIENCY (LoD)" : "EXTENSION DEFICIENCY NOTICE (EoD)";
      const deficiencyList = notVerifiedDocs.map((d, i) =>
        `  ${i + 1}. Document: ${d.name} (${d.type || "PDF"})\n     Deficiency Remark: ${d.remarks}`
      ).join("\n\n");

      defaultLetterText = `================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
(A STATUTORY BODY OF THE GOVERNMENT OF INDIA)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
Website: www.aicte-india.org
================================================================================
[PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]

Letter Ref. No.: ${refNumber}
Date of Issue: ${currentDate}

To,
The Principal / Director,
${inst?.name || "Institution Name"},
College ID: ${app.collegeId}
Address: ${inst?.address || "Address on Record"}, ${inst?.district || ""}, ${inst?.state || ""}

Subject: ${letterTitle} — Mandatory Document Deficiencies Identified

Sir / Madam,

With reference to Application ID ${app.applicationId} submitted by your institution for ${app.programme || app.title}, this is to convey that upon detailed scrutiny by the Finance Division, deficiencies were observed in the submitted documentation.

DOCUMENT-LEVEL DEFICIENCIES NOTED:
${deficiencyList}

ACTION REQUIRED:
1. The institution is advised to rectify the aforementioned deficiencies immediately.
2. Fresh compliance documentation must be prepared and submitted through the portal.
3. Failure to rectify deficiencies within the stipulated time may lead to final rejection of the application.

[PROTOTYPE GENERATED DOCUMENT — FOR DEMONSTRATION PURPOSES ONLY — NOT AN OFFICIAL AICTE ISSUANCE]

Yours faithfully,
Competent Authority / Section Officer
Finance Division (FD) & Approval Bureau
All India Council for Technical Education`;
    }

    const finalLetterText = letterText || defaultLetterText;

    app.result = type as any;
    app.letterType = type as any;
    app.letterGenerated = true;
    app.letterText = finalLetterText;
    app.letterReferenceNumber = refNumber;
    if (notVerifiedDocs.length > 0) {
      app.deficiencyRemarks = notVerifiedDocs.map((d: any) => ({
        docId: d.id,
        docName: d.name,
        remarks: d.remarks,
      }));
    }
    app.type = app.type || "Technical Education";
    app.description = app.description || "AICTE Approval Application";
    await app.save();

    auditLog(req, `FD generated ${type} (Ref: ${refNumber}) for app ${app.applicationId}`);
    return res.json({ message: `${type} generated successfully`, application: app });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate decision letter" });
  }
});

// Send decision letter to institution
router.post("/application/:id/send-letter", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const app = await Application.findOne(idOrQuery(req.params.id, "applicationId"));
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (!app.letterGenerated || !app.result) {
      return res.status(400).json({ message: "Generate the letter first before sending." });
    }

    if (app.letterSent) {
      return res.status(400).json({ message: "Letter already dispatched. Duplicate sending prevented." });
    }

    app.letterSent = true;
    app.letterSentDate = new Date();
    app.status = (app.result === "LoA" || app.result === "EoA") ? "APPROVED" : "REJECTED";
    app.type = app.type || "Technical Education";
    app.description = app.description || "AICTE Approval Application";
    await app.save();

    // Create persistent notification for the institution
    try {
      const isApproval = app.result === "LoA" || app.result === "EoA";
      await Notification.create({
        collegeId: app.collegeId,
        applicationId: app.applicationId,
        title: `${app.result} Issued: ${app.programme || app.title}`,
        message: isApproval
          ? `Official ${app.result} (Ref: ${app.letterReferenceNumber || app.applicationId}) has been issued by AICTE. You can now view and download your approval letter under Receive > LoA/EoA.`
          : `Deficiency letter ${app.result} (Ref: ${app.letterReferenceNumber || app.applicationId}) has been issued. Please review deficiency remarks under Receive > LoD/EoD.`,
        type: app.result === "LoA" ? "LOA_ISSUED" : (app.result === "EoA" ? "EOA_ISSUED" : (app.result === "LoD" ? "LOD_ISSUED" : "EOD_ISSUED")),
        link: isApproval ? "/institution/receive/loa-eoa" : "/institution/receive/lod-eod",
        metadata: {
          letterReferenceNumber: app.letterReferenceNumber,
          result: app.result,
          issueDate: app.letterSentDate,
        },
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr);
    }

    auditLog(req, `FD sent ${app.result} letter for app ${app.applicationId}`);
    return res.json({ message: `Official ${app.result} letter dispatched to institution.`, application: app });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to dispatch letter" });
  }
});

// GET /api/fd/application/:id/letter-pdf - download decision letter directly as PDF
router.get(
  "/application/:id/letter-pdf",
  requireAuth,
  requireRole("AICTE_FD_EMPLOYEE"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const app = await Application.findOne(idOrQuery(id, "applicationId"));
      if (!app) {
        return res.status(404).json({ message: "Application record not found." });
      }

      if (!app.letterGenerated && !app.letterSent && !app.letterText) {
        return res.status(404).json({ message: "No decision letter has been generated for this application yet." });
      }

      const inst = await Institution.findOne({ collegeId: app.collegeId });
      const isLoA = app.result === "LoA" || app.result === "LOA";
      const isEoA = app.result === "EoA" || app.result === "EOA";
      const isLoD = app.result === "LoD" || app.result === "LOD";
      const letterType = isLoA ? "LoA" : isEoA ? "EoA" : isLoD ? "LoD" : "EoD";
      const filename = `${letterType}_Letter_${app.applicationId}.pdf`;

      const pdfBuffer = await generateApprovalLetterPdf({
        application: app,
        institution: inst,
        letterTitle: isLoA
          ? "LETTER OF APPROVAL (LoA)"
          : isEoA
          ? "EXTENSION OF APPROVAL (EoA)"
          : isLoD
          ? "LETTER OF DEFICIENCY (LoD)"
          : "EXTENSION DEFICIENCY NOTICE (EoD)",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("FD application letter PDF error:", err);
      return res.status(500).json({ message: "Failed to generate letter PDF" });
    }
  }
);

// Submit and send Deposit Details (Post-LoA / Post-EoA) — 3 Manual Input Fields: Amount, Account No, Deadline
router.post("/application/:id/deposit-details", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { bankAccountNumber, depositAmount, depositDeadline, bankName, branchName, ifscCode, paymentInstructions } = req.body;
  const parsedAmount = Number(depositAmount);

  if (!depositAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Deposit Amount must be a positive monetary number (INR)." });
  }
  if (!bankAccountNumber || !String(bankAccountNumber).trim()) {
    return res.status(400).json({ message: "AICTE Bank Account Number is required." });
  }
  if (!depositDeadline) {
    return res.status(400).json({ message: "Last Date for Deposit (deadline) is required." });
  }
  const deadlineDate = new Date(depositDeadline);
  if (isNaN(deadlineDate.getTime())) {
    return res.status(400).json({ message: "Invalid deposit deadline date format." });
  }

  try {
    const app = await Application.findOne(idOrQuery(req.params.id, "applicationId"));
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (!app.letterSent || (app.result !== "LoA" && app.result !== "EoA")) {
      return res.status(400).json({ message: "Deposit details can only be issued after official LoA/EoA is sent." });
    }

    const prevDetails = app.depositDetails;
    const currentVersion = (prevDetails?.version || 0) + 1;
    const history = Array.isArray(prevDetails?.history) ? [...prevDetails.history] : [];
    if (prevDetails && prevDetails.depositAmount) {
      history.push({
        depositAmount: prevDetails.depositAmount,
        bankAccountNumber: prevDetails.bankAccountNumber,
        depositDeadline: prevDetails.depositDeadline,
        bankName: prevDetails.bankName,
        branchName: prevDetails.branchName,
        ifscCode: prevDetails.ifscCode,
        paymentInstructions: prevDetails.paymentInstructions,
        sentBy: prevDetails.sentBy,
        sentAt: prevDetails.sentAt,
        version: prevDetails.version,
      });
    }

    const newDepositDetails = {
      bankAccountNumber: String(bankAccountNumber).trim(),
      depositAmount: parsedAmount,
      depositDeadline: deadlineDate,
      bankName: bankName ? String(bankName).trim() : (prevDetails?.bankName || "State Bank of India"),
      branchName: branchName ? String(branchName).trim() : (prevDetails?.branchName || "AICTE Headquarters Branch"),
      ifscCode: ifscCode ? String(ifscCode).trim() : (prevDetails?.ifscCode || "SBIN0000691"),
      paymentInstructions: paymentInstructions ? String(paymentInstructions).trim() : (prevDetails?.paymentInstructions || "Deposit the required amount into the designated AICTE joint account before the deadline."),
      sentBy: req.session.userId,
      sentAt: new Date(),
      version: currentVersion,
      status: "Active",
      applicationId: app.applicationId,
      collegeId: app.collegeId,
      letterReferenceNumber: app.letterReferenceNumber || `AICTE/AB/2026-27/${app.collegeId}/${app.applicationId}`,
      history,
    };

    app.depositDetails = newDepositDetails;
    app.depositDetailsSent = true;
    app.type = app.type || "Technical Education";
    app.description = app.description || "AICTE Approval Application";
    await app.save();

    // Create persistent notification for the institution
    try {
      await Notification.create({
        collegeId: app.collegeId,
        applicationId: app.applicationId,
        title: currentVersion === 1 ? "Deposit Instructions Received" : "Deposit Instructions Updated",
        message: `AICTE Finance Division has ${currentVersion === 1 ? "issued" : "updated"} deposit instructions for application ${app.applicationId}. Amount: ₹${fmt(parsedAmount)}, AICTE Account: ${String(bankAccountNumber).trim()}, Last Date: ${deadlineDate.toLocaleDateString("en-IN")}.`,
        type: currentVersion === 1 ? "DEPOSIT_INSTRUCTIONS" : "DEPOSIT_UPDATED",
        link: "/institution/receive/deposit",
        metadata: {
          version: currentVersion,
          depositAmount: parsedAmount,
          bankAccountNumber: String(bankAccountNumber).trim(),
          depositDeadline: deadlineDate,
        },
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr);
    }

    auditLog(req, `FD sent deposit details (v${currentVersion}) for app ${app.applicationId} by ${req.session.userId}`);
    return res.json({
      message: currentVersion === 1 ? "Deposit details saved and dispatched to institution." : "Deposit details successfully updated.",
      depositDetails: newDepositDetails,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to save deposit details" });
  }
});

// ==============================================================================
// 3. DEPOSIT RECORDS & FDR VERIFICATION
// ==============================================================================
router.get("/deposits", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    const institutions = await Institution.find();
    const instMap = new Map(institutions.map(i => [i.collegeId, i]));

    const result = payments.map(p => {
      const inst = instMap.get(p.collegeId);
      // Only real documents submitted by institution — no fake fallbacks
      let documents = p.documents || [];
      if (p.receiptPath && documents.length === 0) {
        // Institution uploaded a receipt file — expose it as a single document
        const ext = path.extname(p.receiptPath).replace(".", "").toUpperCase() || "PDF";
        documents = [{
          id: `${p.paymentId || 'FDR'}-FDOC-1`,
          name: "Fixed Deposit Receipt",
          fileName: path.basename(p.receiptPath),
          file: p.receiptPath,
          url: `/api/fd/files/${path.basename(p.receiptPath)}`,
          fileUrl: `/api/fd/files/${path.basename(p.receiptPath)}`,
          previewUrl: `/api/fd/files/${path.basename(p.receiptPath)}`,
          type: ext,
          size: "—",
          uploadDate: p.paymentDate || p.createdAt,
          status: p.status === "VERIFIED" ? "Verified" : (p.status === "REJECTED" ? "Not Verified" : "Pending"),
          remarks: p.remarks || "",
        }];
      } else {
        documents = documents.map((d: any) => {
          const fileName = d.fileName || d.file || (d.url ? path.basename(d.url) : "");
          return {
            ...d,
            fileName,
            fileUrl: fileName ? `/api/fd/files/${fileName}` : "",
            previewUrl: fileName ? `/api/fd/files/${fileName}` : "",
          };
        });
      }

      return {
        _id: p._id,
        id: p.paymentId,
        institutionId: p.collegeId,
        collegeId: p.collegeId,
        collegeName: inst?.name || p.collegeId,
        fdrNumber: p.referenceNumber,
        fdrReference: p.referenceNumber,
        amount: p.amount,
        depositAmount: p.amount,
        bankName: p.bankName || "—",
        branchName: p.branchName || "—",
        ifscCode: p.ifscCode || "—",
        depositDate: p.paymentDate || p.createdAt,
        maturityDate: p.maturityDate || null,
        bankEmployeeName: p.bankEmployeeName || "—",
        bankEmployeeId: p.bankEmployeeId || "—",
        bankEmployeeDesignation: p.bankEmployeeDesignation || "—",
        bankEmployeeContact: p.bankEmployeeContact || "—",
        status: p.status === "VERIFIED" ? "Verified" : (p.status === "REJECTED" ? "Not Verified" : "Pending"),
        isActive: p.isActive !== false,
        remarks: p.remarks || "",
        documents,
        receiptPath: p.receiptPath || "",
      };
    });

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch deposit records" });
  }
});

// Update document verification on Deposit Record
router.post("/deposit/:id/verify-document", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { docId, status, remarks } = req.body;
  if (!docId || !status) {
    return res.status(400).json({ message: "docId and status are required" });
  }
  try {
    const payment = await Payment.findOne(idOrQuery(req.params.id, "paymentId"));
    if (!payment) return res.status(404).json({ message: "Payment deposit record not found" });

    let documents = payment.documents || [];
    documents = documents.map((d: any) =>
      d.id === docId ? { ...d, status, remarks: remarks || "" } : d
    );

    const allVerified = documents.every((d: any) => d.status === "Verified");
    const anyRejected = documents.some((d: any) => d.status === "Not Verified");

    payment.documents = documents;
    if (allVerified) {
      payment.status = "VERIFIED";
      payment.isActive = true;
    } else if (anyRejected) {
      payment.status = "REJECTED";
      payment.remarks = remarks || payment.remarks;
    } else {
      payment.status = "PENDING_VERIFICATION";
    }

    await payment.save();

    // Reverse notification for the institution
    try {
      const targetDoc = documents.find((d: any) => d.id === docId);
      const docName = targetDoc?.name || "Deposit Document";
      await Notification.create({
        collegeId: payment.collegeId,
        applicationId: payment.paymentId,
        title: status === "Verified" ? "Deposit Document Verified" : "Deposit Document Deficiency Noted",
        message:
          status === "Verified"
            ? `Your FDR deposit document "${docName}" (FDR Ref: ${payment.referenceNumber}) has been verified by the Finance Division.`
            : `Deficiency noted on your deposit document "${docName}" (FDR Ref: ${payment.referenceNumber}): ${remarks || "Please review remarks and re-upload."}`,
        type: status === "Verified" ? "DEPOSIT_DOCUMENT_VERIFIED" : "DEPOSIT_DOCUMENT_DEFICIENT",
        link: "/institution/receive/deposit",
        isRead: false,
        read: false,
        metadata: {
          paymentId: payment.paymentId,
          fdrReference: payment.referenceNumber,
          docId,
          docName,
          status,
          remarks: remarks || "",
        },
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr);
    }

    auditLog(req, `FD verified deposit doc ${docId} on payment ${payment.paymentId} -> ${status}`);
    return res.json({ message: "Deposit document status updated", payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to update deposit document" });
  }
});

// Send Verification Letter for verified deposit document
router.post("/deposit/:id/send-verification-letter", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { docId } = req.body;
  if (!docId) return res.status(400).json({ message: "docId is required" });

  try {
    const payment = await Payment.findOne(idOrQuery(req.params.id, "paymentId"));
    if (!payment) return res.status(404).json({ message: "Deposit record not found" });

    let documents = payment.documents || [];
    const doc = documents.find((d: any) => d.id === docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    if (doc.status !== "Verified") {
      return res.status(400).json({ message: "Action Denied: Only verified documents qualify for a verification letter." });
    }
    if (doc.verificationLetterSent || doc.verificationLetter) {
      return res.status(400).json({ message: "Verification letter already sent. Duplicate sending prevented." });
    }

    const inst = await Institution.findOne({ collegeId: payment.collegeId });
    const collegeName = inst?.name || payment.collegeId;
    const now = new Date();
    const letterRef = `AICTE/FDR-VERIF/${payment.referenceNumber}/${doc.id}`;

    const letterContent = `================================================================================\nALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)\nNelson Mandela Marg, Vasant Kunj, New Delhi - 110070\nFINANCE & FIXED DEPOSIT RECEIPT (FDR) DIVISION\n================================================================================\n\nLETTER OF DEPOSIT DOCUMENT VERIFICATION\nRef No.   : ${letterRef}\nDate      : ${now.toLocaleDateString("en-IN")}\n\nTo,\nThe Principal / Director,\n${collegeName}\nInstitution ID: ${payment.collegeId}\n\nSUBJECT: OFFICIAL CONFIRMATION OF FIXED DEPOSIT (FDR) DOCUMENT VERIFICATION\n\nDear Sir / Madam,\n\nThis is to certify that the deposit document submitted by ${collegeName} in accordance with AICTE statutory approval requirements has been scrutinized and successfully VERIFIED by the competent authority.\n\nVERIFICATION DETAILS:\n--------------------------------------------------------------------------------\n1. College Name            : ${collegeName}\n2. Institution Reference   : ${payment.collegeId}\n3. FDR Reference Number    : ${payment.referenceNumber}\n4. Deposit Amount          : ₹${fmt(payment.amount)}\n5. Document Title          : ${doc.name}\n6. Document Identification : ${doc.id}\n7. Verification Date       : ${now.toLocaleDateString("en-IN")}\n8. Verification Status     : VERIFIED & CONFIRMED\n\nVERIFICATION CONFIRMATION:\nThe All India Council for Technical Education confirms that the fixed deposit receipt and associated bank documents have met all prescribed validation criteria, including statutory lien markings and account particulars.\n\nThis letter stands recorded as formal proof of verification in the official AICTE FDR Registry.\n\nYours faithfully,\n\nMember Secretary / Section Officer\nFixed Deposit Division\nAll India Council for Technical Education (AICTE)\n================================================================================`;

    const letterRecord = {
      id: `VERIF-LTR-${doc.id}-${now.getTime()}`,
      letterRef,
      collegeName,
      institutionId: payment.collegeId,
      fdrReference: payment.referenceNumber,
      documentId: doc.id,
      documentName: doc.name,
      depositAmount: payment.amount,
      verificationDate: now.toLocaleDateString("en-IN"),
      generationDate: now.toISOString(),
      sendingDate: now.toISOString(),
      deliveryStatus: "Sent",
      content: letterContent,
    };

    documents = documents.map((d: any) =>
      d.id === doc.id
        ? {
            ...d,
            verificationLetterSent: true,
            verificationLetterDate: now.toISOString(),
            verificationLetter: letterRecord,
          }
        : d
    );

    payment.documents = documents;
    await payment.save();

    // Reverse notification for the institution
    try {
      await Notification.create({
        collegeId: payment.collegeId,
        applicationId: payment.paymentId,
        title: `Deposit Verification Letter Issued: FDR Ref ${payment.referenceNumber}`,
        message: `Official Letter of Deposit Document Verification has been issued for document "${doc.name}" (FDR Ref: ${payment.referenceNumber}).`,
        type: "DEPOSIT_VERIFICATION_LETTER",
        link: "/institution/receive/deposit",
        isRead: false,
        read: false,
        metadata: {
          paymentId: payment.paymentId,
          fdrReference: payment.referenceNumber,
          letterRef,
          documentId: doc.id,
        },
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr);
    }

    auditLog(req, `FD sent verification letter for doc ${doc.id}`);
    return res.json({ message: "Verification letter generated and sent successfully", letterRecord });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to send verification letter" });
  }
});

// ==============================================================================
// 4. ALIVE RECORDS
// ==============================================================================
router.get("/alive-records", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    // Only verified, active FDRs
    const alivePayments = await Payment.find({
      status: "VERIFIED",
      isActive: { $ne: false },
    }).sort({ createdAt: -1 });

    const institutions = await Institution.find();
    const instMap = new Map(institutions.map(i => [i.collegeId, i]));

    const aliveFdrs = alivePayments.map(p => {
      const inst = instMap.get(p.collegeId);
      return {
        id: p.paymentId,
        institutionId: p.collegeId,
        collegeName: inst?.name || p.collegeId,
        fdrNumber: p.referenceNumber,
        bankName: p.bankName || "State Bank of India",
        branchName: p.branchName || "Main Branch",
        amount: p.amount,
        depositDate: p.paymentDate || p.createdAt,
        maturityDate: p.maturityDate || new Date(Date.now() + 365 * 24 * 3600 * 1000),
        status: "Verified",
        isActive: true,
      };
    });

    const aliveTotalAmount = aliveFdrs.reduce((sum, f) => sum + (f.amount || 0), 0);

    return res.json({
      aliveFdrs,
      aliveCount: aliveFdrs.length,
      aliveTotalAmount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch alive records" });
  }
});

// Helper to format documents for release requests (4 Mandatory Documents)
function getReleaseDocuments(r: any) {
  if (Array.isArray(r.documentItems) && r.documentItems.length > 0) {
    return r.documentItems;
  }
  const defaultNames = ["EoA", "Affidavit", "Release Approval Letter", "FDR Copy"];
  const docFiles = Array.isArray(r.documents) ? r.documents : [];
  return defaultNames.map((name, idx) => ({
    id: `doc-${idx + 1}`,
    name,
    type: "PDF",
    size: "1.2 MB",
    uploadDate: r.submissionDate || r.createdAt,
    status: "Pending",
    file: docFiles[idx] || `${name.toLowerCase().replace(/\s+/g, "_")}.pdf`,
    remarks: "",
  }));
}

// ==============================================================================
// 5. RELEASE APPLICATIONS & AUTOMATED PGRC / VIGILANCE CLEARANCE
// ==============================================================================

// Fetch all release applications with live calculated PGRC & Vigilance clearance
router.get("/release-applications", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const releases = await ReleaseRequest.find().sort({ createdAt: -1 });

    const result = await Promise.all(
      releases.map(async (r) => {
        const identifiers = await resolveInstitutionIdentifiers(r);
        const inst = identifiers.institutionDoc;
        if (inst && !r.institutionId) {
          r.institutionId = inst._id.toString();
        }
        const documents = getReleaseDocuments(r);

        // Real-time automatic clearance calculation from MongoDB
        let pgrcClearance;
        let vigilanceClearance;
        try {
          pgrcClearance = await calculatePgrcClearance(r);
        } catch (pErr) {
          pgrcClearance = {
            status: "ERROR" as const,
            reason: "Unable to Fetch Clearance",
            department: "PGRC" as const,
            count: 0,
            calculatedAt: new Date(),
          };
        }

        try {
          vigilanceClearance = await calculateVigilanceClearance(r);
        } catch (vErr) {
          vigilanceClearance = {
            status: "ERROR" as const,
            reason: "Unable to Fetch Clearance",
            department: "Vigilance" as const,
            count: 0,
            calculatedAt: new Date(),
          };
        }

        const overallDecision = calculateOverallReleaseDecision(
          documents,
          pgrcClearance.status,
          vigilanceClearance.status,
          pgrcClearance.reason,
          vigilanceClearance.reason
        );

        // Update snapshot in ReleaseRequest
        r.pgrcClearanceSnapshot = pgrcClearance as any;
        r.vigilanceClearanceSnapshot = vigilanceClearance as any;
        r.overallReleaseStatus = overallDecision.overallStatus;
        r.pgrcStatus = pgrcClearance.status;
        r.violenceStatus = vigilanceClearance.status;
        try {
          await r.save();
        } catch (saveErr) {
          // Log but do not block endpoint response
          console.warn("ReleaseRequest snapshot save warning:", r.releaseRequestId, saveErr);
        }

        return {
          _id: r._id,
          id: r.releaseRequestId,
          applicationId: r.releaseRequestId,
          institutionId: r.institutionId || r.collegeId,
          collegeId: inst?.collegeId || r.collegeId,
          collegeName: inst?.name || r.collegeName || r.collegeId,
          fdrId: r.fdrReference,
          requestDate: r.submissionDate || r.createdAt,
          reason: r.reason,
          status:
            r.status === "APPROVED" || r.status === "Approved"
              ? "Approved"
              : r.status === "REJECTED" || r.status === "Declined"
              ? "Declined"
              : "Pending",
          documents,
          declineRemarks: r.declineRemarks || "",
          institution: inst,
          pgrcClearance,
          vigilanceClearance,
          overallDecision,
          overallReleaseStatus: overallDecision.overallStatus,
          isEligibleForApproval: overallDecision.isEligibleForApproval,
        };
      })
    );

    return res.json(result);
  } catch (err) {
    console.error("Fetch release applications error:", err);
    return res.status(500).json({ message: "Failed to fetch release applications" });
  }
});

// Fetch single release application clearance
router.get("/release/:id/clearance", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const rr = await ReleaseRequest.findOne(idOrQuery(req.params.id, "releaseRequestId"));
    if (!rr) return res.status(404).json({ message: "Release request not found" });

    const identifiers = await resolveInstitutionIdentifiers(rr);
    const inst = identifiers.institutionDoc;
    if (inst && !rr.institutionId) {
      rr.institutionId = inst._id.toString();
    }
    const documents = getReleaseDocuments(rr);

    const pgrcClearance = await calculatePgrcClearance(rr);
    const vigilanceClearance = await calculateVigilanceClearance(rr);
    const overallDecision = calculateOverallReleaseDecision(
      documents,
      pgrcClearance.status,
      vigilanceClearance.status,
      pgrcClearance.reason,
      vigilanceClearance.reason
    );

    return res.json({
      pgrcClearance,
      vigilanceClearance,
      overallDecision,
    });
  } catch (err) {
    console.error("Release clearance error:", err);
    return res.status(500).json({
      error: "Unable to Fetch Clearance",
      message: "Database lookup failed while computing clearance.",
    });
  }
});

// Refresh clearance button endpoint (Recalculates from backend without altering outcomes)
router.post("/release/:id/refresh-clearance", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const rr = await ReleaseRequest.findOne(idOrQuery(req.params.id, "releaseRequestId"));
    if (!rr) return res.status(404).json({ message: "Release request not found" });

    const identifiers = await resolveInstitutionIdentifiers(rr);
    const inst = identifiers.institutionDoc;
    if (inst && !rr.institutionId) {
      rr.institutionId = inst._id.toString();
    }
    const documents = getReleaseDocuments(rr);

    const pgrcClearance = await calculatePgrcClearance(rr);
    const vigilanceClearance = await calculateVigilanceClearance(rr);
    const overallDecision = calculateOverallReleaseDecision(
      documents,
      pgrcClearance.status,
      vigilanceClearance.status,
      pgrcClearance.reason,
      vigilanceClearance.reason
    );

    rr.pgrcClearanceSnapshot = pgrcClearance as any;
    rr.vigilanceClearanceSnapshot = vigilanceClearance as any;
    rr.overallReleaseStatus = overallDecision.overallStatus;
    rr.pgrcStatus = pgrcClearance.status;
    rr.violenceStatus = vigilanceClearance.status;
    await rr.save();

    auditLog(req, `FD refreshed clearance for release ${rr.releaseRequestId}`);
    return res.json({
      message: "Clearance recalculated successfully from real database records.",
      pgrcClearance,
      vigilanceClearance,
      overallDecision,
    });
  } catch (err) {
    console.error("Refresh clearance error:", err);
    return res.status(500).json({
      error: "Unable to Fetch Clearance",
      message: "Failed to recalculate clearance.",
    });
  }
});

// Update single document verification on Release Request (EoA, Affidavit, Release Approval Letter, FDR Copy)
router.post("/release/:id/verify-document", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { docId, status, remarks } = req.body;
  if (!docId || !status) {
    return res.status(400).json({ message: "docId and status are required" });
  }
  if (status !== "Verified" && status !== "Not Verified") {
    return res.status(400).json({ message: "status must be 'Verified' or 'Not Verified'" });
  }
  if (status === "Not Verified" && (!remarks || !String(remarks).trim())) {
    return res.status(400).json({ message: "Remarks are mandatory when marking document as Not Verified" });
  }

  try {
    const rr = await ReleaseRequest.findOne(idOrQuery(req.params.id, "releaseRequestId"));
    if (!rr) return res.status(404).json({ message: "Release request not found" });

    let documents = getReleaseDocuments(rr);
    let targetDoc: any = null;

    documents = documents.map((d: any) => {
      if (d.id === docId) {
        targetDoc = d;
        return {
          ...d,
          status,
          remarks: status === "Not Verified" ? String(remarks).trim() : "",
          verifiedBy: req.session.userId,
          verifiedAt: new Date(),
        };
      }
      return d;
    });

    if (!targetDoc) {
      return res.status(404).json({ message: "Document not found in release application" });
    }

    rr.documentItems = documents;

    // Recalculate live clearance and overall status
    const pgrcClearance = await calculatePgrcClearance(rr);
    const vigilanceClearance = await calculateVigilanceClearance(rr);
    const overallDecision = calculateOverallReleaseDecision(
      documents,
      pgrcClearance.status,
      vigilanceClearance.status,
      pgrcClearance.reason,
      vigilanceClearance.reason
    );

    rr.overallReleaseStatus = overallDecision.overallStatus;
    rr.pgrcClearanceSnapshot = pgrcClearance as any;
    rr.vigilanceClearanceSnapshot = vigilanceClearance as any;
    rr.pgrcStatus = pgrcClearance.status;
    rr.violenceStatus = vigilanceClearance.status;
    await rr.save();

    // Create notification for institution
    try {
      await Notification.create({
        collegeId: rr.collegeId,
        applicationId: rr.releaseRequestId,
        title: status === "Verified" ? "Release Document Verified" : "Release Document Deficiency Noted",
        message:
          status === "Verified"
            ? `Your release application document "${targetDoc.name}" has been verified.`
            : `Your release application document "${targetDoc.name}" requires correction: ${String(remarks).trim()}`,
        type: status === "Verified" ? "DOCUMENT_VERIFIED" : "DOCUMENT_NOT_VERIFIED",
        link: "/institution/dashboard",
        metadata: {
          releaseRequestId: rr.releaseRequestId,
          docId,
          docName: targetDoc.name,
          status,
          remarks: String(remarks || "").trim(),
        },
      });
    } catch (nErr) {
      console.warn("Notification error:", nErr);
    }

    auditLog(req, `FD verified release doc ${docId} -> ${status}`);
    return res.json({
      message: `Document status updated to ${status}`,
      documents,
      overallDecision,
    });
  } catch (err) {
    console.error("Verify release doc error:", err);
    return res.status(500).json({ message: "Failed to update release document" });
  }
});

// Final Decision on Release Request (Approve or Decline)
router.post("/release/:id/decision", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { action, declineRemarks } = req.body;
  if (!action || !["Approved", "Declined"].includes(action)) {
    return res.status(400).json({ message: "action must be Approved or Declined" });
  }
  try {
    const rr = await ReleaseRequest.findOne(idOrQuery(req.params.id, "releaseRequestId"));
    if (!rr) return res.status(404).json({ message: "Release request not found" });

    if (
      rr.status === "Approved" ||
      rr.status === "Declined" ||
      rr.status === "APPROVED" ||
      rr.status === "REJECTED"
    ) {
      return res.status(400).json({
        message: "This release application has already been processed. Duplicate processing prevented.",
      });
    }

    const identifiers = await resolveInstitutionIdentifiers(rr);
    const inst = identifiers.institutionDoc;
    if (inst && !rr.institutionId) {
      rr.institutionId = inst._id.toString();
    }
    const documents = getReleaseDocuments(rr);

    // Compute live real-time clearance
    const pgrcClearance = await calculatePgrcClearance(rr);
    const vigilanceClearance = await calculateVigilanceClearance(rr);
    const overallDecision = calculateOverallReleaseDecision(
      documents,
      pgrcClearance.status,
      vigilanceClearance.status,
      pgrcClearance.reason,
      vigilanceClearance.reason
    );

    if (action === "Approved") {
      // Priority check: must be ELIGIBLE_FOR_APPROVAL
      if (!overallDecision.isEligibleForApproval) {
        if (overallDecision.overallStatus === "DOCUMENT_DEFICIENCY") {
          return res.status(400).json({
            message: "Approval denied: Required documents are missing or not verified (Document Deficiency).",
          });
        }
        if (overallDecision.overallStatus === "REJECTED") {
          return res.status(400).json({
            message: "Approval denied: Release Application is REJECTED due to finalized proven complaint or investigation.",
          });
        }
        if (overallDecision.overallStatus === "MATURITY_EXTENDED") {
          return res.status(400).json({
            message: "Approval denied: Release Application maturity has been extended due to active ongoing investigation.",
          });
        }
        return res.status(400).json({
          message: "Approval denied: All 4 documents must be Verified and both clearances Approved.",
        });
      }

      rr.status = "Approved";
      rr.overallReleaseStatus = "APPROVED";
      rr.reviewedBy = req.session.userId;
      rr.reviewedAt = new Date();
      await rr.save();

      // Notify institution of release approval
      try {
        await Notification.create({
          collegeId: rr.collegeId,
          applicationId: rr.releaseRequestId,
          title: "Release Application Approved",
          message: `Your FDR Release Application (Ref: ${rr.fdrReference}) has been approved by the Finance Division.`,
          type: "RELEASE_APPROVED",
          link: "/institution/dashboard",
        });
      } catch (nErr) {
        console.warn("Notification error:", nErr);
      }
    } else {
      if (!declineRemarks || !String(declineRemarks).trim()) {
        return res.status(400).json({ message: "Decline remarks are required." });
      }
      rr.status = "Declined";
      rr.overallReleaseStatus = "DECLINED";
      rr.declineRemarks = String(declineRemarks).trim();
      rr.reviewedBy = req.session.userId;
      rr.reviewedAt = new Date();
      await rr.save();

      // Notify institution of release decline
      try {
        await Notification.create({
          collegeId: rr.collegeId,
          applicationId: rr.releaseRequestId,
          title: "Release Application Declined",
          message: `Your FDR Release Application (Ref: ${rr.fdrReference}) was declined. Remarks: ${String(declineRemarks).trim()}`,
          type: "RELEASE_DECLINED",
          link: "/institution/dashboard",
        });
      } catch (nErr) {
        console.warn("Notification error:", nErr);
      }
    }

    auditLog(req, `FD executed release decision for ${rr.releaseRequestId} -> ${action}`);
    return res.json({
      message: `Release request ${action.toLowerCase()} successfully`,
      releaseRequest: rr,
      overallDecision,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to execute release decision" });
  }
});

// Backward compatibility endpoints for legacy tests
router.post("/application/:id/review", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { newStatus } = req.body;
  if (!newStatus) return res.status(400).json({ message: "newStatus required" });
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: "Application not found" });
    app.status = newStatus;
    await app.save();
    return res.json({ message: "Application status updated", application: app });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update application" });
  }
});

router.post("/document/:id/verify", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { verified, remarks } = req.body;
  try {
    const doc = await DocumentVerification.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document verification record not found" });
    doc.verified = verified;
    if (remarks) doc.remarks = remarks;
    await doc.save();
    return res.json({ message: "Document verification updated", document: doc });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update document verification" });
  }
});

router.post("/payment/:id/verify", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { status } = req.body;
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    payment.status = status as any;
    await payment.save();
    return res.json({ message: "Payment status updated", payment });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update payment" });
  }
});

router.post("/release/:id/approve", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { decision } = req.body;
  try {
    const rr = await ReleaseRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: "Release request not found" });
    rr.status = decision as any;
    await rr.save();
    return res.json({ message: "Release request updated", releaseRequest: rr });
  } catch (err) {
    return res.status(500).json({ message: "Failed to update release request" });
  }
});

router.get("/complaint-summary/:institutionId/:applicationId?", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  const { institutionId, applicationId } = req.params;
  try {
    const match: any = { institutionId };
    if (applicationId) match.applicationId = applicationId;
    const total = await Complaint.countDocuments(match);
    const pending = await Complaint.countDocuments({ ...match, status: "PENDING" });
    const escalated = await Complaint.countDocuments({ ...match, status: "ESCALATED" });
    const resolved = await Complaint.countDocuments({ ...match, status: "RESOLVED" });
    const proven = await Complaint.countDocuments({
      ...match,
      $or: [
        { finalOutcome: "PROVEN" },
        { status: "PROVEN", finalOutcome: { $nin: ["UNSUBSTANTIATED", "INCONCLUSIVE"] } },
      ],
    });
    const unsubstantiated = await Complaint.countDocuments({ ...match, finalOutcome: "UNSUBSTANTIATED" });
    const inconclusive = await Complaint.countDocuments({ ...match, finalOutcome: "INCONCLUSIVE" });
    const noRelevant = total === 0 ? 1 : 0;
    return res.json({ total, noRelevant, pending, escalated, resolved, proven, unsubstantiated, inconclusive });
  } catch (err) {
    return res.status(500).json({ message: "Failed to compute complaint summary" });
  }
});

router.get("/complaint-summary", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  const { institutionId, applicationId } = req.query as any;
  if (!institutionId) return res.status(400).json({ message: "institutionId query param required" });
  try {
    const match: any = { institutionId };
    if (applicationId) match.applicationId = applicationId;
    const total = await Complaint.countDocuments(match);
    const pending = await Complaint.countDocuments({ ...match, status: "PENDING" });
    const escalated = await Complaint.countDocuments({ ...match, status: "ESCALATED" });
    const resolved = await Complaint.countDocuments({ ...match, status: "RESOLVED" });
    const proven = await Complaint.countDocuments({
      ...match,
      $or: [
        { finalOutcome: "PROVEN" },
        { status: "PROVEN", finalOutcome: { $nin: ["UNSUBSTANTIATED", "INCONCLUSIVE"] } },
      ],
    });
    const unsubstantiated = await Complaint.countDocuments({ ...match, finalOutcome: "UNSUBSTANTIATED" });
    const inconclusive = await Complaint.countDocuments({ ...match, finalOutcome: "INCONCLUSIVE" });
    const noRelevant = total === 0 ? 1 : 0;
    return res.json({ total, noRelevant, pending, escalated, resolved, proven, unsubstantiated, inconclusive });
  } catch (err) {
    return res.status(500).json({ message: "Failed to compute complaint summary" });
  }
});

// Helper to compute active due FDR maturity reminders within the next 30 days
export async function getDueMaturityReminders() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOf30Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 23, 59, 59, 999);

  // 1. Fetch verified and active FDRs with maturity dates in the 30-day window
  const payments = await Payment.find({
    status: "VERIFIED",
    isActive: { $ne: false },
    maturityDate: { $gte: startOfToday, $lte: endOf30Days },
  }).sort({ maturityDate: 1 });

  // 2. Exclude closed/released FDRs where a ReleaseRequest is Approved
  const approvedReleases = await ReleaseRequest.find({
    status: { $in: ["Approved", "APPROVED"] },
  });
  const approvedFdrRefs = new Set(approvedReleases.map(r => r.fdrReference).filter(Boolean));
  const approvedFdrIds = new Set(approvedReleases.map(r => r.fdrId).filter(Boolean));

  // 3. Filter out any released or cancelled
  const activeDuePayments = payments.filter(p => {
    if (approvedFdrRefs.has(p.referenceNumber) || (p.paymentId && approvedFdrIds.has(p.paymentId))) {
      return false;
    }
    return true;
  });

  // 4. Map institutions for rich details
  const institutions = await Institution.find();
  const instMap = new Map();
  institutions.forEach(i => {
    if (i.collegeId) instMap.set(i.collegeId, i);
    instMap.set(i._id.toString(), i);
  });

  return activeDuePayments.map(p => {
    const inst = instMap.get(p.collegeId) || instMap.get(String(p.collegeId || "").trim());
    const maturityTime = new Date(p.maturityDate!).getTime();
    const daysRemaining = Math.max(0, Math.ceil((maturityTime - now.getTime()) / (1000 * 60 * 60 * 24)));
    const hasReminderSent = Boolean(p.maturityReminder?.sentDate);

    return {
      id: p.paymentId,
      paymentId: p.paymentId,
      fdrNumber: p.referenceNumber,
      fdrReference: p.referenceNumber,
      collegeId: p.collegeId,
      institutionId: p.collegeId,
      institutionName: inst?.name || p.collegeId,
      institutionEmail: (inst?.email || inst?.principalEmail || "").trim(),
      amount: p.amount,
      bankName: p.bankName || "State Bank of India",
      branchName: p.branchName || "Main Branch",
      depositDate: p.paymentDate || p.createdAt,
      maturityDate: p.maturityDate,
      daysRemaining,
      hasReminderSent,
      lastLetter: p.maturityReminder || null,
      isReviewed: Boolean(p.isReviewed),
    };
  });
}

// GET /api/fd/maturity-reminders - active FDRs maturing within the next 30 days
router.get("/maturity-reminders", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (_req, res) => {
  try {
    const reminders = await getDueMaturityReminders();
    return res.json({ count: reminders.length, reminders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch maturity reminders" });
  }
});

// GET /api/fd/badge-counts - dynamic notification-count badges for sidebar menu items
router.get("/badge-counts", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (_req, res) => {
  try {
    const approvalApplications = await Application.countDocuments({
      status: { $in: ["SUBMITTED", "UNDER_REVIEW"] },
      isReviewed: { $ne: true },
    });
    const depositRecords = await Payment.countDocuments({
      status: { $in: ["SUBMITTED", "PENDING_VERIFICATION"] },
      isReviewed: { $ne: true },
    });
    const releaseApplications = await ReleaseRequest.countDocuments({
      status: { $in: ["SUBMITTED", "Pending", "PENDING", "UNDER_REVIEW"] },
      isReviewed: { $ne: true },
      reviewedBy: { $exists: false },
    });

    const dueReminders = await getDueMaturityReminders();
    const maturityReminders = dueReminders.length;

    return res.json({
      approvalApplications,
      depositRecords,
      releaseApplications,
      maturityReminders,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch badge counts" });
  }
});

// POST /api/fd/mark-reviewed - update unread/reviewed state of an item
router.post("/mark-reviewed", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { type, id } = req.body;
  if (!type || !id) return res.status(400).json({ message: "type and id are required" });

  try {
    const now = new Date();
    const userId = req.session?.userId || "fd_emp";

    if (type === "application") {
      await Application.updateOne(
        idOrQuery(id, "applicationId"),
        { $set: { isReviewed: true, reviewedAt: now, reviewedBy: userId } }
      );
    } else if (type === "deposit") {
      await Payment.updateOne(
        idOrQuery(id, "paymentId"),
        { $set: { isReviewed: true, reviewedAt: now, reviewedBy: userId } }
      );
    } else if (type === "release") {
      await ReleaseRequest.updateOne(
        idOrQuery(id, "releaseRequestId"),
        { $set: { isReviewed: true, reviewedAt: now, reviewedBy: userId } }
      );
    }

    return res.json({ success: true, message: `Marked ${type} ${id} as reviewed` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to mark as reviewed" });
  }
});

// GET /api/fd/notifications - combined notification list for bell icon
router.get("/notifications", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (_req, res) => {
  try {
    const dueReminders = await getDueMaturityReminders();

    const pendingApps = await Application.find({
      status: { $in: ["SUBMITTED", "UNDER_REVIEW"] },
      isReviewed: { $ne: true },
    }).limit(6);

    const pendingDeposits = await Payment.find({
      status: { $in: ["SUBMITTED", "PENDING_VERIFICATION"] },
      isReviewed: { $ne: true },
    }).limit(6);

    const pendingReleases = await ReleaseRequest.find({
      status: { $in: ["PENDING", "SUBMITTED", "Pending"] },
      isReviewed: { $ne: true },
      reviewedBy: { $exists: false },
    }).limit(6);

    const notifications = [
      ...dueReminders.map(rem => ({
        id: `NOTIF-MAT-${rem.paymentId}`,
        type: "maturity_reminder",
        title: `FDR Maturity in ${rem.daysRemaining} Days`,
        detail: `FDR ${rem.fdrNumber} for ${rem.institutionName} (${rem.collegeId}) matures on ${new Date(rem.maturityDate).toLocaleDateString("en-IN")}.`,
        date: rem.maturityDate,
        read: rem.hasReminderSent,
        fdrId: rem.paymentId,
        fdrReference: rem.fdrNumber,
        collegeId: rem.collegeId,
        institutionName: rem.institutionName,
        institutionEmail: rem.institutionEmail,
        maturityDate: rem.maturityDate,
        daysRemaining: rem.daysRemaining,
        amount: rem.amount,
        bankName: rem.bankName,
        branchName: rem.branchName,
        hasLetter: rem.hasReminderSent,
        lastLetter: rem.lastLetter,
      })),
      ...pendingApps.map(a => ({
        id: `NOTIF-APP-${a.applicationId}`,
        title: "New Approval Application",
        detail: `Application ${a.applicationId} (${a.title}) is pending review.`,
        date: a.submissionDate || a.createdAt,
        read: Boolean(a.isReviewed),
        type: "application",
        entityId: a.applicationId,
      })),
      ...pendingDeposits.map(p => ({
        id: `NOTIF-DEP-${p.paymentId}`,
        title: "New FDR Submission",
        detail: `Deposit ${p.referenceNumber} (₹${fmt(p.amount)}) from ${p.collegeId} is pending verification.`,
        date: p.paymentDate || p.createdAt,
        read: Boolean(p.isReviewed),
        type: "deposit",
        entityId: p.paymentId,
      })),
      ...pendingReleases.map(r => ({
        id: `NOTIF-REL-${r.releaseRequestId}`,
        title: "New Release Application",
        detail: `Release request ${r.releaseRequestId} for FDR ${r.fdrReference} is pending review.`,
        date: r.submissionDate || r.createdAt,
        read: Boolean(r.isReviewed),
        type: "release",
        entityId: r.releaseRequestId,
      })),
    ];

    return res.json(notifications);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// POST /api/fd/deposit/:id/generate-maturity-letter - generate formal institution-specific reminder letter
router.post("/deposit/:id/generate-maturity-letter", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  try {
    const payment = await Payment.findOne(idOrQuery(req.params.id, "paymentId"));
    if (!payment) return res.status(404).json({ message: "FDR deposit record not found" });

    const inst = await Institution.findOne({ collegeId: payment.collegeId });
    const institutionName = inst?.name || payment.collegeId;
    const institutionEmail = (inst?.email || inst?.principalEmail || "").trim();

    const now = new Date();
    const maturityDate = payment.maturityDate || now;
    const daysRemaining = Math.max(0, Math.ceil((new Date(maturityDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const year = now.getFullYear();
    const letterRef = `AICTE/FD/REMINDER/${payment.referenceNumber}/${year}`;

    const letterText =
`================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
Finance Bureau & Fixed Deposit (FDR) Division
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
================================================================================

OFFICIAL NOTICE: FIXED DEPOSIT RECEIPT (FDR) MATURITY REMINDER
Letter Reference : ${letterRef}
Date of Issuance : ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}

To,
The Chairman / President / Principal,
${institutionName}
Institution ID : ${payment.collegeId}
Address        : ${inst?.address || "Registered Campus Address"}

SUBJECT: FORMAL REGULATORY REMINDER CONCERNING STATUTORY FDR MATURITY & RELEASE PROCEDURES

Dear Sir / Madam,

This formal regulatory notice is issued by the Finance Division of the All India Council for Technical Education (AICTE) concerning the Joint Fixed Deposit Receipt (FDR) created in compliance with statutory AICTE Approval Process Handbook (APH) norms.

FDR PARTICULARS ON RECORD:
--------------------------------------------------------------------------------
1. Institution Name         : ${institutionName}
2. AICTE Institution ID     : ${payment.collegeId}
3. FDR Reference Number     : ${payment.referenceNumber}
4. Depository Bank Name     : ${payment.bankName || "Scheduled Commercial Bank"}
5. Depository Branch Name   : ${payment.branchName || "Main Branch"}
6. Principal Deposit Amount : ₹${new Intl.NumberFormat("en-IN").format(payment.amount || 0)}
7. Recorded Maturity Date   : ${new Date(maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
8. Days Remaining to Term   : ${daysRemaining} Days

MANDATORY REGULATORY INSTRUCTIONS & STATUTORY NEXT STEPS:
--------------------------------------------------------------------------------
1. Council Statutory Lien:
   The arrival of the maturity date alone does NOT automatically return or release the deposit to the institution. The deposit remains subject to Council lien until formally authorized by the AICTE Approval Bureau.

2. Submission of Release Application:
   If your institution has completed the prescribed lock-in term and intends to seek release of the security deposit, a formal Release Application must be submitted through the AICTE Unified Portal:
   Portal Route: Submit → Release Application (/institution/submit/release)

3. Required Mandatory Enclosures (Clause 6.46 & Affidavit 6):
   - Prescribed E-Affidavit 6 (duly notarized on non-judicial stamp paper declaring cleared faculty salary dues and zero student fee complaints).
   - Valid Extension of Approval (EoA) copy for the current academic session.
   - Legible copy of the FDR Certificate and bank statement.
   - Formal Request Letter signed by the Chairman/Secretary of the Applicant Trust/Society.

4. Inter-Departmental Clearances:
   Affirmative clearances from the AICTE Public Grievance Redressal Cell (PGRC) and AICTE Vigilance Cell are mandatory before release can be approved.

5. FD Helpdesk Assistance:
   For further assistance or guidance regarding renewal or release procedures, please contact the AICTE Finance Division Helpdesk at finance-fdr@aicte-india.org.

Issued under the authority of Member Secretary / Finance Officer,
All India Council for Technical Education (AICTE)
================================================================================`;

    return res.json({
      letterRef,
      letterText,
      institutionName,
      collegeId: payment.collegeId,
      fdrNumber: payment.referenceNumber,
      amount: payment.amount,
      bankName: payment.bankName,
      branchName: payment.branchName,
      depositDate: payment.paymentDate,
      maturityDate,
      daysRemaining,
      toEmail: institutionEmail,
      isEmailConfigured: isEmailConfigured(),
      previousLetter: payment.maturityReminder || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate maturity reminder letter" });
  }
});

// POST /api/fd/deposit/:id/send-maturity-letter - send reminder letter with confirmation and duplicate protection
router.post("/deposit/:id/send-maturity-letter", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req, res) => {
  const { confirmed, forceResend, letterContent: clientLetterContent } = req.body;
  if (!confirmed) {
    return res.status(400).json({
      message: "Confirmation required. You must explicitly confirm before sending the reminder letter.",
    });
  }

  try {
    const payment = await Payment.findOne(idOrQuery(req.params.id, "paymentId"));
    if (!payment) return res.status(404).json({ message: "FDR record not found" });

    const now = new Date();
    const maturityDate = payment.maturityDate || now;
    const daysRemaining = Math.max(0, Math.ceil((new Date(maturityDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Prevent duplicate reminder letters for the same FDR and reminder cycle
    if (payment.maturityReminder && payment.maturityReminder.sentDate && !forceResend) {
      const prevSent = new Date(payment.maturityReminder.sentDate);
      const daysSinceLastSent = (now.getTime() - prevSent.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastSent < 30) {
        return res.status(400).json({
          message: `Reminder letter already sent for this maturity cycle on ${prevSent.toLocaleDateString("en-IN")}. Duplicate sending prevented.`,
          previousLetter: payment.maturityReminder,
        });
      }
    }

    const inst = await Institution.findOne({ collegeId: payment.collegeId });
    const institutionName = inst?.name || payment.collegeId;
    const institutionEmail = (inst?.email || inst?.principalEmail || "").trim();
    const year = now.getFullYear();
    const letterRef = `AICTE/FD/REMINDER/${payment.referenceNumber}/${year}`;

    const letterContent = clientLetterContent ||
`================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
Finance Bureau & Fixed Deposit (FDR) Division
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
================================================================================

OFFICIAL NOTICE: FIXED DEPOSIT RECEIPT (FDR) MATURITY REMINDER
Letter Reference : ${letterRef}
Date of Issuance : ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}

To,
The Chairman / President / Principal,
${institutionName}
Institution ID: ${payment.collegeId}

SUBJECT: FORMAL REMINDER REGARDING STATUTORY FDR MATURITY & REGULATORY COMPLIANCE

FDR Reference Number     : ${payment.referenceNumber}
Principal Deposit Amount : ₹${new Intl.NumberFormat("en-IN").format(payment.amount || 0)}
Recorded Maturity Date   : ${new Date(maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
Days Remaining to Term   : ${daysRemaining} Days

Please initiate the statutory Release Application with Affidavit 6 under Submit → Release Application (/institution/submit/release) on the AICTE Portal.
================================================================================`;

    let emailSent = false;
    let deliveryStatus = "Delivered (Portal)";
    let deliveryDetails = "Delivered through Institution Portal. Email service not configured.";

    if (isEmailConfigured() && institutionEmail) {
      const emailResult = await sendMaturityReminderEmail({
        toEmail: institutionEmail,
        institutionName,
        collegeId: payment.collegeId,
        fdrNumber: payment.referenceNumber,
        amount: payment.amount,
        maturityDate,
        daysRemaining,
        letterContent,
      });

      if (emailResult.success) {
        emailSent = true;
        deliveryStatus = "Sent (Email & Portal)";
        deliveryDetails = `Email successfully dispatched to ${institutionEmail} (${emailResult.provider || "SMTP"}) and delivered through Institution Portal.`;
      } else {
        deliveryStatus = "Delivered (Portal)";
        deliveryDetails = `Delivered through Institution Portal. Email sending failed: ${emailResult.error || "Delivery error"}`;
      }
    }

    const letterRecord = {
      letterRef,
      institutionName,
      collegeId: payment.collegeId,
      fdrReference: payment.referenceNumber,
      amount: payment.amount,
      maturityDate,
      daysRemaining,
      letterText: letterContent,
      content: letterContent,
      generatedBy: req.session?.userId || "fd_emp",
      generatedDate: now,
      sentBy: req.session?.userId || "fd_emp",
      sentDate: now,
      recipientEmail: institutionEmail || "Not provided",
      emailSent,
      deliveryStatus,
      deliveryDetails,
    };

    // 1. Update Payment record with current reminder and append to history
    payment.maturityReminder = letterRecord;
    if (!payment.maturityReminders) payment.maturityReminders = [];
    payment.maturityReminders.push(letterRecord);
    payment.isReviewed = true;
    payment.reviewedAt = now;
    payment.reviewedBy = req.session?.userId || "fd_emp";
    await payment.save();

    // 2. Create persistent Notification for the Institution in MongoDB
    try {
      await Notification.create({
        collegeId: payment.collegeId,
        applicationId: payment.paymentId,
        title: `FDR Maturity Reminder: FDR Ref ${payment.referenceNumber}`,
        message: `Official AICTE Maturity Notice: Your FDR (${payment.referenceNumber}, ₹${new Intl.NumberFormat("en-IN").format(payment.amount || 0)}) reaches maturity on ${new Date(maturityDate).toLocaleDateString("en-IN")} (${daysRemaining} days remaining). Please review the formal instructions and submit a Release Application if eligible.`,
        type: "FDR_MATURITY_REMINDER",
        link: "/institution/receive/deposit",
        isRead: false,
        read: false,
        metadata: {
          paymentId: payment.paymentId,
          fdrReference: payment.referenceNumber,
          maturityDate,
          daysRemaining,
          letterRef,
          letterContent,
          deliveryStatus,
          deliveryDetails,
          sentDate: now,
        },
      });
    } catch (nErr) {
      console.warn("Notification creation error:", nErr);
    }

    // 3. Log to AuditLog
    try {
      await AuditLog.create({
        action: "FDR_MATURITY_REMINDER_SENT",
        employeeId: (req.session as any)?.userObjectId || req.session?.userId || "fd_emp",
        role: "AICTE_FD_EMPLOYEE",
        details: `FDR reminder letter ${letterRef} sent for FDR ${payment.referenceNumber} to ${payment.collegeId}. Delivery: ${deliveryStatus}`,
        timestamp: now,
      });
    } catch (aErr) {
      console.warn("AuditLog creation error:", aErr);
    }

    auditLog(req, `FD sent maturity reminder letter for ${payment.referenceNumber} (${deliveryStatus})`);
    return res.json({
      message: emailSent
        ? "Reminder letter generated and dispatched via email and Institution Portal."
        : "Reminder letter generated and delivered through Institution Portal (email service unconfigured).",
      deliveryStatus,
      deliveryDetails,
      emailSent,
      letterRecord,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to send maturity reminder letter" });
  }
});

// ==============================================================================
// MODULE 6 & 7: REAL-TIME COMPLAINT STATUS SYNCHRONIZATION & LETTER GENERATION
// ==============================================================================

function computeDeptStatus(complaints: any[]): {
  status: "REJECTED" | "ON PROCESS" | "PENDING" | "VERIFIED" | "NO COMPLAINTS";
  count: number;
  reason: string;
  references: string[];
  latestDate: Date | null;
} {
  if (!complaints || complaints.length === 0) {
    return {
      status: "NO COMPLAINTS",
      count: 0,
      reason: "No complaints on record for this department",
      references: [],
      latestDate: null,
    };
  }

  const refs = complaints.map(c => c.complaintReference || c._id.toString());
  const latestDate = complaints.reduce(
    (max: Date, c: any) => (new Date(c.updatedAt) > new Date(max) ? c.updatedAt : max),
    complaints[0].updatedAt
  );

  // 1. Any PROVEN -> REJECTED
  const proven = complaints.find(c => {
    const s = (c.status || "").toUpperCase();
    const fo = (c.finalOutcome || "").toUpperCase();
    return s === "PROVEN" || fo === "PROVEN";
  });
  if (proven) {
    return {
      status: "REJECTED",
      count: complaints.length,
      reason: proven.reason || proven.findingSummary || "Complaint allegations established and proven",
      references: refs,
      latestDate,
    };
  }

  // 2. Otherwise Any INVESTIGATION -> ON PROCESS
  const investigation = complaints.find(c => {
    const s = (c.status || "").toUpperCase();
    const fo = (c.finalOutcome || "").toUpperCase();
    return (
      s === "INVESTIGATION" ||
      s === "UNDER_INVESTIGATION" ||
      s === "ON_PROCESS" ||
      s === "IN_PROGRESS" ||
      s === "UNDER_REVIEW" ||
      fo === "ON_PROCESS"
    );
  });
  if (investigation) {
    return {
      status: "ON PROCESS",
      count: complaints.length,
      reason: investigation.reason || investigation.findingSummary || "Under active official investigation",
      references: refs,
      latestDate,
    };
  }

  // 3. Otherwise Any NEW -> PENDING
  const newComplaint = complaints.find(c => {
    const s = (c.status || "").toUpperCase();
    return s === "NEW" || s === "PENDING" || s === "OPEN";
  });
  if (newComplaint) {
    return {
      status: "PENDING",
      count: complaints.length,
      reason: "Newly registered complaint pending preliminary scrutiny",
      references: refs,
      latestDate,
    };
  }

  // 4. Otherwise All UNPROVEN -> VERIFIED
  const unprovenReason =
    complaints[0]?.reason || complaints[0]?.findingSummary || "All filed complaints reviewed and allegations unsubstantiated";
  return {
    status: "VERIFIED",
    count: complaints.length,
    reason: unprovenReason,
    references: refs,
    latestDate,
  };
}

// 1. Real-time complaint screening statuses per institution
router.get("/compliance-status", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (_req: Request, res: Response) => {
  try {
    const institutions = await Institution.find({}).sort({ name: 1 }).lean();
    const allComplaints = await Complaint.find({}).lean();
    const allLetters = await ComplaintLetter.find({ isSent: true }).lean();

    const result = institutions.map((inst: any) => {
      const instIdStr = inst._id.toString();
      const collegeId = inst.collegeId;

      // Match complaints for this institution
      const instComplaints = allComplaints.filter(
        c => c.institutionId === instIdStr || (collegeId && c.collegeId === collegeId)
      );

      const pgrcComplaints = instComplaints.filter(
        c => c.assignedDepartment === "PGRC" || c.category === "PGRC" || (!c.assignedDepartment && c.category !== "VIGILANCE")
      );
      const vigComplaints = instComplaints.filter(
        c => c.assignedDepartment === "VIGILANCE" || c.category === "VIGILANCE" || c.escalatedToVigilance
      );

      const pgrc = computeDeptStatus(pgrcComplaints);
      const vigilance = computeDeptStatus(vigComplaints);

      // Check for dispatched letters
      const pgrcLetter = allLetters.find(
        (l: any) => (l.institutionId === instIdStr || l.collegeId === collegeId) && l.department === "PGRC"
      );
      const vigLetter = allLetters.find(
        (l: any) => (l.institutionId === instIdStr || l.collegeId === collegeId) && l.department === "VIGILANCE"
      );

      return {
        institutionId: instIdStr,
        collegeId: inst.collegeId,
        institutionName: inst.name,
        state: inst.state || "—",
        district: inst.district || "—",
        pgrcStatus: pgrc.status,
        pgrcCount: pgrc.count,
        pgrcReason: pgrc.reason,
        pgrcReferences: pgrc.references,
        pgrcLatestDate: pgrc.latestDate,
        pgrcLetterSent: Boolean(pgrcLetter),
        pgrcLetterRef: pgrcLetter?.letterReference || null,
        vigilanceStatus: vigilance.status,
        vigilanceCount: vigilance.count,
        vigilanceReason: vigilance.reason,
        vigilanceReferences: vigilance.references,
        vigilanceLatestDate: vigilance.latestDate,
        vigilanceLetterSent: Boolean(vigLetter),
        vigilanceLetterRef: vigLetter?.letterReference || null,
        lastUpdated: new Date(),
      };
    });

    return res.json(result);
  } catch (err: any) {
    console.error("FD compliance-status error:", err);
    return res.status(500).json({ message: "Failed to compute compliance statuses" });
  }
});

// 2. Generate Draft Outcome Letter
router.post("/compliance-letter/generate", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  const { institutionId, department } = req.body;
  if (!institutionId || !department || !["PGRC", "VIGILANCE"].includes(department)) {
    return res.status(400).json({ message: "Valid institutionId and department (PGRC or VIGILANCE) are required" });
  }

  try {
    const inst = await Institution.findOne({
      $or: [{ _id: institutionId.match(/^[0-9a-fA-F]{24}$/) ? institutionId : null }, { collegeId: institutionId }],
    });
    if (!inst) return res.status(404).json({ message: "Institution not found" });

    // Fetch complaints for this department
    const instIdStr = inst._id.toString();
    const allComplaints = await Complaint.find({
      $or: [{ institutionId: instIdStr }, { collegeId: inst.collegeId }],
    }).lean();

    const deptComplaints = allComplaints.filter(c =>
      department === "VIGILANCE"
        ? c.assignedDepartment === "VIGILANCE" || c.category === "VIGILANCE" || c.escalatedToVigilance
        : c.assignedDepartment === "PGRC" || c.category === "PGRC" || (!c.assignedDepartment && c.category !== "VIGILANCE")
    );

    const deptStatus = computeDeptStatus(deptComplaints);
    if (deptStatus.status === "NO COMPLAINTS") {
      return res.status(400).json({ message: "Cannot generate an outcome letter when no complaints exist for this department." });
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const letterReference = `AICTE/FD/COMP-OUTCOME/${department}/${inst.collegeId || "INST"}/${Date.now()}-${randomSuffix}`;
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

    const content = `================================================================================
ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070
FINANCE & REGULATORY COMPLIANCE DIVISION
================================================================================

OFFICIAL NOTICE: ${department === "PGRC" ? "PGRC GRIEVANCE SCREENING OUTCOME" : "VIGILANCE SCREENING OUTCOME"}
Ref No.   : ${letterReference}
Date      : ${dateStr}

To,
The Principal / Director,
${inst.name}
Institution ID: ${inst.collegeId || inst._id}

SUBJECT: OFFICIAL DETERMINATION OF ${department} COMPLIANCE STATUS

Dear Sir / Madam,

This is to inform that the institutional records and complaints referred to the ${
      department === "PGRC" ? "Public Grievance Redressal Cell (PGRC)" : "Chief Vigilance Division (CVD)"
    } concerning ${inst.name} have been scrutinized under AICTE statutory compliance regulations.

FINDING STATUS: ${deptStatus.status}
DEPARTMENT    : ${department}
COMPLAINT REF : ${deptStatus.references.join(", ") || "N/A"}
DECISION CAUSE: ${deptStatus.reason || "Official assessment on record"}

DETERMINATION SUMMARY:
${
  deptStatus.status === "REJECTED"
    ? "One or more grievances/allegations against the institution stand PROVEN upon inquiry. Corrective regulatory measures and statutory conditions apply."
    : deptStatus.status === "ON PROCESS"
    ? "Official investigation is actively ongoing before the competent authority. Institutional clearance remains subject to final inquiry outcome."
    : "All filed complaints have been scrutinized and rendered UNPROVEN / UNSUBSTANTIATED. The institution stands cleared in respect of the specified grievances."
}

Yours faithfully,

Authorized Officer
Finance & Statutory Compliance Division
All India Council for Technical Education (AICTE)
================================================================================`;

    return res.json({
      success: true,
      letterReference,
      institutionId: inst._id.toString(),
      collegeId: inst.collegeId,
      institutionName: inst.name,
      department,
      status: deptStatus.status,
      complaintReferences: deptStatus.references,
      reason: deptStatus.reason,
      content,
      generatedDate: new Date(),
    });
  } catch (err: any) {
    console.error("Generate compliance letter error:", err);
    return res.status(500).json({ message: "Failed to generate compliance letter" });
  }
});

// 3. Manually Send Outcome Letter (Manual dispatch only)
router.post("/compliance-letter/send", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (req: Request, res: Response) => {
  const { letterReference, institutionId, department, status, content, reason, complaintReferences } = req.body;

  if (!letterReference || !institutionId || !department || !status || !content) {
    return res.status(400).json({ message: "Incomplete letter payload. Please preview before dispatch." });
  }

  try {
    const inst = await Institution.findOne({
      $or: [{ _id: institutionId.match(/^[0-9a-fA-F]{24}$/) ? institutionId : null }, { collegeId: institutionId }],
    });
    if (!inst) return res.status(404).json({ message: "Institution not found" });

    // Check duplicate
    const existing = await ComplaintLetter.findOne({ letterReference });
    if (existing && existing.isSent) {
      return res.status(400).json({ message: `Letter ${letterReference} has already been dispatched. Duplicate dispatch prevented.` });
    }

    // Verify live status freshness to prevent dispatching stale outcome data
    const allComplaints = await Complaint.find({
      $or: [{ institutionId: inst._id.toString() }, { collegeId: inst.collegeId }],
    }).lean();

    const deptComplaints = allComplaints.filter(c =>
      department === "VIGILANCE"
        ? c.assignedDepartment === "VIGILANCE" || c.category === "VIGILANCE" || c.escalatedToVigilance
        : c.assignedDepartment === "PGRC" || c.category === "PGRC" || (!c.assignedDepartment && c.category !== "VIGILANCE")
    );

    const liveStatus = computeDeptStatus(deptComplaints);
    if (liveStatus.status !== status) {
      return res.status(409).json({
        message: `Stale status detected. The live complaint status for ${department} is now "${liveStatus.status}", which does not match draft status "${status}". Please generate and preview a fresh letter before dispatching.`,
      });
    }

    const officer = req.session?.userId || "fd_emp";

    const now = new Date();

    const letter = await ComplaintLetter.findOneAndUpdate(
      { letterReference },
      {
        letterReference,
        institutionId: inst._id.toString(),
        collegeId: inst.collegeId,
        institutionName: inst.name,
        department,
        complaintReferences: complaintReferences || [],
        status,
        reason: reason || "",
        content,
        generatedBy: officer,
        generatedDate: now,
        isSent: true,
        sentBy: officer,
        sentDate: now,
      },
      { upsert: true, new: true }
    );

    // Notify institution
    try {
      await Notification.create({
        collegeId: inst.collegeId || inst._id.toString(),
        title: `Official ${department} Outcome Letter Issued`,
        message: `AICTE Finance Division has issued official ${department} outcome letter (${status}). Ref: ${letterReference}.`,
        link: "/institution/receive/complaint-letters",
        type: "COMPLIANCE",
        read: false,
      });
    } catch (notifErr) {
      console.warn("Notification create warning:", notifErr);
    }

    // Audit log
    await AuditLog.create({
      action: "send_compliance_letter",
      employeeId: officer,
      role: "AICTE_FD_EMPLOYEE",
      details: `Dispatched ${department} outcome letter (${status}) for ${inst.name} (${inst.collegeId}). Ref: ${letterReference}`,
    });

    return res.json({
      success: true,
      message: `Outcome letter ${letterReference} dispatched successfully to ${inst.name}.`,
      letter,
    });
  } catch (err: any) {
    console.error("Send compliance letter error:", err);
    return res.status(500).json({ message: "Failed to dispatch compliance letter" });
  }
});

// 4. Fetch all dispatched complaint letters
router.get("/compliance-letters", requireAuth, requireRole("AICTE_FD_EMPLOYEE"), async (_req: Request, res: Response) => {
  try {
    const letters = await ComplaintLetter.find().sort({ createdAt: -1 }).lean();
    return res.json(letters);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch letters" });
  }
});

export default router;
