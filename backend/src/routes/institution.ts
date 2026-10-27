// src/routes/institution.ts
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { Institution } from "../models/Institution";
import { User, Role } from "../models/User";
import { Counter } from "../models/Counter";
import { Application } from "../models/Application";
import { Complaint } from "../models/Complaint";
import { ComplaintLetter } from "../models/ComplaintLetter";
import { Payment } from "../models/Payment";
import { ReleaseRequest } from "../models/ReleaseRequest";
import { DocumentVerification } from "../models/DocumentVerification";
import { Notification } from "../models/Notification";
import { registerLimiter } from "../middleware/rateLimiter";
import { connectDB } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { upload, validateFileSignature, UPLOAD_DIR } from "../middleware/upload";
import { generateApprovalLetterPdf } from "../services/pdfService";

const router = Router();

// Ensure DB connection
router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

/**
 * Robust helper to resolve the authenticated User and Institution from session
 * Supports both College ID (string) and MongoDB ObjectId representations
 */
export async function getSessionInstitution(req: Request) {
  const sUserId = req.session?.userId;
  const sUserObjectId = (req.session as any)?.userObjectId;
  if (!sUserId && !sUserObjectId) return null;

  const isObjectId = sUserId && /^[0-9a-fA-F]{24}$/.test(sUserId);
  const user = await User.findOne({
    $or: [
      { userId: sUserId },
      ...(isObjectId ? [{ _id: sUserId }] : []),
      ...(sUserObjectId ? [{ _id: sUserObjectId }] : []),
    ],
  }).exec();

  if (!user) return null;

  let institution = null;
  if (user.institutionId && /^[0-9a-fA-F]{24}$/.test(user.institutionId)) {
    institution = await Institution.findById(user.institutionId).exec();
  }
  if (!institution) {
    // Support both old-style (userId = collegeId) and new-style (userId = username, collegeId separate)
    const lookupIds = [user.userId];
    if ((user as any).collegeId && (user as any).collegeId !== user.userId) {
      lookupIds.push((user as any).collegeId);
    }
    institution = await Institution.findOne({ collegeId: { $in: lookupIds } }).exec();
  }
  if (!institution) {
    institution = await Institution.findOne({ linkedUser: user._id }).exec();
  }

  return { user, institution };
}

/**
 * Returns all potential identifiers associated with the authenticated institution
 * (collegeId, userId, institution name, MongoDB ObjectIds) for reliable matching
 */
export function getInstitutionIdentifiers(ctx: any): string[] {
  if (!ctx) return [];
  const ids = [
    ctx.institution?.collegeId,
    ctx.user?.collegeId,
    ctx.user?.userId,
    ctx.institution?.name,
    ctx.institution?._id?.toString(),
    ctx.user?.institutionId?.toString(),
  ];
  return Array.from(new Set(ids.filter(Boolean) as string[]));
}

// Zod schema for registration payload
const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(1),
  approvalNumber: z.string().optional(),
  institutionType: z.string().min(1),
  email: z.string().email(),
  contactNumber: z.string().min(5),
  state: z.string().min(1),
  district: z.string().min(1),
  address: z.string().min(1),
  principalName: z.string().min(1),
  authorizedContactPerson: z.string().min(1),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
});

// Helper to generate next collegeId atomically
async function generateCollegeId(): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: "collegeId" },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  ).exec();
  const seqNum = counter?.seq ?? 1;
  const padded = String(seqNum).padStart(6, "0");
  return `CLG-${year}-${padded}`;
}

// Registration endpoint — no email verification required
router.post("/register", registerLimiter, async (req: Request, res: Response) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Invalid payload", errors: parse.error.format() });
  }
  const {
    username,
    name,
    approvalNumber,
    institutionType,
    email,
    contactNumber,
    state,
    district,
    address,
    principalName,
    authorizedContactPerson,
    password,
    confirmPassword,
  } = parse.data;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  const escapeRegex = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const uRegex = new RegExp(`^${escapeRegex(cleanUsername)}$`, "i");
  const eRegex = new RegExp(`^${escapeRegex(cleanEmail)}$`, "i");

  // Check username uniqueness — case-insensitively across all users
  const existingUser = await User.findOne({
    $or: [
      { userId: uRegex },
      { username: uRegex },
      { collegeId: uRegex },
    ],
  }).exec();
  if (existingUser) {
    return res.status(409).json({ message: "Username already exists. Please choose another username." });
  }

  // Check duplicate email among institutions — case-insensitively
  const existingInst = await Institution.findOne({ email: eRegex }).exec();
  if (existingInst) {
    return res.status(409).json({ message: "Institution with this email already exists" });
  }

  const collegeId = await generateCollegeId();
  const passwordHash = await bcrypt.hash(password, 12);

  const institution = new Institution({
    name: name.trim(),
    collegeId,
    email: cleanEmail,
    contactNumber,
    address,
    registrationStatus: "APPROVED",  // Active immediately — no email verification
  } as any);

  (institution as any).approvalNumber = approvalNumber;
  (institution as any).institutionType = institutionType;
  (institution as any).state = state;
  (institution as any).district = district;
  (institution as any).principalName = principalName;
  (institution as any).authorizedContactPerson = authorizedContactPerson;
  (institution as any).registrationDate = new Date();

  await institution.save();

  const user = new User({
    userId: cleanUsername,   // preferred username is the login ID
    username: cleanUsername,
    collegeId,              // store generated collegeId on the user record
    passwordHash,
    role: "INSTITUTION" as Role,
    institutionId: institution._id.toString(),
    accountStatus: "ACTIVE",   // Active immediately — no email verification
  } as any);
  await user.save();

  institution.linkedUser = user._id;
  await institution.save();

  return res.status(201).json({
    message: "Account created successfully. You can now access your institution portal.",
    collegeId,
    username,
    registrationStatus: "APPROVED",
  });
});

// GET /api/institution/profile - returns the authenticated institution's profile
router.get("/profile", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx || !ctx.institution) {
    return res.status(404).json({ message: "Institution not found for user" });
  }
  return res.json({
    user: {
      userId: ctx.user.userId,
      role: ctx.user.role,
      accountStatus: ctx.user.accountStatus,
    },
    institution: ctx.institution,
  });
});

// Schema for profile completion
const completeProfileSchema = z.object({
  trustName: z.string().min(1, "Trust / Society Name is required"),
  registrationYear: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  phone: z.string().min(5, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().min(4, "PIN Code is required"),
  principalName: z.string().min(1, "Principal Name is required"),
  principalEmail: z.string().email("Valid Principal Email is required"),
  principalPhone: z.string().min(5, "Principal Phone Number is required"),
  name: z.string().optional(),
});

// Profile update / completion handler
async function handleCompleteProfile(req: Request, res: Response) {
  const ctx = await getSessionInstitution(req);
  if (!ctx || !ctx.institution) {
    return res.status(404).json({ message: "Institution not found for user" });
  }

  const parse = completeProfileSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ message: "Validation error", errors: parse.error.format() });
  }

  const {
    trustName,
    registrationYear,
    phone,
    address,
    city,
    state,
    pinCode,
    principalName,
    principalEmail,
    principalPhone,
    name,
  } = parse.data;

  const inst = ctx.institution;
  if (name && name.trim()) {
    inst.name = name.trim();
  }
  inst.trustName = trustName;
  inst.registrationYear = registrationYear;
  inst.phone = phone;
  inst.contactNumber = phone;
  inst.address = address;
  inst.city = city;
  inst.state = state;
  inst.pinCode = pinCode;
  inst.pincode = pinCode;
  inst.principalName = principalName;
  inst.principalEmail = principalEmail;
  inst.principalPhone = principalPhone;
  inst.profileCompleted = true;

  await inst.save();

  return res.json({
    message: "Institution profile completed successfully",
    institution: inst,
  });
}

router.post("/complete-profile", requireAuth, requireRole("INSTITUTION"), handleCompleteProfile);
router.put("/profile", requireAuth, requireRole("INSTITUTION"), handleCompleteProfile);

// GET /api/institution/dashboard-overview - full metrics and summary for institution
router.get("/dashboard-overview", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx || !ctx.institution) {
    return res.status(404).json({ message: "Institution not found for user" });
  }

  const collegeIds = getInstitutionIdentifiers(ctx);
  const collegeId = ctx.institution?.collegeId || ctx.user?.collegeId || ctx.user?.userId;
  const totalApps = await Application.countDocuments({ collegeId: { $in: collegeIds } });
  const pendingApps = await Application.countDocuments({ collegeId: { $in: collegeIds }, status: "SUBMITTED" });
  const approvedApps = await Application.countDocuments({ collegeId: { $in: collegeIds }, status: "APPROVED" });
  const rejectedApps = await Application.countDocuments({ collegeId: { $in: collegeIds }, status: "REJECTED" });

  const totalPayments = await Payment.countDocuments({ collegeId: { $in: collegeIds } });
  const verifiedPayments = await Payment.countDocuments({ collegeId: { $in: collegeIds }, status: "VERIFIED" });

  const totalReleases = await ReleaseRequest.countDocuments({ collegeId: { $in: collegeIds } });
  const approvedReleases = await ReleaseRequest.countDocuments({ collegeId: { $in: collegeIds }, status: "APPROVED" });

  const totalComplaints = await Complaint.countDocuments({
    $or: [{ institutionId: { $in: collegeIds } }, { collegeId: { $in: collegeIds } }],
  });
  const pendingComplaints = await Complaint.countDocuments({
    $or: [{ institutionId: { $in: collegeIds } }, { collegeId: { $in: collegeIds } }],
    status: { $in: ["NEW", "UNDER_REVIEW", "PENDING"] },
  });

  const recentApplications = await Application.find({ collegeId: { $in: collegeIds } }).sort({ createdAt: -1 }).limit(5);
  const recentComplaints = await Complaint.find({
    $or: [{ institutionId: { $in: collegeIds } }, { collegeId: { $in: collegeIds } }],
  }).sort({ createdAt: -1 }).limit(5);

  return res.json({
    institution: ctx.institution,
    stats: {
      totalApplications: totalApps,
      pendingApplications: pendingApps,
      approvedApplications: approvedApps,
      rejectedApplications: rejectedApps,
      totalPayments,
      verifiedPayments,
      totalReleases,
      approvedReleases,
      totalComplaints,
      pendingComplaints,
    },
    recentApplications,
    recentComplaints,
  });
});

// Secure Document Upload endpoint (Multer + Magic Bytes validation)
router.post(
  "/upload",
  requireAuth,
  requireRole("INSTITUTION"),
  upload.single("file"),
  validateFileSignature,
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    return res.status(200).json({
      message: "File uploaded successfully",
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      fileUrl: `/api/institution/files/${req.file.filename}`,
    });
  }
);

// Secure Document Download/Serving endpoint with cross-institution access control
router.get("/files/:filename", requireAuth, async (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename));
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  const role = req.session.role;
  // AICTE and employee roles are authorized to review any document
  if (role && ["AICTE_FD_EMPLOYEE", "PGRC_EMPLOYEE", "VIGILANCE_EMPLOYEE", "AICTE_ADMIN"].includes(role)) {
    return res.sendFile(filePath);
  }

  // If INSTITUTION role: ensure this file actually belongs to this institution
  if (role === "INSTITUTION") {
    const ctx = await getSessionInstitution(req);
    if (!ctx) {
      return res.status(403).json({ message: "Access denied" });
    }
    const collegeIds = [ctx.user.userId, ctx.institution?.collegeId, ctx.institution?.name].filter(Boolean);

    // Check if file is in any Application of this institution
    const appWithFile = await Application.findOne({
      collegeId: { $in: collegeIds },
      $or: [
        { documents: filename },
        { "categoryDocuments.fileName": filename },
        { "documentItems.fileName": filename },
        { "documentItems.name": filename },
      ]
    });

    if (appWithFile) {
      return res.sendFile(filePath);
    }

    // Check if in DocumentVerification of this institution's applications
    const appsOfInst = await Application.find({ collegeId: { $in: collegeIds } }, { _id: 1 });
    const appIds = appsOfInst.map(a => a._id);
    const docVer = await DocumentVerification.findOne({
      $or: [
        { applicationId: { $in: appIds } },
        { institutionId: { $in: collegeIds } },
        { collegeId: { $in: collegeIds } },
      ],
      documentPath: filename,
    });

    if (docVer) {
      return res.sendFile(filePath);
    }

    // Check if in ReleaseRequest of this institution
    const relWithFile = await ReleaseRequest.findOne({
      $and: [
        {
          $or: [
            { collegeId: { $in: collegeIds } },
            { institutionId: { $in: collegeIds } },
          ],
        },
        {
          $or: [
            { documents: filename },
            { "documentItems.file": filename },
            { "documentItems.fileName": filename },
            { "documentItems.name": filename },
          ],
        },
      ],
    });

    if (relWithFile) {
      return res.sendFile(filePath);
    }

    // Check if in Notification belonging to this institution
    const notifWithFile = await Notification.findOne({
      collegeId: { $in: collegeIds },
      $or: [
        { "metadata.fileName": filename },
        { "metadata.documentPath": filename },
        { "metadata.docName": filename },
      ],
    });

    if (notifWithFile) {
      return res.sendFile(filePath);
    }

    return res.status(403).json({ message: "Access denied. You do not have permission to view documents of other institutions." });
  }

  return res.status(403).json({ message: "Access denied" });
});

function formatFileSize(bytes: number) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// GET /api/institution/approval/current - gets active approval application & documents
router.get("/approval/current", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const { mode, appId } = req.query;
  const collegeIds = getInstitutionIdentifiers(ctx);

  if (mode === "new") {
    // Mode is explicitly "new": do not return old applications
    return res.json({
      application: null,
      verifications: [],
    });
  }

  let application = null;
  if (appId) {
    application = await Application.findOne({
      collegeId: { $in: collegeIds },
      applicationId: String(appId),
    }).exec();
  }

  // If specific appId was not provided and not in new mode, check if there is an in-progress DRAFT
  if (!application && !mode) {
    application = await Application.findOne({
      collegeId: { $in: collegeIds },
      type: "APPROVAL_SEEKING",
      status: "DRAFT",
    }).sort({ updatedAt: -1 }).exec();
  }

  let verifications: any[] = [];
  if (application) {
    verifications = await DocumentVerification.find({ applicationId: application._id }).exec();
  }

  return res.json({ application, verifications });
});

// POST /api/institution/approval/save - save draft or submit Approval Seeking application
router.post("/approval/save", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const { applicationId: reqAppId, title, description, documents, isDraft, applicationType, mode } = req.body;
  const canonicalCollegeId = ctx.institution?.collegeId || ctx.user.collegeId || ctx.user.userId;
  const collegeIds = getInstitutionIdentifiers(ctx);

  let application: any = null;
  // If not explicitly new mode, check if updating an existing application with matching ID
  if (reqAppId && mode !== "new") {
    application = await Application.findOne({
      collegeId: { $in: collegeIds },
      applicationId: reqAppId,
    }).exec();
  }

  // Prevent changing application type of already submitted application
  if (application && application.status === "SUBMITTED" && application.applicationType) {
    if (applicationType && application.applicationType !== applicationType.toUpperCase()) {
      return res.status(400).json({
        message: "Application type cannot be changed for an already submitted application without an authorized correction workflow.",
      });
    }
  }

  const selectedAppType = applicationType ? applicationType.toUpperCase() : (application?.applicationType || null);

  const docPaths = Array.isArray(documents)
    ? documents.map((d: any) => typeof d === "string" ? d : d.fileName || d.fileUrl)
    : [];

  const MANDATORY_DOC_LIST = [
    { id: "land_docs", code: "DOC-01", name: "Land Ownership Documents / Registered Sale/Lease Deed" },
    { id: "land_use", code: "DOC-02", name: "Land Conversion / Land Use Certificate" },
    { id: "building_plan", code: "DOC-03", name: "Approved Building Plan" },
    { id: "occupancy_cert", code: "DOC-04", name: "Building Completion / Occupancy Certificate" },
    { id: "structural_stability", code: "DOC-05", name: "Structural Stability Certificate" },
    { id: "fire_noc", code: "DOC-06", name: "Fire & Life Safety NOC" },
    { id: "barrier_free", code: "DOC-07", name: "Barrier-Free Environment & Ramp/Lift Certificate" },
    { id: "potable_water", code: "DOC-08", name: "Potable Water & Sanitation Certificate" },
    { id: "aicte_affidavit", code: "DOC-09", name: "AICTE Prescribed E-Affidavit (Affidavit-1)" },
    { id: "trust_registration", code: "DOC-10", name: "Trust / Society Registration Certificate & MoA" },
    { id: "audited_financials", code: "DOC-11", name: "Audited Financial Statements (Last 3 Years)" },
    { id: "faculty_cadre", code: "DOC-12", name: "Faculty Cadre Ratio & Staff Joining Reports" }
  ];

  const documentItems = Array.isArray(documents) ? documents.map((d: any, idx: number) => {
    const fileName = typeof d === "string" ? d : (d.fileName || d.documentPath || d.name);
    const catId = typeof d === "object" ? d.category : null;
    let cat = catId ? MANDATORY_DOC_LIST.find(c => c.id === catId || c.code === catId) : null;
    if (!cat && idx < MANDATORY_DOC_LIST.length) cat = MANDATORY_DOC_LIST[idx];

    let formattedSize = d.size || "1.2 MB";
    let fileType = "PDF";
    if (fileName) {
      const ext = path.extname(fileName).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") fileType = "JPEG";
      else if (ext === ".png") fileType = "PNG";
      else if (ext === ".pdf") fileType = "PDF";
      try {
        const fullPath = path.join(UPLOAD_DIR, fileName);
        if (fs.existsSync(fullPath)) {
          formattedSize = formatFileSize(fs.statSync(fullPath).size);
        }
      } catch {}
    }

    return {
      id: `${application?.applicationId || `APP-${Date.now()}`}-DOC-${idx + 1}`,
      code: cat?.code || `DOC-${String(idx + 1).padStart(2, "0")}`,
      category: cat?.id || `cat_${idx + 1}`,
      name: cat ? `${cat.code}: ${cat.name}` : fileName,
      categoryName: cat?.name || "Mandatory Document",
      fileName,
      originalName: d.originalName || fileName,
      fileUrl: `/api/institution/files/${fileName}`,
      previewUrl: `/api/institution/files/${fileName}`,
      type: fileType,
      size: formattedSize,
      uploadDate: new Date(),
      status: "Pending",
      remarks: "",
    };
  }) : [];

  if (!application) {
    const applicationId = `APP-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    application = new Application({
      collegeId: canonicalCollegeId,
      applicationId,
      title: title || (selectedAppType === "LOA" ? "AICTE Approval Seeking — Letter of Approval (LoA)" : "AICTE Approval Seeking — Extension of Approval (EoA)"),
      type: "APPROVAL_SEEKING",
      applicationType: selectedAppType,
      programme: ctx.institution?.institutionType ? `${ctx.institution.institutionType} Engineering & Technology` : "Technical Programme",
      description: description || (selectedAppType === "LOA" ? "New institute approval seeking document submission" : "Annual institution compliance and approval seeking document submission"),
      documents: docPaths,
      documentItems,
      categoryDocuments: documents,
      status: isDraft ? "UNDER_REVIEW" : "SUBMITTED",
      isReviewed: false,
      submissionDate: new Date(),
    });
  } else {
    application.title = title || application.title;
    application.description = description || application.description;
    application.documents = docPaths;
    application.documentItems = documentItems;
    application.categoryDocuments = documents;
    if (selectedAppType) {
      application.applicationType = selectedAppType;
    }
    application.status = isDraft ? "UNDER_REVIEW" : "SUBMITTED";
    application.isReviewed = false;
  }

  await application.save();
  console.log('Institution application saved:', application.applicationId, 'status', application.status, 'applicationType', application.applicationType);

  // Create or update DocumentVerification records for FD inspection
  if (Array.isArray(documents)) {
    for (const doc of documents) {
      if (doc && (doc.fileName || doc.documentPath)) {
        const docPath = doc.fileName || doc.documentPath;
        const cat = doc.category || doc.code;
        const existing = await DocumentVerification.findOne({
          applicationId: application._id,
          $or: [
            ...(cat ? [{ category: cat }] : []),
            ...(doc.id ? [{ documentId: doc.id }] : []),
            { documentPath: docPath },
          ],
        });

        if (existing) {
          // If a corrected/replacement document is uploaded or was previously rejected, preserve previous rejection in audit history
          if (existing.documentPath !== docPath || existing.status === "NOT_VERIFIED") {
            if (existing.status === "NOT_VERIFIED" || (existing.remarks && existing.remarks.trim())) {
              if (!existing.history) existing.history = [];
              existing.history.push({
                decision: existing.status || "NOT_VERIFIED",
                status: existing.status || "NOT_VERIFIED",
                remarks: existing.remarks || "",
                employeeId: existing.employeeId,
                employeeUserId: existing.employeeUserId,
                date: existing.decisionDate || existing.updatedAt || new Date(),
                documentPath: existing.documentPath,
                documentName: existing.documentName || existing.originalName,
              });
            }
            existing.documentPath = docPath;
            existing.originalName = doc.originalName || doc.fileName;
            existing.documentName = doc.name || doc.categoryName || cat || "Submitted Document";
            existing.category = cat;
            existing.verified = false;
            existing.status = "PENDING";
            existing.reviewed = false;
            existing.remarks = ""; // Cleared from active deficiency list!
            await existing.save();
          }
        } else {
          await DocumentVerification.create({
            applicationId: application._id,
            institutionId: canonicalCollegeId,
            collegeId: canonicalCollegeId,
            applicationRef: application.applicationId,
            documentPath: docPath,
            documentId: doc.id || cat,
            documentName: doc.name || doc.categoryName || cat || "Submitted Document",
            originalName: doc.originalName || doc.fileName,
            category: cat,
            verified: false,
            status: "PENDING",
            reviewed: false,
            remarks: "",
            employeeId: ctx.user._id,
            history: [],
          });
        }
      }
    }
  }

  return res.status(200).json({
    message: isDraft ? "Draft saved successfully" : "Application submitted successfully",
    application,
  });
});

// Legacy / compatibility application creation
router.post("/application", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(400).json({ message: "Institution not found for user" });

  const { title, type, description, documents } = req.body;
  if (!title || !type) {
    return res.status(400).json({ message: "title and type required" });
  }

  const applicationId = `APP-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const application = new Application({
    collegeId: ctx.user.userId,
    applicationId,
    title,
    type,
    description: description || "",
    documents: documents || [],
    status: "SUBMITTED",
    isReviewed: false,
  });
  await application.save();
  return res.status(201).json({ applicationId: application.applicationId, application });
});

// GET /api/institution/applications - returns institution applications
router.get("/applications", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const apps = await Application.find({
    $or: [{ collegeId: ctx.user.userId }, { collegeId: ctx.user._id.toString() }],
  }).sort({ createdAt: -1 });

  return res.json(apps);
});

// GET /api/institution/payments - lists payment and FDR submissions
router.get("/payments", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const payments = await Payment.find({
    $or: [{ collegeId: ctx.user.userId }, { collegeId: ctx.user._id.toString() }],
  }).sort({ createdAt: -1 });

  return res.json(payments);
});

// POST /api/institution/payment - submits FDR details and document
router.post("/payment", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const {
    fdrNumber,
    referenceNumber,
    amount,
    maturityDate,
    bankName,
    branchName,
    ifscCode,
    bankEmployeeName,
    bankEmployeeId,
    bankEmployeeDesignation,
    bankEmployeeContact,
    documentPath,
    documents,
  } = req.body;

  const resolvedFdrNumber = fdrNumber || referenceNumber;
  if (!resolvedFdrNumber || !amount || !bankName) {
    return res.status(400).json({ message: "FDR Number, Amount, and Bank Name are required" });
  }

  const paymentId = `FDR-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const payment = new Payment({
    collegeId: ctx.user.userId,
    paymentId,
    referenceNumber: resolvedFdrNumber,
    paymentDate: new Date(),
    amount: Number(amount),
    method: "FDR",
    receiptPath: documentPath || "",
    status: "PENDING_VERIFICATION",
    isReviewed: false,
  } as any);

  // Store detailed bank and employee metadata
  (payment as any).bankName = bankName;
  (payment as any).branchName = branchName;
  (payment as any).ifscCode = ifscCode;
  (payment as any).maturityDate = maturityDate ? new Date(maturityDate) : undefined;
  (payment as any).bankEmployeeName = bankEmployeeName;
  (payment as any).bankEmployeeId = bankEmployeeId;
  (payment as any).bankEmployeeDesignation = bankEmployeeDesignation;
  (payment as any).bankEmployeeContact = bankEmployeeContact;

  const originalDocumentName = req.body.originalDocumentName;
  if (Array.isArray(documents) && documents.length > 0) {
    (payment as any).documents = documents;
  } else if (documentPath) {
    const ext = path.extname(documentPath).replace(".", "").toUpperCase() || "PDF";
    (payment as any).documents = [
      {
        id: `doc-${Date.now()}`,
        name: originalDocumentName || "Fixed Deposit Receipt",
        fileName: path.basename(documentPath),
        file: documentPath,
        url: `/api/institution/files/${path.basename(documentPath)}`,
        type: ext,
        size: "—",
        status: "Pending",
        uploadDate: new Date(),
      },
    ];
  } else {
    (payment as any).documents = [];
  }

  await payment.save();

  return res.status(201).json({
    message: "FDR and Payment details submitted successfully for FD verification",
    payment,
  });
});

// GET /api/institution/release-requests - lists release applications
router.get("/release-requests", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const requests = await ReleaseRequest.find({
    $or: [{ collegeId: ctx.user.userId }, { collegeId: ctx.user._id.toString() }],
  }).sort({ createdAt: -1 });

  return res.json(requests);
});

// POST /api/institution/release-request - submits release request with the 4 mandatory documents
router.post("/release-request", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const { fdrReference, depositDetails, reason, documents } = req.body;
  if (!fdrReference || !reason) {
    return res.status(400).json({ message: "FDR Reference and Reason for release are required" });
  }

  // Verify the 4 mandatory documents
  const docs = documents || {};
  if (!docs.releaseLetter || !docs.eoa || !docs.affidavit || !docs.fdrCopy) {
    return res.status(400).json({
      message: "All four documents (Release Letter, EoA, Affidavit, FDR Copy) are mandatory for submission",
    });
  }

  const releaseRequestId = `REL-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const releaseRequest = new ReleaseRequest({
    collegeId: ctx.user.userId,
    releaseRequestId,
    fdrReference,
    depositDetails: depositDetails || `FDR: ${fdrReference}`,
    reason,
    documents: [docs.releaseLetter, docs.eoa, docs.affidavit, docs.fdrCopy],
    status: "SUBMITTED",
    isReviewed: false,
    submissionDate: new Date(),
  });

  (releaseRequest as any).documentDetails = docs;
  await releaseRequest.save();

  return res.status(201).json({
    message: "Release request submitted successfully with all 4 validated documents",
    releaseRequest,
  });
});

// Submit a complaint (institution)
router.post("/complaint", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const { title, description, category, applicationId } = req.body;
  if (!title || !description) {
    return res.status(400).json({ message: "Title and description are required" });
  }

  const complaint = new Complaint({
    institutionId: ctx.user.userId,
    applicationId: applicationId || undefined,
    title,
    description,
    status: "PENDING",
  });
  if (category) (complaint as any).category = category;
  await complaint.save();

  return res.status(201).json({
    message: "Complaint registered successfully",
    complaintId: complaint._id,
    complaint,
  });
});

// Get institution's complaints
router.get("/complaints", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const complaints = await Complaint.find({
    $or: [{ institutionId: ctx.user.userId }, { institutionId: ctx.user._id.toString() }],
  }).sort({ createdAt: -1 });

  return res.json(complaints);
});

// Get single complaint tracking details
router.get("/complaint/:id", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) return res.status(404).json({ message: "Complaint not found" });

  return res.json(complaint);
});

// GET /api/institution/receive/loa-eoa - gets official approval letters
router.get("/receive/loa-eoa", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const approvals = await Application.find({
    collegeId: { $in: collegeIds },
    letterSent: true,
    result: { $in: ["LoA", "EoA", "LOA", "EOA"] },
  }).sort({ letterSentDate: -1, updatedAt: -1 });

  const letters = approvals.map((app) => ({
    applicationId: app.applicationId,
    title: app.title,
    programme: app.programme || app.title,
    intake: app.intake || 60,
    type: (app.result === "LoA" || app.result === "LOA") ? "Letter of Approval (LoA)" : "Extension of Approval (EoA)",
    letterType: (app.result === "LoA" || app.result === "LOA") ? "LOA" : "EOA",
    referenceNo: app.letterReferenceNumber || `AICTE/AB/2026-27/${ctx.institution?.collegeId || ctx.user.userId}/${app.applicationId}`,
    approvedDate: app.letterSentDate || app.updatedAt,
    letterText: app.letterText || "",
    status: app.status,
    institutionName: ctx.institution?.name || ctx.user.username || app.collegeId,
  }));

  return res.json({ letters });
});

// GET /api/institution/receive/loa-eoa/:id/pdf and GET /api/institution/application/:id/letter-pdf
// Directly serves authenticated binary PDF download with Content-Disposition attachment
router.get(
  ["/receive/loa-eoa/:id/pdf", "/application/:id/letter-pdf"],
  requireAuth,
  requireRole("INSTITUTION"),
  async (req: Request, res: Response) => {
    try {
      const ctx = await getSessionInstitution(req);
      if (!ctx) {
        return res.status(403).json({ message: "Access denied. Valid institution session required." });
      }

      const collegeIds = getInstitutionIdentifiers(ctx);
      const { id } = req.params;
      const strId = Array.isArray(id) ? id[0] : String(id);
      const idClause = mongoose.isValidObjectId(strId)
        ? { $or: [{ _id: strId }, { applicationId: strId }] }
        : { applicationId: strId };

      const app = await Application.findOne({
        $and: [
          idClause,
          { collegeId: { $in: collegeIds } },
        ],
      });

      if (!app) {
        return res.status(404).json({ message: "Approval letter not found or unauthorized access." });
      }

      if (!app.letterSent && !app.letterGenerated && !app.letterText) {
        return res.status(404).json({ message: "Official approval letter has not been generated or issued yet." });
      }

      const inst = ctx.institution || (await Institution.findOne({ collegeId: app.collegeId }));
      const isLoA = app.result === "LoA" || app.result === "LOA";
      const isEoA = app.result === "EoA" || app.result === "EOA";
      const letterType = isLoA ? "LoA" : "EoA";
      const filename = `${letterType}_Letter_${app.applicationId}.pdf`;

      const pdfBuffer = await generateApprovalLetterPdf({
        application: app,
        institution: inst,
        letterTitle: isLoA ? "LETTER OF APPROVAL (LoA)" : "EXTENSION OF APPROVAL (EoA)",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Institution letter PDF download error:", err);
      return res.status(500).json({ message: "Failed to generate approval letter PDF" });
    }
  }
);

// GET /api/institution/receive/lod-eod - gets deficiency letters
router.get("/receive/lod-eod", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const deficiencies = await Application.find({
    collegeId: { $in: collegeIds },
    letterSent: true,
    result: { $in: ["LoD", "EoD", "LOD", "EOD"] },
  }).sort({ letterSentDate: -1, updatedAt: -1 });

  const letters = deficiencies.map((app) => {
    const isLod = app.result === "LoD" || app.result === "LOD";
    const deficiencyReason = Array.isArray(app.deficiencyRemarks) && app.deficiencyRemarks.length > 0
      ? app.deficiencyRemarks.map((r: any) => `${r.docName || r.name || "Document"}: ${r.remarks || "Deficiency noted"}`).join("; ")
      : (app.letterText ? "Deficiencies identified during FD document verification." : "Deficiencies noted during document verification review.");

    return {
      applicationId: app.applicationId,
      title: app.title,
      programme: app.programme || app.title,
      type: isLod ? "Letter of Deficiency (LoD)" : "Extension Deficiency Notice (EoD)",
      letterType: isLod ? "LOD" : "EOD",
      referenceNo: app.letterReferenceNumber || `AICTE/AB/2026-27/${ctx.institution?.collegeId || ctx.user.userId}/${app.applicationId}`,
      date: app.letterSentDate || app.updatedAt,
      reason: deficiencyReason,
      letterText: app.letterText || "",
      deficiencies: app.deficiencyRemarks || [],
      documents: (app.documentItems || []).filter((d: any) => d.status === "Not Verified"),
      status: app.status,
    };
  });

  return res.json({ letters });
});

// GET /api/institution/receive/lod-eod/:id/pdf
// Directly serves authenticated binary deficiency notice PDF with Content-Disposition attachment
router.get(
  "/receive/lod-eod/:id/pdf",
  requireAuth,
  requireRole("INSTITUTION"),
  async (req: Request, res: Response) => {
    try {
      const ctx = await getSessionInstitution(req);
      if (!ctx) {
        return res.status(403).json({ message: "Access denied. Valid institution session required." });
      }

      const collegeIds = getInstitutionIdentifiers(ctx);
      const { id } = req.params;
      const strId = Array.isArray(id) ? id[0] : String(id);
      const idClause = mongoose.isValidObjectId(strId)
        ? { $or: [{ _id: strId }, { applicationId: strId }] }
        : { applicationId: strId };

      const app = await Application.findOne({
        $and: [
          idClause,
          { collegeId: { $in: collegeIds } },
        ],
      });

      if (!app) {
        return res.status(404).json({ message: "Deficiency notice not found or unauthorized access." });
      }

      if (!app.letterSent && !app.letterGenerated && !app.letterText) {
        return res.status(404).json({ message: "Deficiency notice has not been generated or issued yet." });
      }

      const inst = ctx.institution || (await Institution.findOne({ collegeId: app.collegeId }));
      const isLoD = app.result === "LoD" || app.result === "LOD";
      const letterType = isLoD ? "LoD" : "EoD";
      const filename = `${letterType}_Notice_${app.applicationId}.pdf`;

      const pdfBuffer = await generateApprovalLetterPdf({
        application: app,
        institution: inst,
        letterTitle: isLoD ? "LETTER OF DEFICIENCY (LoD)" : "EXTENSION DEFICIENCY NOTICE (EoD)",
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Institution deficiency PDF download error:", err);
      return res.status(500).json({ message: "Failed to generate deficiency notice PDF" });
    }
  }
);

// GET /api/institution/receive/deposit-details - gets deposit instructions issued by FD employee
router.get("/receive/deposit-details", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const apps = await Application.find({
    collegeId: { $in: collegeIds },
    depositDetailsSent: true,
  }).sort({ "depositDetails.sentAt": -1, updatedAt: -1 });

  const depositDetails = apps.map((app) => ({
    applicationId: app.applicationId,
    programme: app.programme || app.title,
    letterReferenceNumber: app.depositDetails?.letterReferenceNumber || app.letterReferenceNumber || `AICTE/AB/2026-27/${ctx.institution?.collegeId || ctx.user.userId}/${app.applicationId}`,
    depositAmount: app.depositDetails?.depositAmount || 0,
    bankAccountNumber: app.depositDetails?.bankAccountNumber || "—",
    bankName: app.depositDetails?.bankName || "State Bank of India",
    branchName: app.depositDetails?.branchName || "AICTE Headquarters Branch",
    ifscCode: app.depositDetails?.ifscCode || "SBIN0000691",
    paymentInstructions: app.depositDetails?.paymentInstructions || "Deposit required amount by the specified deadline and upload the FDR acknowledgment.",
    depositDeadline: app.depositDetails?.depositDeadline,
    sentAt: app.depositDetails?.sentAt || app.updatedAt,
    sentBy: app.depositDetails?.sentBy || "AICTE FD",
    version: app.depositDetails?.version || 1,
    status: app.depositDetails?.status || "Active",
    history: app.depositDetails?.history || [],
  }));

  return res.json({ depositDetails });
});

// GET /api/institution/receive/documents - backward compatible aggregator
router.get("/receive/documents", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const approvals = await Application.find({ collegeId: { $in: collegeIds }, letterSent: true, result: { $in: ["LoA", "EoA", "LOA", "EOA"] } });
  const deficiencies = await Application.find({ collegeId: { $in: collegeIds }, letterSent: true, result: { $in: ["LoD", "EoD", "LOD", "EOD"] } });
  const verifiedPayments = await Payment.find({ collegeId: { $in: collegeIds }, status: "VERIFIED" });
  const approvedReleases = await ReleaseRequest.find({ collegeId: { $in: collegeIds }, status: "APPROVED" });

  return res.json({
    loaEoaList: approvals.map((app) => ({
      type: (app.result === "LoA" || app.result === "LOA") ? "Letter of Approval (LoA)" : "Extension of Approval (EoA)",
      letterType: (app.result === "LoA" || app.result === "LOA") ? "LOA" : "EOA",
      applicationId: app.applicationId,
      title: app.title,
      approvedDate: app.letterSentDate || app.updatedAt,
      referenceNo: app.letterReferenceNumber || `AICTE/AB/2026-27/${ctx.institution?.collegeId || ctx.user.userId}/${app.applicationId}`,
      fileUrl: `#`,
      letterText: app.letterText,
      institutionName: ctx.institution?.name || ctx.user.username || app.collegeId,
    })),
    lodEodList: deficiencies.map((app) => {
      const isLod = app.result === "LoD" || app.result === "LOD";
      const deficiencyReason = Array.isArray(app.deficiencyRemarks) && app.deficiencyRemarks.length > 0
        ? app.deficiencyRemarks.map((r: any) => `${r.docName || r.name || "Document"}: ${r.remarks || "Deficiency noted"}`).join("; ")
        : (app.letterText ? "Deficiencies identified during FD document verification." : "Deficiencies noted during document verification review.");

      return {
        type: isLod ? "Letter of Deficiency (LoD)" : "Extension Deficiency Notice (EoD)",
        letterType: isLod ? "LOD" : "EOD",
        applicationId: app.applicationId,
        title: app.title,
        date: app.letterSentDate || app.updatedAt,
        reason: deficiencyReason,
        letterText: app.letterText,
        deficiencies: app.deficiencyRemarks || [],
      };
    }),
    depositClearances: verifiedPayments.map((p) => ({
      fdrNumber: p.referenceNumber,
      amount: p.amount,
      status: p.status,
      date: p.updatedAt,
    })),
    approvedReleases: approvedReleases.map((r) => ({
      releaseRequestId: r.releaseRequestId,
      fdrReference: r.fdrReference,
      status: r.status,
      date: r.updatedAt,
    })),
  });
});

// GET /api/institution/receive/complaint-letters - Scoped to logged-in institution
router.get("/receive/complaint-letters", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const instIdStr = (ctx.institution._id as any).toString();
  const collegeId = ctx.institution.collegeId || ctx.user.userId;

  const letters = await ComplaintLetter.find({
    $or: [{ institutionId: instIdStr }, { collegeId: collegeId }],
    isSent: true,
  }).sort({ sentDate: -1, createdAt: -1 }).lean();

  const sanitized = letters.map(l => ({
    _id: l._id,
    letterReference: l.letterReference,
    department: l.department,
    status: l.status,
    reason: l.reason,
    sentDate: l.sentDate || l.createdAt,
    date: l.sentDate || l.createdAt,
    content: l.content,
    institutionName: l.institutionName,
    collegeId: l.collegeId,
  }));

  return res.json({ letters: sanitized });
});

// GET /api/institution/receive/document-deficiencies - Scoped to logged-in institution
router.get("/receive/document-deficiencies", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);

  // Retrieve all applications belonging to this institution
  const applications = await Application.find({
    collegeId: { $in: collegeIds },
  }).sort({ submissionDate: -1, createdAt: -1 }).lean();

  const appIds = applications.map(a => a._id);
  const appMap = new Map<string, any>();
  applications.forEach(a => {
    appMap.set(a._id.toString(), a);
    if (a.applicationId) appMap.set(a.applicationId, a);
  });

  // Query DocumentVerification records specifically for this institution's applications
  const verifications = await DocumentVerification.find({
    $or: [
      { applicationId: { $in: appIds } },
      { institutionId: { $in: collegeIds } },
      { collegeId: { $in: collegeIds } },
    ],
  }).sort({ updatedAt: -1, decisionDate: -1 }).lean();

  const deficiencies: any[] = [];
  const processedDocKeys = new Set<string>();

  // Process DocumentVerification records
  for (const v of verifications) {
    const parentApp = appMap.get(v.applicationId ? v.applicationId.toString() : "") ||
                      (v.applicationRef ? appMap.get(v.applicationRef) : null);

    // Rule: Exclude documents that are currently verified
    if (v.verified === true || v.status === "VERIFIED") {
      continue;
    }

    // Rule: If document was replaced and is now pending verification without rejection remarks, exclude
    if (v.status === "PENDING" && (!v.remarks || !v.remarks.trim())) {
      continue;
    }

    // Only include actual rejected / not verified documents
    if (v.status === "NOT_VERIFIED" || (!v.verified && v.remarks && v.remarks.trim())) {
      const key = `${v.applicationId || v.applicationRef}_${v.documentId || v.category || v.documentPath}`;
      if (processedDocKeys.has(key)) continue;
      processedDocKeys.add(key);

      const rawType = parentApp?.applicationType || parentApp?.type || "Approval Seeking";
      const appType = String(rawType).toUpperCase().includes("LOA")
        ? "LoA"
        : String(rawType).toUpperCase().includes("EOA")
        ? "EoA"
        : "Approval Seeking";

      const filename = v.documentPath ? path.basename(v.documentPath) : "";

      deficiencies.push({
        id: v._id.toString(),
        applicationId: parentApp?._id ? parentApp._id.toString() : (v.applicationId ? v.applicationId.toString() : ""),
        applicationRef: parentApp?.applicationId || v.applicationRef || "N/A",
        applicationType: appType,
        documentId: v.documentId || v.category || "DOC",
        documentName: v.documentName || v.categoryName || v.originalName || filename || "Submitted Document",
        documentPath: filename,
        fileUrl: filename ? `/api/institution/files/${filename}` : (v.fileUrl || ""),
        verificationStatus: "NOT VERIFIED",
        remarks: v.remarks || "Document deficiency noted by AICTE Finance Division.",
        decisionDate: v.decisionDate || v.updatedAt || v.createdAt || new Date(),
        history: v.history || [],
      });
    }
  }

  // Also cross-reference documentItems in applications for any marked "Not Verified"
  for (const app of applications) {
    if (Array.isArray(app.documentItems)) {
      for (const item of app.documentItems) {
        if (item.status === "Not Verified") {
          const key = `${app._id}_${item.id || item.code || item.fileName}`;
          if (processedDocKeys.has(key)) continue;
          processedDocKeys.add(key);

          const rawType = app.applicationType || app.type || "Approval Seeking";
          const appType = String(rawType).toUpperCase().includes("LOA")
            ? "LoA"
            : String(rawType).toUpperCase().includes("EOA")
            ? "EoA"
            : "Approval Seeking";

          const filename = item.fileName ? path.basename(item.fileName) : "";

          deficiencies.push({
            id: `doc-${item.id || item.code || Math.random().toString(36).substring(7)}`,
            applicationId: app._id.toString(),
            applicationRef: app.applicationId || "N/A",
            applicationType: appType,
            documentId: item.id || item.code || "DOC",
            documentName: item.name || item.code || filename || "Submitted Document",
            documentPath: filename,
            fileUrl: filename ? `/api/institution/files/${filename}` : (item.fileUrl || ""),
            verificationStatus: "NOT VERIFIED",
            remarks: item.remarks || "Document deficiency noted by AICTE Finance Division.",
            decisionDate: item.verifiedAt || app.updatedAt || app.createdAt || new Date(),
            history: [],
          });
        }
      }
    }
  }

  // Also include Release Applications deficiencies
  const releaseRequests = await ReleaseRequest.find({
    $or: [
      { collegeId: { $in: collegeIds } },
      { institutionId: { $in: collegeIds } },
    ],
  }).sort({ submissionDate: -1, createdAt: -1 }).lean();

  for (const rr of releaseRequests) {
    const defaultNames = ["Release Approval Letter", "EoA", "Affidavit", "FDR Copy"];
    let docs = Array.isArray(rr.documentItems) && rr.documentItems.length > 0 ? rr.documentItems : [];
    if (docs.length === 0 && Array.isArray(rr.documents)) {
      docs = rr.documents.map((docFile: string, idx: number) => ({
        id: `doc-${idx + 1}`,
        name: defaultNames[idx] || `Document ${idx + 1}`,
        file: docFile,
        status: "Pending",
        remarks: "",
      }));
    }

    for (let idx = 0; idx < docs.length; idx++) {
      const d = docs[idx];
      const isNotVerified =
        d.status === "Not Verified" ||
        d.status === "NOT_VERIFIED" ||
        d.status === "REJECTED" ||
        (d.status !== "Verified" && d.status !== "VERIFIED" && d.remarks && String(d.remarks).trim());

      if (isNotVerified) {
        const key = `${rr.releaseRequestId || rr._id}_${d.id || d.name || d.file}`;
        if (processedDocKeys.has(key)) continue;
        processedDocKeys.add(key);

        const filename = d.file ? path.basename(d.file) : (Array.isArray(rr.documents) && rr.documents[idx] ? path.basename(rr.documents[idx]) : "");
        deficiencies.push({
          id: `rel-${rr.releaseRequestId || rr._id}-${d.id || idx}`,
          applicationId: rr.releaseRequestId || rr._id.toString(),
          applicationRef: rr.releaseRequestId || rr.fdrReference || "Release Application",
          applicationType: "Release Application",
          documentId: d.id || `doc-${idx + 1}`,
          documentName: d.name || defaultNames[idx] || filename || "Release Document",
          documentPath: filename,
          fileUrl: filename ? `/api/institution/files/${filename}` : (d.fileUrl || ""),
          verificationStatus: "NOT VERIFIED",
          remarks: d.remarks || "Release document deficiency noted by AICTE Finance Division.",
          decisionDate: d.verifiedAt || rr.updatedAt || rr.createdAt || new Date(),
          history: [],
        });
      }
    }
  }

  // Cross-reference any persistent release deficiency notifications
  const releaseNotifs = await Notification.find({
    collegeId: { $in: collegeIds },
    type: "DOCUMENT_NOT_VERIFIED",
    $or: [
      { title: { $regex: /release/i } },
      { message: { $regex: /release/i } },
      { "metadata.releaseRequestId": { $exists: true } },
    ]
  }).sort({ createdAt: -1 }).lean();

  for (const rn of releaseNotifs) {
    const relAppId = rn.applicationId || rn.metadata?.releaseRequestId || "Release Application";
    const docId = rn.metadata?.docId || "doc-1";
    const docName = rn.metadata?.docName || "Release Document";
    const key = `${relAppId}_${docId}_${docName}`;
    if (processedDocKeys.has(key)) continue;
    processedDocKeys.add(key);

    const matchingRr = releaseRequests.find(r => r.releaseRequestId === relAppId || r._id.toString() === relAppId);
    let matchedFile = "";
    if (matchingRr && Array.isArray(matchingRr.documents)) {
      if (docName.toLowerCase().includes("letter") && matchingRr.documents[0]) matchedFile = matchingRr.documents[0];
      else if (docName.toLowerCase().includes("eoa") && matchingRr.documents[1]) matchedFile = matchingRr.documents[1];
      else if (docName.toLowerCase().includes("affidavit") && matchingRr.documents[2]) matchedFile = matchingRr.documents[2];
      else if (docName.toLowerCase().includes("fdr") && matchingRr.documents[3]) matchedFile = matchingRr.documents[3];
      else matchedFile = matchingRr.documents[0] || "";
    }
    const filename = matchedFile ? path.basename(matchedFile) : "";

    deficiencies.push({
      id: `rel-notif-${rn._id.toString()}`,
      applicationId: relAppId,
      applicationRef: relAppId,
      applicationType: "Release Application",
      documentId: docId,
      documentName: docName,
      documentPath: filename,
      fileUrl: filename ? `/api/institution/files/${filename}` : "",
      verificationStatus: "NOT VERIFIED",
      remarks: rn.metadata?.remarks || rn.message || "Release document deficiency noted by AICTE Finance Division.",
      decisionDate: rn.createdAt || new Date(),
      history: [],
    });
  }

  return res.json({ deficiencies });
});


// Helper to build robust filter for notifications matching all identifiers of the institution
export function buildNotificationFilter(collegeIds: string[], unreadOnly: boolean = false) {
  const escapeRegex = (s: string) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  const idClauses = collegeIds.map(id => ({
    collegeId: new RegExp(`^${escapeRegex(id)}$`, "i")
  }));
  const baseQuery: any = idClauses.length > 1 ? { $or: idClauses } : idClauses.length === 1 ? idClauses[0] : { collegeId: "__none__" };

  if (unreadOnly) {
    return {
      $and: [
        baseQuery,
        {
          $or: [
            { read: false },
            { read: { $ne: true } },
            { read: { $exists: false } }
          ]
        }
      ]
    };
  }
  return baseQuery;
}

// GET /api/institution/resolve-document - Safely identify original uploaded document for notifications
router.get("/resolve-document", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  let targetAppId = (req.query.appId as string) || "";
  let targetDocId = (req.query.docId as string) || "";
  let targetDocName = (req.query.docName as string) || "";
  const notifId = (req.query.notifId as string) || "";

  if (notifId) {
    const isObjId = mongoose.Types.ObjectId.isValid(notifId);
    const notif = await Notification.findOne({
      $and: [
        isObjId ? { $or: [{ _id: new mongoose.Types.ObjectId(notifId) }, { _id: notifId }] } : { _id: notifId },
        buildNotificationFilter(collegeIds, false)
      ]
    }).lean();

    if (notif) {
      if (!targetAppId) {
        targetAppId = notif.applicationId || notif.metadata?.releaseRequestId || notif.metadata?.applicationId || "";
      }
      if (!targetDocId) {
        targetDocId = notif.metadata?.docId || notif.metadata?.category || "";
      }
      if (!targetDocName) {
        targetDocName = notif.metadata?.docName || "";
      }
      if (!targetDocName) {
        const dashMatch = notif.title && notif.title.match(/—\s*([^—\n]+)$/);
        if (dashMatch) targetDocName = dashMatch[1].trim();
      }
      if (!targetDocName) {
        const quoteMatch = notif.message && notif.message.match(/["“']([^"”']+)["”']/);
        if (quoteMatch) targetDocName = quoteMatch[1].trim();
      }
      if (!targetAppId && notif.message) {
        const appMatch = notif.message.match(/application\s+([A-Za-z0-9_-]+)/i);
        if (appMatch) targetAppId = appMatch[1].trim();
      }
    }
  }

  // 1. Search ReleaseRequest
  const relQuery: any = {
    $or: [
      { collegeId: { $in: collegeIds } },
      { institutionId: { $in: collegeIds } },
    ]
  };
  if (targetAppId) {
    relQuery.$and = [
      {
        $or: [
          { releaseRequestId: targetAppId },
          { fdrReference: targetAppId },
          ...(mongoose.Types.ObjectId.isValid(targetAppId) ? [{ _id: new mongoose.Types.ObjectId(targetAppId) }] : []),
        ]
      }
    ];
  }
  const relRequests = await ReleaseRequest.find(relQuery).sort({ createdAt: -1 }).lean();
  for (const rr of relRequests) {
    const defaultNames = ["Release Approval Letter", "EoA", "Affidavit", "FDR Copy"];
    const docs = Array.isArray(rr.documentItems) && rr.documentItems.length > 0
      ? rr.documentItems
      : (Array.isArray(rr.documents) ? rr.documents.map((f: string, idx: number) => ({
          id: `doc-${idx + 1}`,
          name: defaultNames[idx] || `Document ${idx + 1}`,
          file: f,
          fileName: f,
        })) : []);

    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const dName = d.name || defaultNames[i] || "";
      const dId = d.id || `doc-${i + 1}`;
      const dFile = d.file || d.fileName || (Array.isArray(rr.documents) ? rr.documents[i] : "");

      const matchId = targetDocId && (
        dId === targetDocId ||
        dId.toLowerCase() === targetDocId.toLowerCase()
      );
      const matchName = targetDocName && (
        dName.toLowerCase() === targetDocName.toLowerCase() ||
        dName.toLowerCase().includes(targetDocName.toLowerCase()) ||
        targetDocName.toLowerCase().includes(dName.toLowerCase()) ||
        (dFile && dFile.toLowerCase().includes(targetDocName.toLowerCase()))
      );

      if (matchId || matchName) {
        const filename = path.basename(dFile || "");
        if (filename) {
          return res.json({
            success: true,
            document: {
              name: dName || filename,
              fileName: filename,
              fileUrl: `/api/institution/files/${filename}`,
              applicationRef: rr.releaseRequestId || rr.fdrReference || "Release Application",
              documentId: dId,
            }
          });
        }
      }
    }
  }

  // 2. Search DocumentVerification
  const verifQuery: any = {
    $or: [
      { institutionId: { $in: collegeIds } },
      { collegeId: { $in: collegeIds } },
    ]
  };
  if (targetAppId) {
    verifQuery.$or.push({ applicationRef: targetAppId });
    if (mongoose.Types.ObjectId.isValid(targetAppId)) {
      verifQuery.$or.push({ applicationId: new mongoose.Types.ObjectId(targetAppId) });
    }
  }
  const verifs = await DocumentVerification.find(verifQuery).sort({ updatedAt: -1 }).lean();
  for (const v of verifs) {
    const matchId = targetDocId && (
      v.documentId === targetDocId ||
      v.category === targetDocId ||
      v._id.toString() === targetDocId
    );
    const matchName = targetDocName && (
      (v.documentName && v.documentName.toLowerCase().includes(targetDocName.toLowerCase())) ||
      (v.originalName && v.originalName.toLowerCase().includes(targetDocName.toLowerCase())) ||
      (v.documentPath && v.documentPath.toLowerCase().includes(targetDocName.toLowerCase()))
    );

    if (matchId || matchName) {
      const filename = path.basename(v.documentPath || "");
      if (filename) {
        return res.json({
          success: true,
          document: {
            name: v.documentName || v.originalName || filename,
            fileName: filename,
            fileUrl: `/api/institution/files/${filename}`,
            applicationRef: v.applicationRef || targetAppId,
            documentId: v.documentId || v.category,
          }
        });
      }
    }
  }

  // 3. Search Application
  const appQuery: any = { collegeId: { $in: collegeIds } };
  if (targetAppId) {
    appQuery.$or = [
      { applicationId: targetAppId },
      ...(mongoose.Types.ObjectId.isValid(targetAppId) ? [{ _id: new mongoose.Types.ObjectId(targetAppId) }] : [])
    ];
  }
  const apps = await Application.find(appQuery).sort({ updatedAt: -1, createdAt: -1 }).lean();
  for (const app of apps) {
    if (Array.isArray(app.documentItems)) {
      for (const item of app.documentItems) {
        const matchId = targetDocId && (item.id === targetDocId || item.code === targetDocId);
        const matchName = targetDocName && (
          (item.name && item.name.toLowerCase().includes(targetDocName.toLowerCase())) ||
          (item.fileName && item.fileName.toLowerCase().includes(targetDocName.toLowerCase()))
        );
        if (matchId || matchName) {
          const filename = path.basename(item.fileName || "");
          if (filename) {
            return res.json({
              success: true,
              document: {
                name: item.name || filename,
                fileName: filename,
                fileUrl: `/api/institution/files/${filename}`,
                applicationRef: app.applicationId,
                documentId: item.id || item.code,
              }
            });
          }
        }
      }
    }
    if (app.categoryDocuments) {
      const catDocs = app.categoryDocuments instanceof Map ? Object.fromEntries(app.categoryDocuments) : app.categoryDocuments;
      for (const [catKey, val] of Object.entries(catDocs as Record<string, any>)) {
        const item = typeof val === "string" ? { fileName: val } : val;
        const matchId = targetDocId && (catKey === targetDocId || catKey.toLowerCase() === targetDocId.toLowerCase());
        const matchName = targetDocName && (
          catKey.toLowerCase().includes(targetDocName.toLowerCase()) ||
          (item.fileName && item.fileName.toLowerCase().includes(targetDocName.toLowerCase())) ||
          (item.name && item.name.toLowerCase().includes(targetDocName.toLowerCase()))
        );
        if (matchId || matchName) {
          const rawFile = item.fileName || item.filename || item.path || (typeof val === "string" ? val : "");
          const filename = path.basename(rawFile);
          if (filename) {
            return res.json({
              success: true,
              document: {
                name: item.name || catKey,
                fileName: filename,
                fileUrl: `/api/institution/files/${filename}`,
                applicationRef: app.applicationId,
                documentId: catKey,
              }
            });
          }
        }
      }
    }
    if (Array.isArray(app.documents)) {
      for (const d of app.documents) {
        const filename = path.basename(d);
        if (targetDocName && filename.toLowerCase().includes(targetDocName.toLowerCase())) {
          return res.json({
            success: true,
            document: {
              name: targetDocName || filename,
              fileName: filename,
              fileUrl: `/api/institution/files/${filename}`,
              applicationRef: app.applicationId,
              documentId: filename,
            }
          });
        }
      }
    }
  }

  return res.status(404).json({
    success: false,
    message: "Original uploaded document could not be located."
  });
});

// GET /api/institution/notifications - persistent MongoDB-backed notifications
router.get("/notifications", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const query = buildNotificationFilter(collegeIds, false);
  const unreadQuery = buildNotificationFilter(collegeIds, true);

  const notifs = await Notification.find(query).sort({ createdAt: -1 });
  const unreadCount = await Notification.countDocuments(unreadQuery);

  const notifications = notifs.map(n => ({
    _id: n._id,
    id: n._id.toString(),
    collegeId: n.collegeId,
    applicationId: n.applicationId,
    title: n.title,
    message: n.message,
    body: n.message,
    type: n.type,
    read: Boolean(n.read),
    link: n.link || "/institution/dashboard",
    metadata: n.metadata,
    createdAt: n.createdAt,
    date: n.createdAt,
  }));

  return res.json({ notifications, unreadCount });
});

// GET /api/institution/notifications/unread-count - dedicated count endpoint
router.get("/notifications/unread-count", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const unreadQuery = buildNotificationFilter(collegeIds, true);
  const unreadCount = await Notification.countDocuments(unreadQuery);
  return res.json({ unreadCount });
});

// Mark single notification as read
router.post("/notifications/:id/read", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const baseQuery = buildNotificationFilter(collegeIds, false);
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const isObjId = mongoose.Types.ObjectId.isValid(paramId);
  await Notification.updateOne(
    {
      $and: [
        isObjId ? { $or: [{ _id: new mongoose.Types.ObjectId(paramId) }, { _id: paramId }] } : { _id: paramId },
        baseQuery
      ]
    },
    { $set: { read: true, isRead: true } }
  );
  const unreadQuery = buildNotificationFilter(collegeIds, true);
  const unreadCount = await Notification.countDocuments(unreadQuery);
  return res.json({ message: "Notification marked as read", unreadCount });
});

router.patch("/notifications/:id/read", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const baseQuery = buildNotificationFilter(collegeIds, false);
  const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const isObjId = mongoose.Types.ObjectId.isValid(paramId);
  await Notification.updateOne(
    {
      $and: [
        isObjId ? { $or: [{ _id: new mongoose.Types.ObjectId(paramId) }, { _id: paramId }] } : { _id: paramId },
        baseQuery
      ]
    },
    { $set: { read: true, isRead: true } }
  );
  const unreadQuery = buildNotificationFilter(collegeIds, true);
  const unreadCount = await Notification.countDocuments(unreadQuery);
  return res.json({ message: "Notification marked as read", unreadCount });
});

// Mark all notifications as read
router.post("/notifications/read-all", requireAuth, requireRole("INSTITUTION"), async (req: Request, res: Response) => {
  const ctx = await getSessionInstitution(req);
  if (!ctx) return res.status(404).json({ message: "Institution not found" });

  const collegeIds = getInstitutionIdentifiers(ctx);
  const unreadQuery = buildNotificationFilter(collegeIds, true);

  const updateResult = await Notification.updateMany(unreadQuery, { $set: { read: true, isRead: true } });
  const unreadCount = await Notification.countDocuments(unreadQuery);
  return res.json({ message: "All notifications marked as read", unreadCount, modifiedCount: updateResult.modifiedCount });
});

export default router;
